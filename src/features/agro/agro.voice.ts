// Interprete de comandos de voz para traslados (22/09/2026, pedido
// explicito). Pestana "Voz": SIMULACION VISUAL SOLAMENTE -- este archivo
// solo interpreta texto y devuelve una estructura; nunca llama al backend
// ni modifica nada de la app real. Lee establecimientos/potreros/
// categorias YA CARGADOS (para que el reconocimiento tenga sentido y
// valide contra datos reales) pero no los toca.
//
// Frase esperada (orden fijo, ver AgroVoiceSection.tsx):
//   "Traslado del [establecimiento origen] a [establecimiento destino],
//    del potrero [potrero origen] al potrero [potrero destino],
//    cantidad [numero], [categoria de animal]."
//
// Ejemplo: "Traslado del Ombu a La Milagrosa, del potrero 1 al
// potrero 5, cantidad 5, toros."
//
// La palabra "cantidad" antes del numero es obligatoria (pedido explicito,
// 22/09/2026: "hay potrero con numero, digo del potrero 1 al potrero 5, 5
// toros y entiende potrero 55... debemos poner un diferenciador"). Sin esa
// palabra en el medio, el reconocimiento de voz puede escuchar el numero
// del potrero destino pegado al numero de la cantidad y entenderlos como
// uno solo (potrero "5" + cantidad "5" -> "55"). "Cantidad" le da un corte
// audible entre los dos numeros.
//
// Diseno: "traslado" activa la interpretacion (si no arranca con esa
// palabra, no se interpreta nada). Las palabras clave estructurales (a,
// del potrero, al potrero, cantidad) se buscan como texto exacto; los
// nombres propios (establecimientos, potreros, categorias) se buscan por
// similitud contra los datos reales, no por texto exacto -- la voz puede
// reconocer un nombre un poco distinto. Ante cualquier duda (no se
// encontro algo, o hay mas de una opcion igual de parecida) se devuelve
// "incomplete" con un mensaje para pedir aclaracion, nunca se adivina.
import { AgroSpecies, CategoryDefinition, Establishment, FieldUnit } from "./agro.types";

export type VoiceTransferData = {
  establishments: Establishment[];
  fields: FieldUnit[];
  categoryCatalog: Record<AgroSpecies, CategoryDefinition[]>;
};

export type VoiceTransferReady = {
  status: "ready";
  origin: { establishment: Establishment; field: FieldUnit };
  destination: { establishment: Establishment; field: FieldUnit };
  quantity: number;
  species: AgroSpecies;
  category: CategoryDefinition;
};

export type VoiceTransferParseResult = { status: "no_intent" } | { status: "incomplete"; message: string } | VoiceTransferReady;

// ---------- Normalizacion y similitud (para tolerar variaciones de la voz) ----------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sacar acentos: "Ombú" -> "ombu"
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // sacar puntuacion, dejar letras/numeros/espacios
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

const ENTITY_MATCH_THRESHOLD = 0.72;
// Si el mejor candidato y el segundo quedan mas cerca que esto, se
// considera ambiguo (mejor preguntar que arriesgar el establecimiento o
// potrero equivocado).
const AMBIGUITY_GAP = 0.05;

type EntityCandidate<T> = { normalizedName: string; label: string; value: T };
type EntityMatch<T> = { value: T; consumed: number; score: number; ambiguousLabels: string[] };

const LEADING_ARTICLES = ["el ", "la ", "los ", "las "];

// "El Ombu" / "La Milagrosa": el articulo casi siempre se dice pegado a
// "del"/"de la" (que ya lo contrae -- "del" = "de" + "el"), asi que lo que
// se escucha despues es el nombre SIN el articulo. Se agrega ademas esa
// variante (nombre sin el articulo) como candidato valido, para que
// "traslado del Ombu..." matchee igual que "traslado de El Ombu...".
function buildEstablishmentCandidates(establishments: Establishment[]): EntityCandidate<Establishment>[] {
  const candidates: EntityCandidate<Establishment>[] = [];
  for (const establishment of establishments) {
    const normalizedFull = normalize(establishment.name);
    candidates.push({ normalizedName: normalizedFull, label: establishment.name, value: establishment });

    const article = LEADING_ARTICLES.find((prefix) => normalizedFull.startsWith(prefix));
    if (article) {
      candidates.push({ normalizedName: normalizedFull.slice(article.length), label: establishment.name, value: establishment });
    }
  }
  return candidates;
}

// Busca, arrancando en `startIndex`, el candidato que mejor coincide.
// Importante: a cada candidato se lo compara contra EXACTAMENTE su propia
// cantidad de palabras (no una ventana comun para todos) -- comparar
// contra una ventana mas larga hacia que, por ejemplo, "la milagrosa del"
// (con la palabra clave "del" pegada) puntuara casi tan bien como "la
// milagrosa" sola por ser parecida en longitud, y se "comia" la palabra
// clave siguiente.
function matchEntity<T>(tokens: string[], startIndex: number, candidates: EntityCandidate<T>[]): EntityMatch<T> | null {
  const scoredByValue = new Map<string, { value: T; label: string; score: number; consumed: number }>();

  for (const candidate of candidates) {
    const wordCount = candidate.normalizedName.split(" ").length;
    if (startIndex + wordCount > tokens.length) continue;

    const phrase = tokens.slice(startIndex, startIndex + wordCount).join(" ");
    const score = similarity(phrase, candidate.normalizedName);
    if (score < ENTITY_MATCH_THRESHOLD) continue;

    // Un mismo establecimiento puede tener mas de un candidato (con y sin
    // articulo, ver buildEstablishmentCandidates) -- se queda con el mejor
    // puntaje de cada uno, para no marcarlo como "ambiguo contra si mismo".
    const key = JSON.stringify(candidate.value);
    const existing = scoredByValue.get(key);
    if (!existing || score > existing.score) {
      scoredByValue.set(key, { value: candidate.value, label: candidate.label, score, consumed: wordCount });
    }
  }

  const scored = [...scoredByValue.values()].sort((a, b) => b.score - a.score);
  if (!scored.length) return null;

  const [top, ...rest] = scored;
  const ambiguous = rest.length > 0 && top.score - rest[0].score < AMBIGUITY_GAP;
  return {
    value: top.value,
    consumed: top.consumed,
    score: top.score,
    ambiguousLabels: ambiguous ? [top.label, ...rest.map((r) => r.label)] : []
  };
}

// ---------- Numeros hablados ----------

const NUMBER_WORDS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100
};

const ROUND_TENS = new Set([20, 30, 40, 50, 60, 70, 80, 90]);

// Devuelve la cantidad y cuantas palabras se usaron (1, o 3 para "treinta
// y cinco"). Acepta tanto digitos ("5") como palabras ("cinco").
function parseQuantity(tokens: string[], index: number): { value: number; consumed: number } | null {
  const token = tokens[index];
  if (token === undefined) return null;

  if (/^\d+$/.test(token)) {
    return { value: Number(token), consumed: 1 };
  }

  const base = NUMBER_WORDS[token];
  if (base === undefined) return null;

  if (ROUND_TENS.has(base) && tokens[index + 1] === "y") {
    const unit = NUMBER_WORDS[tokens[index + 2]];
    if (unit !== undefined && unit >= 1 && unit <= 9) {
      return { value: base + unit, consumed: 3 };
    }
  }

  return { value: base, consumed: 1 };
}

// ---------- Categoria de animal ----------

function stripCategoryPrefix(label: string): string {
  // "2) Vacas de cria (entoradas)" -> "Vacas de cria" -- el numero y la
  // aclaracion entre parentesis casi nunca se dicen al hablar.
  return label
    .replace(/^\d+\)\s*/, "")
    .replace(/\([^)]*\)/g, " ")
    .trim();
}

type CategoryMatch = { status: "matched"; species: AgroSpecies; category: CategoryDefinition } | { status: "ambiguous"; options: string[] } | { status: "not_found" };

function matchCategory(tailText: string, categoryCatalog: Record<AgroSpecies, CategoryDefinition[]>): CategoryMatch {
  const normalizedTail = normalize(tailText);
  if (!normalizedTail) return { status: "not_found" };

  const candidates: Array<{ species: AgroSpecies; category: CategoryDefinition; coreLabel: string }> = [];

  for (const species of Object.keys(categoryCatalog) as AgroSpecies[]) {
    for (const category of categoryCatalog[species]) {
      const coreLabel = normalize(stripCategoryPrefix(category.label));

      // Coincidencia exacta: gana directo, no hace falta seguir buscando.
      if (coreLabel === normalizedTail) {
        return { status: "matched", species, category };
      }

      const isPrefixMatch = coreLabel.startsWith(normalizedTail) || normalizedTail.startsWith(coreLabel);
      if (isPrefixMatch || similarity(normalizedTail, coreLabel) >= ENTITY_MATCH_THRESHOLD) {
        candidates.push({ species, category, coreLabel });
      }
    }
  }

  if (candidates.length === 1) {
    return { status: "matched", species: candidates[0].species, category: candidates[0].category };
  }
  if (candidates.length > 1) {
    // Ej: decir solo "novillos" -- hay 3 tipos de novillo, no se puede
    // adivinar cual sin arriesgar el dato.
    return { status: "ambiguous", options: candidates.map((c) => stripCategoryPrefix(c.category.label)) };
  }
  return { status: "not_found" };
}

// ---------- Parser principal ----------

export function parseVoiceTransferCommand(transcript: string, data: VoiceTransferData): VoiceTransferParseResult {
  const tokens = normalize(transcript).split(" ").filter(Boolean);

  if (tokens[0] !== "traslado") {
    return { status: "no_intent" };
  }

  let cursor = 1;
  if (tokens[cursor] === "del") {
    cursor += 1;
  } else if (tokens[cursor] === "de" && tokens[cursor + 1] === "la") {
    cursor += 2;
  } else if (tokens[cursor] === "de") {
    cursor += 1;
  }

  const establishmentCandidates = buildEstablishmentCandidates(data.establishments);

  const originMatch = matchEntity(tokens, cursor, establishmentCandidates);
  if (!originMatch) {
    return {
      status: "incomplete",
      message: "No reconoci el establecimiento de origen. Repeti la frase asi: \"Traslado del [establecimiento] a [otro establecimiento]...\"."
    };
  }
  if (originMatch.ambiguousLabels.length) {
    return { status: "incomplete", message: `El establecimiento de origen es ambiguo, podria ser: ${originMatch.ambiguousLabels.join(", ")}. Decilo mas claro.` };
  }
  cursor += originMatch.consumed;

  if (tokens[cursor] !== "a") {
    return { status: "incomplete", message: "Despues del establecimiento de origen falta la palabra \"a\" seguida del destino." };
  }
  cursor += 1;

  const destinationMatch = matchEntity(tokens, cursor, establishmentCandidates);
  if (!destinationMatch) {
    return { status: "incomplete", message: "No reconoci el establecimiento de destino." };
  }
  if (destinationMatch.ambiguousLabels.length) {
    return { status: "incomplete", message: `El establecimiento de destino es ambiguo, podria ser: ${destinationMatch.ambiguousLabels.join(", ")}. Decilo mas claro.` };
  }
  cursor += destinationMatch.consumed;

  if (tokens[cursor] !== "del" || tokens[cursor + 1] !== "potrero") {
    return { status: "incomplete", message: "Despues del destino falta decir \"del potrero [nombre]\"." };
  }
  cursor += 2;

  const originFieldCandidates: EntityCandidate<FieldUnit>[] = data.fields
    .filter((field) => field.establishmentId === originMatch.value.id)
    .map((field) => ({ normalizedName: normalize(field.name), label: field.name, value: field }));

  const originFieldMatch = matchEntity(tokens, cursor, originFieldCandidates);
  if (!originFieldMatch) {
    return { status: "incomplete", message: `No encontre ese potrero en ${originMatch.value.name}.` };
  }
  if (originFieldMatch.ambiguousLabels.length) {
    return { status: "incomplete", message: `El potrero de origen es ambiguo, podria ser: ${originFieldMatch.ambiguousLabels.join(", ")}. Decilo mas claro.` };
  }
  cursor += originFieldMatch.consumed;

  if (tokens[cursor] !== "al" || tokens[cursor + 1] !== "potrero") {
    return { status: "incomplete", message: "Despues del potrero de origen falta decir \"al potrero [nombre]\"." };
  }
  cursor += 2;

  const destinationFieldCandidates: EntityCandidate<FieldUnit>[] = data.fields
    .filter((field) => field.establishmentId === destinationMatch.value.id)
    .map((field) => ({ normalizedName: normalize(field.name), label: field.name, value: field }));

  const destinationFieldMatch = matchEntity(tokens, cursor, destinationFieldCandidates);
  if (!destinationFieldMatch) {
    return { status: "incomplete", message: `No encontre ese potrero en ${destinationMatch.value.name}.` };
  }
  if (destinationFieldMatch.ambiguousLabels.length) {
    return { status: "incomplete", message: `El potrero de destino es ambiguo, podria ser: ${destinationFieldMatch.ambiguousLabels.join(", ")}. Decilo mas claro.` };
  }
  cursor += destinationFieldMatch.consumed;

  // Obligatoria: separa audiblemente el numero del potrero destino del
  // numero de la cantidad -- sin esta palabra en el medio, la voz puede
  // escuchar los dos numeros pegados como uno solo (ver comentario arriba).
  if (tokens[cursor] !== "cantidad") {
    return { status: "incomplete", message: "Despues del potrero de destino falta decir \"cantidad\" antes del numero (ej: \"...al potrero 5, cantidad 5, toros\")." };
  }
  cursor += 1;

  const quantity = parseQuantity(tokens, cursor);
  if (!quantity || quantity.value <= 0) {
    return { status: "incomplete", message: "No entendi la cantidad de animales. Decila justo despues de la palabra \"cantidad\"." };
  }
  cursor += quantity.consumed;

  const categoryTail = tokens.slice(cursor).join(" ");
  if (!categoryTail) {
    return { status: "incomplete", message: "Falta decir la categoria de animal (por ejemplo \"vacas de cria\")." };
  }

  const categoryMatch = matchCategory(categoryTail, data.categoryCatalog);
  if (categoryMatch.status === "ambiguous") {
    return { status: "incomplete", message: `La categoria "${categoryTail}" es ambigua, podria ser: ${categoryMatch.options.join(", ")}. Decila mas completa.` };
  }
  if (categoryMatch.status === "not_found") {
    return { status: "incomplete", message: `No reconoci la categoria de animal "${categoryTail}". Decila tal como esta en el sistema (ej "vacas de cria", "terneros").` };
  }

  return {
    status: "ready",
    origin: { establishment: originMatch.value, field: originFieldMatch.value },
    destination: { establishment: destinationMatch.value, field: destinationFieldMatch.value },
    quantity: quantity.value,
    species: categoryMatch.species,
    category: categoryMatch.category
  };
}
