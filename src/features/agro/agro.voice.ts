// Interprete de comandos de voz para traslados (22/09/2026, pedido
// explicito; version tolerante 28/09/2026, pedido explicito: "sin
// importar si falta algo al principio o al final, que pueda seguir y
// completar"). Este archivo solo interpreta texto y devuelve una
// estructura; no llama al backend ni modifica nada -- eso lo hace
// AgroVoiceSection.tsx a traves de AgroHomePage#submitVoiceTransfer.
//
// Frase esperada (orden fijo, pero CUALQUIER parte puede faltar):
//   "Traslado del [establecimiento origen] a [establecimiento destino],
//    del potrero [potrero origen] al potrero [potrero destino],
//    cantidad [numero], [categoria de animal]."
//
// Ejemplo completo: "Traslado del Ombu a La Milagrosa, del potrero 1 al
// potrero 5, cantidad 5, toros."
// Ejemplo incompleto: "Traslado de la Milagrosa del potrero Costa
// cantidad 5" -> entiende campo origen + potrero origen + cantidad,
// y devuelve como faltantes: campo destino, potrero destino, categoria.
//
// DISEÑO (28/09/2026): en vez de un cursor que avanza en orden estricto y
// frena en el primer dato que no reconoce (perdiendo todo lo que venia
// despues en la frase), se buscan primero las palabras clave "ancla" --
// " a " (separador de establecimientos), "del potrero", "al potrero",
// "cantidad" -- SEA QUE APAREZCAN O NO. Cada dato (establecimiento
// origen/destino, potrero origen/destino, cantidad, categoria) se busca
// despues en la "ventana" de texto entre dos anclas consecutivas. Si una
// ancla no aparece, esa ventana queda vacia y ese dato se marca como
// faltante -- pero el resto de las ventanas se siguen resolviendo igual,
// sin importar en que posicion de la frase esten.
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

// Lo que se pudo entender de la frase, sea que este completo o no --
// cualquier campo puede venir vacio (null) si no se reconocio.
export type VoiceTransferSlots = {
  originEstablishment: Establishment | null;
  originField: FieldUnit | null;
  destinationEstablishment: Establishment | null;
  destinationField: FieldUnit | null;
  quantity: number | null;
  species: AgroSpecies | null;
  category: CategoryDefinition | null;
};

export type VoiceTransferMissingSlot =
  | "originEstablishment"
  | "originField"
  | "destinationEstablishment"
  | "destinationField"
  | "quantity"
  | "category";

export type VoiceTransferPartial = {
  status: "partial";
  slots: VoiceTransferSlots;
  missing: VoiceTransferMissingSlot[];
};

export type VoiceTransferParseResult = { status: "no_intent" } | VoiceTransferPartial | VoiceTransferReady;

// ---------- Comando "resumen" (29/09/2026, pedido explicito) ----------
//
// Frase esperada: "resumen [del] [campo] [establecimiento] potrero
// [potrero]" -- el establecimiento y el potrero son los dos unicos datos,
// y ambos son obligatorios (a diferencia de "traslado", aca no hay
// cantidad/categoria que pedir). Igual que en traslado, se tolera que
// falte alguno: se devuelve lo que se entendio y se marca lo que falta.
export type VoiceSummarySlots = {
  establishment: Establishment | null;
  field: FieldUnit | null;
};

export type VoiceSummaryMissingSlot = "establishment" | "field";

export type VoiceSummaryPartial = {
  status: "partial";
  slots: VoiceSummarySlots;
  missing: VoiceSummaryMissingSlot[];
};

export type VoiceSummaryReady = {
  status: "ready";
  establishment: Establishment;
  field: FieldUnit;
};

export type VoiceSummaryParseResult = { status: "no_intent" } | VoiceSummaryPartial | VoiceSummaryReady;

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
// considera ambiguo -- mejor pedirlo a mano que arriesgar el
// establecimiento/potrero equivocado (se trata igual que "faltante").
const AMBIGUITY_GAP = 0.05;

type EntityCandidate<T> = { normalizedName: string; label: string; value: T };

const LEADING_ARTICLES = ["el ", "la ", "los ", "las "];

// "El Ombu" / "La Milagrosa": el articulo casi siempre se dice pegado a
// "del"/"de la" (que ya lo contrae -- "del" = "de" + "el"), asi que lo que
// se escucha despues es el nombre SIN el articulo. Se agrega ademas esa
// variante (nombre sin el articulo) como candidato valido.
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

// Busca el candidato que mejor coincide, tomando de la ventana SOLO la
// cantidad de palabras que ese candidato necesita, arrancando desde el
// principio de la ventana (igual criterio que el parser original -- cada
// candidato se compara contra su propia longitud, nunca contra toda la
// ventana entera). Esto es clave cuando la ventana quedo "sucia" con
// palabras de mas porque el ancla siguiente no se encontro (ver
// parseVoiceTransferCommand, el tramo final cuando falta "cantidad").
// Ambiguedad (dos candidatos casi iguales de parecidos) se trata igual
// que "no encontrado" -- se pide a mano, nunca se adivina.
function matchEntityAtStart<T>(
  windowTokens: string[],
  candidates: EntityCandidate<T>[]
): { value: T; consumed: number } | null {
  if (!windowTokens.length) return null;

  const scoredByValue = new Map<string, { value: T; score: number; consumed: number }>();
  for (const candidate of candidates) {
    const wordCount = candidate.normalizedName.split(" ").length;
    if (wordCount > windowTokens.length) continue;

    const phrase = windowTokens.slice(0, wordCount).join(" ");
    const score = similarity(phrase, candidate.normalizedName);
    if (score < ENTITY_MATCH_THRESHOLD) continue;

    const key = JSON.stringify(candidate.value);
    const existing = scoredByValue.get(key);
    if (!existing || score > existing.score) {
      scoredByValue.set(key, { value: candidate.value, score, consumed: wordCount });
    }
  }

  const scored = [...scoredByValue.values()].sort((a, b) => b.score - a.score);
  if (!scored.length) return null;

  const [top, ...rest] = scored;
  const ambiguous = rest.length > 0 && top.score - rest[0].score < AMBIGUITY_GAP;
  return ambiguous ? null : { value: top.value, consumed: top.consumed };
}

// Dentro de una ventana acotada por anclas, el establecimiento puede venir
// con un articulo/preposicion pegado adelante ("del", "de la", "de") --
// se intenta sacarlo antes de buscar el nombre. Si no hay preposicion (o
// la ventana esta vacia), se prueba tal cual.
function stripEstablishmentPreposition(windowTokens: string[]): string[] {
  if (windowTokens[0] === "del") return windowTokens.slice(1);
  if (windowTokens[0] === "de" && windowTokens[1] === "la") return windowTokens.slice(2);
  if (windowTokens[0] === "de") return windowTokens.slice(1);
  return windowTokens;
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

// Inverso de NUMBER_WORDS: para reconocer potreros con nombre numerico
// (pedido explicito, 23/09/2026: "en vez de 9 dice nueve, no encuentra el
// potrero nueve"). Chrome convierte los numeros dichos a digitos solo,
// pero Safari/iOS los deja como palabra tal cual se escucharon.
const NUMBER_TO_WORD: Record<number, string> = {
  0: "cero",
  1: "uno",
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
  9: "nueve",
  10: "diez",
  11: "once",
  12: "doce",
  13: "trece",
  14: "catorce",
  15: "quince",
  16: "dieciseis",
  17: "diecisiete",
  18: "dieciocho",
  19: "diecinueve",
  20: "veinte",
  21: "veintiuno",
  22: "veintidos",
  23: "veintitres",
  24: "veinticuatro",
  25: "veinticinco",
  26: "veintiseis",
  27: "veintisiete",
  28: "veintiocho",
  29: "veintinueve",
  30: "treinta",
  40: "cuarenta",
  50: "cincuenta",
  60: "sesenta",
  70: "setenta",
  80: "ochenta",
  90: "noventa",
  100: "cien"
};

function numberToWord(value: number): string | null {
  if (NUMBER_TO_WORD[value]) return NUMBER_TO_WORD[value];
  if (value > 30 && value < 100) {
    const tens = Math.floor(value / 10) * 10;
    const unit = value % 10;
    if (NUMBER_TO_WORD[tens] && unit >= 1 && unit <= 9) {
      return `${NUMBER_TO_WORD[tens]} y ${NUMBER_TO_WORD[unit]}`;
    }
  }
  return null;
}

// Candidatos de potrero: ademas del nombre tal cual, si es un numero puro
// (ej "9") se agrega tambien su forma en palabra ("nueve") como candidato
// valido -- ver comentario de NUMBER_TO_WORD arriba.
function buildFieldCandidates(fields: FieldUnit[]): EntityCandidate<FieldUnit>[] {
  const candidates: EntityCandidate<FieldUnit>[] = [];
  for (const field of fields) {
    const trimmedName = field.name.trim();
    candidates.push({ normalizedName: normalize(trimmedName), label: field.name, value: field });

    if (/^\d+$/.test(trimmedName)) {
      const asWord = numberToWord(Number(trimmedName));
      if (asWord) {
        candidates.push({ normalizedName: asWord, label: field.name, value: field });
      }
    }
  }
  return candidates;
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

function matchCategory(
  tailText: string,
  categoryCatalog: Record<AgroSpecies, CategoryDefinition[]>
): { species: AgroSpecies; category: CategoryDefinition } | null {
  const normalizedTail = normalize(tailText);
  if (!normalizedTail) return null;

  const candidates: Array<{ species: AgroSpecies; category: CategoryDefinition; score: number }> = [];

  for (const species of Object.keys(categoryCatalog) as AgroSpecies[]) {
    for (const category of categoryCatalog[species]) {
      const coreLabel = normalize(stripCategoryPrefix(category.label));

      if (coreLabel === normalizedTail) {
        return { species, category };
      }

      const isPrefixMatch = coreLabel.startsWith(normalizedTail) || normalizedTail.startsWith(coreLabel);
      const score = similarity(normalizedTail, coreLabel);
      if (isPrefixMatch || score >= ENTITY_MATCH_THRESHOLD) {
        candidates.push({ species, category, score: isPrefixMatch ? 1 : score });
      }
    }
  }

  // Igual que con establecimientos/potreros: ambiguedad se trata como "no
  // encontrado" -- se pide a mano en vez de arriesgar la categoria.
  if (candidates.length === 1) {
    return { species: candidates[0].species, category: candidates[0].category };
  }
  return null;
}

// ---------- Busqueda de anclas (palabras clave estructurales) ----------

function indexOfToken(tokens: string[], token: string, from: number): number {
  for (let i = from; i < tokens.length; i++) {
    if (tokens[i] === token) return i;
  }
  return -1;
}

function indexOfPhrase(tokens: string[], words: string[], from: number): number {
  for (let i = from; i <= tokens.length - words.length; i++) {
    if (words.every((word, offset) => tokens[i + offset] === word)) return i;
  }
  return -1;
}

// ---------- Parser principal ----------

export function parseVoiceTransferCommand(transcript: string, data: VoiceTransferData): VoiceTransferParseResult {
  const tokens = normalize(transcript).split(" ").filter(Boolean);

  if (tokens[0] !== "traslado") {
    return { status: "no_intent" };
  }

  // Anclas, buscadas SIEMPRE sobre el texto crudo (nunca se "adivina" de
  // antemano que el establecimiento origen esta ahi -- si se asumiera que
  // el "del" de la posicion 1 es siempre la preposicion del establecimiento,
  // se lo comeria por error cuando en realidad es el "del" de "del potrero"
  // de una frase que se salteo el campo). Cada ancla se busca desde donde
  // termino la anterior SI se encontro -- si no se encontro, se sigue
  // buscando la siguiente desde el mismo punto, sin trabarse.
  const aIdx = indexOfToken(tokens, "a", 1);
  const afterA = aIdx !== -1 ? aIdx + 1 : 1;

  const delPotreroIdx = indexOfPhrase(tokens, ["del", "potrero"], afterA);
  const afterDelPotrero = delPotreroIdx !== -1 ? delPotreroIdx + 2 : afterA;

  const alPotreroIdx = indexOfPhrase(tokens, ["al", "potrero"], afterDelPotrero);
  const afterAlPotrero = alPotreroIdx !== -1 ? alPotreroIdx + 2 : afterDelPotrero;

  const cantidadIdx = indexOfToken(tokens, "cantidad", afterAlPotrero);

  // ---- Ventanas de texto entre anclas consecutivas ----
  const originEstablishmentEnd = [aIdx, delPotreroIdx, alPotreroIdx, cantidadIdx, tokens.length].find((value) => value >= 1) ?? tokens.length;
  const originEstablishmentTokens = stripEstablishmentPreposition(tokens.slice(1, originEstablishmentEnd));

  const destinationEstablishmentTokens =
    aIdx !== -1 ? tokens.slice(afterA, [delPotreroIdx, alPotreroIdx, cantidadIdx, tokens.length].find((value) => value >= afterA) ?? tokens.length) : [];

  const originFieldTokens =
    delPotreroIdx !== -1 ? tokens.slice(afterDelPotrero, [alPotreroIdx, cantidadIdx, tokens.length].find((value) => value >= afterDelPotrero) ?? tokens.length) : [];

  const destinationFieldTokens =
    alPotreroIdx !== -1 ? tokens.slice(afterAlPotrero, [cantidadIdx, tokens.length].find((value) => value >= afterAlPotrero) ?? tokens.length) : [];

  // ---- Resolver cada dato dentro de su ventana ----
  const establishmentCandidates = buildEstablishmentCandidates(data.establishments);
  const originEstablishment = matchEntityAtStart(originEstablishmentTokens, establishmentCandidates)?.value ?? null;
  const destinationEstablishment = matchEntityAtStart(destinationEstablishmentTokens, establishmentCandidates)?.value ?? null;

  // Si se conoce el establecimiento correspondiente, el potrero se busca
  // SOLO entre los potreros de ese establecimiento (evita confundir un
  // potrero "5" de un campo con el "5" de otro). Si no se conoce, se
  // busca entre TODOS los potreros -- si da unico, ademas se infiere de
  // regalo el establecimiento al que pertenece.
  const originFieldCandidates = buildFieldCandidates(
    originEstablishment ? data.fields.filter((field) => field.establishmentId === originEstablishment.id) : data.fields
  );
  const originFieldMatch = matchEntityAtStart(originFieldTokens, originFieldCandidates);
  const originField = originFieldMatch?.value ?? null;
  const inferredOriginEstablishment =
    originEstablishment ?? (originField ? data.establishments.find((item) => item.id === originField.establishmentId) ?? null : null);

  const destinationFieldCandidates = buildFieldCandidates(
    destinationEstablishment ? data.fields.filter((field) => field.establishmentId === destinationEstablishment.id) : data.fields
  );
  const destinationFieldMatch = matchEntityAtStart(destinationFieldTokens, destinationFieldCandidates);
  const destinationField = destinationFieldMatch?.value ?? null;
  const inferredDestinationEstablishment =
    destinationEstablishment ?? (destinationField ? data.establishments.find((item) => item.id === destinationField.establishmentId) ?? null : null);

  // El tramo final (cantidad + categoria) no tiene una ancla que lo cierre
  // -- si ademas falta "cantidad", la ventana de la categoria arrancaria
  // pisando las mismas palabras que ya uso el potrero destino (ej: "al
  // potrero 5 toros" sin "cantidad" -- "5" es del potrero, "toros" es la
  // categoria). Por eso se arrastra cuanto consumio EFECTIVAMENTE el
  // potrero destino (no la posicion fija del ancla) para saber donde
  // arranca lo que sigue.
  const afterDestinationField = alPotreroIdx !== -1 ? afterAlPotrero + (destinationFieldMatch?.consumed ?? 0) : afterAlPotrero;

  let quantity: number | null = null;
  let quantityEnd = afterDestinationField;
  if (cantidadIdx !== -1) {
    const parsedQuantity = parseQuantity(tokens, cantidadIdx + 1);
    if (parsedQuantity && parsedQuantity.value > 0) {
      quantity = parsedQuantity.value;
      quantityEnd = cantidadIdx + 1 + parsedQuantity.consumed;
    } else {
      quantityEnd = cantidadIdx + 1;
    }
  }

  const categoryTail = tokens.slice(quantityEnd).join(" ");
  const categoryMatch = categoryTail ? matchCategory(categoryTail, data.categoryCatalog) : null;

  const slots: VoiceTransferSlots = {
    originEstablishment: inferredOriginEstablishment,
    originField,
    destinationEstablishment: inferredDestinationEstablishment,
    destinationField,
    quantity,
    species: categoryMatch?.species ?? null,
    category: categoryMatch?.category ?? null
  };

  const missing: VoiceTransferMissingSlot[] = [];
  if (!slots.originEstablishment) missing.push("originEstablishment");
  if (!slots.originField) missing.push("originField");
  if (!slots.destinationEstablishment) missing.push("destinationEstablishment");
  if (!slots.destinationField) missing.push("destinationField");
  if (!slots.quantity) missing.push("quantity");
  if (!slots.category) missing.push("category");

  if (missing.length > 0) {
    return { status: "partial", slots, missing };
  }

  return {
    status: "ready",
    origin: { establishment: slots.originEstablishment!, field: slots.originField! },
    destination: { establishment: slots.destinationEstablishment!, field: slots.destinationField! },
    quantity: slots.quantity!,
    species: slots.species!,
    category: slots.category!
  };
}

// Saca "muletillas" pegadas adelante del nombre que se quiere reconocer
// (ej "del campo la milagrosa" -> "la milagrosa"), sacando de a una frase
// por vez hasta que ninguna calce mas -- asi se banca combinaciones como
// "del campo" (dos muletillas seguidas).
function stripLeadingFillers(tokens: string[], fillerPhrases: string[][]): string[] {
  let result = tokens;
  let changed = true;
  while (changed) {
    changed = false;
    for (const filler of fillerPhrases) {
      if (filler.length <= result.length && filler.every((word, i) => result[i] === word)) {
        result = result.slice(filler.length);
        changed = true;
        break;
      }
    }
  }
  return result;
}

const ESTABLISHMENT_FILLERS = [["del"], ["de", "la"], ["de"], ["el"], ["la"], ["campo"]];
const FIELD_FILLERS = [["el"], ["la"], ["numero"]];

// "resumen [del] [campo] [establecimiento] potrero [potrero]" -- la unica
// ancla es la palabra "potrero", que separa establecimiento (antes) de
// potrero (despues). Igual criterio que en traslado: si falta la ancla,
// se intenta igual resolver el establecimiento con todo lo que hay, y el
// potrero queda vacio (falta).
export function parseVoiceSummaryCommand(
  transcript: string,
  data: { establishments: Establishment[]; fields: FieldUnit[] }
): VoiceSummaryParseResult {
  const tokens = normalize(transcript).split(" ").filter(Boolean);

  if (tokens[0] !== "resumen") {
    return { status: "no_intent" };
  }

  const potreroIdx = indexOfToken(tokens, "potrero", 1);
  const establishmentEnd = potreroIdx !== -1 ? potreroIdx : tokens.length;
  const establishmentTokens = stripLeadingFillers(tokens.slice(1, establishmentEnd), ESTABLISHMENT_FILLERS);
  const fieldTokens = potreroIdx !== -1 ? stripLeadingFillers(tokens.slice(potreroIdx + 1), FIELD_FILLERS) : [];

  const establishmentCandidates = buildEstablishmentCandidates(data.establishments);
  const establishment = matchEntityAtStart(establishmentTokens, establishmentCandidates)?.value ?? null;

  // Igual que en traslado: si se sabe el establecimiento, el potrero se
  // busca solo entre los suyos (evita confundir un "5" de un campo con el
  // "5" de otro); si no, se busca entre todos y, si da unico, se infiere
  // de regalo el establecimiento al que pertenece.
  const fieldCandidates = buildFieldCandidates(
    establishment ? data.fields.filter((field) => field.establishmentId === establishment.id) : data.fields
  );
  const field = matchEntityAtStart(fieldTokens, fieldCandidates)?.value ?? null;
  const inferredEstablishment =
    establishment ?? (field ? data.establishments.find((item) => item.id === field.establishmentId) ?? null : null);

  const slots: VoiceSummarySlots = { establishment: inferredEstablishment, field };
  const missing: VoiceSummaryMissingSlot[] = [];
  if (!slots.establishment) missing.push("establishment");
  if (!slots.field) missing.push("field");

  if (missing.length > 0) {
    return { status: "partial", slots, missing };
  }

  return { status: "ready", establishment: slots.establishment!, field: slots.field! };
}
