import { useEffect, useMemo, useRef, useState } from "react";
import {
  compareRecordsByDateDesc,
  formatCategoryLabel,
  formatMoney,
  formatShortDate,
  getMonthDateRange,
  getTodayDate,
  isDateWithinRange
} from "./agro.home.shared";
import { AccountingEntry, AgroSpecies, Establishment, FieldUnit, MoneyCurrency, SanitaryRecord } from "./agro.types";
import {
  parseVoiceBirthCommand,
  parseVoiceSummaryCommand,
  parseVoiceTransferCommand,
  VoiceBirthReady,
  VoiceBirthSlots,
  VoiceSummarySlots,
  VoiceTransferReady,
  VoiceTransferSlots
} from "./agro.voice";
import { BIRTH_CATEGORY_CODE, categoryCatalog, speciesLabels } from "./agro.demo.data";

// Pestana "Voz" (22/09/2026, pasada a produccion 26/09/2026, pedido
// explicito: "que si guarde en la BDD, que no sea una demo"). Interpreta
// una orden de traslado hablada y, si el usuario confirma, se guarda de
// verdad -- mismo camino y mismas validaciones de stock que el
// formulario manual de "Animales" (ver AgroHomePage#submitVoiceTransfer,
// que este componente llama via onSubmitTransfer, sin duplicar logica).
// Si el traslado no se puede hacer (stock insuficiente, categoria sin
// stock en el potrero, etc.) sale un modal informativo prolijo en vez de
// un mensaje suelto -- pedido explicito, para que quede bien claro por
// que no se hizo.
type AgroVoiceSectionProps = {
  establishments: Establishment[];
  fields: FieldUnit[];
  onSubmitTransfer: (
    transfer: VoiceTransferReady,
    quantity: number
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  onSubmitBirth: (birth: VoiceBirthReady) => Promise<{ ok: true } | { ok: false; message: string }>;
  // Para el comando de voz "resumen" (29/09/2026, pedido explicito): stock
  // actual (misma cuenta que ya usa AgroHomePage, ver stockBalanceMap),
  // mas sanidad/contabilidad del mes actual en ese potrero.
  stockBalanceMap: Map<string, number>;
  sanitaryRecords: SanitaryRecord[];
  accountingEntries: AccountingEntry[];
};

type SummaryAnimalRow = {
  species: AgroSpecies;
  categoryCode: string;
  categoryLabel: string;
  quantity: number;
  ug: number;
};

type SummaryMoneyTotals = {
  currency: MoneyCurrency;
  income: number;
  expense: number;
};

// Fila de la lista "Movimientos por voz de esta sesion" -- soporta
// traslado (con destino) y nacimiento (sin destino, ver "destination").
type ConfirmedVoiceRow = {
  id: string;
  date: string;
  kind: "transfer" | "birth";
  origin: { establishment: Establishment; field: FieldUnit };
  destination: { establishment: Establishment; field: FieldUnit } | null;
  quantity: number;
  species: AgroSpecies;
  categoryLabel: string;
};

// Tipado minimo de la Web Speech API (todavia no forma parte de las libs
// estandar de TypeScript) -- solo lo que este componente usa.
type SpeechRecognitionAlternativeLike = { transcript: string };
// "isFinal": Chrome corta sola la escucha apenas detecta silencio, pero
// Safari/iOS no lo hace de forma confiable (pedido explicito, 23/09/2026:
// "mi cliente tiene iPhone... le pide que pare, sigue escuchando") -- por
// eso se pide interimResults y se corta a mano con un timer propio (ver
// SILENCE_TIMEOUT_MS mas abajo), en vez de confiar en que el navegador
// avise solo.
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike> & { isFinal: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

// Sin palabras nuevas durante este tiempo, se da la frase por terminada
// (ver el timer de silencio propio en handleStartListening). Subido de
// 2500 a 3800 (pedido explicito, 29/09/2026: "demora un microsegundo en
// hablar y se corta... hablar sin parar"): con continuous=true (ver mas
// abajo) este timer propio es el UNICO que decide cuando termino la
// frase, asi que ahora sí importa cuanto vale.
const SILENCE_TIMEOUT_MS = 3800;
// Tope duro por si nunca hay un hueco de silencio.
const MAX_LISTENING_TIMEOUT_MS = 15000;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

// Ejemplo de la pantalla (22/09/2026, pedido explicito): en vez de un
// string suelto, un array de "partes" para poder resaltar las palabras
// clave estructurales (Traslado, a, del potrero, al potrero, cantidad)
// distinto de los datos (nombres, numero, categoria) -- ver ExamplePart
// y el render mas abajo.
type ExamplePart = { text: string; keyword: boolean };

// "de" antes de un nombre que arranca con articulo se dice contraido
// ("del Ombú"), salvo "la/las" que no se contrae ("de la Milagrosa"). "a"
// nunca se contrae. Se usa para armar el ejemplo tal como se diria en voz
// alta (y que ademas el parser lo entienda igual).
function spokenEstablishmentParts(name: string, precedingWord: "de" | "a"): ExamplePart[] {
  if (precedingWord === "a") return [{ text: "a", keyword: true }, { text: ` ${name}`, keyword: false }];
  if (/^el\s/i.test(name)) return [{ text: "del", keyword: true }, { text: ` ${name.slice(3)}`, keyword: false }];
  if (/^los\s/i.test(name)) return [{ text: "de los", keyword: true }, { text: ` ${name.slice(4)}`, keyword: false }];
  if (/^las\s/i.test(name)) return [{ text: "de las", keyword: true }, { text: ` ${name.slice(4)}`, keyword: false }];
  if (/^la\s/i.test(name)) return [{ text: "de la", keyword: true }, { text: ` ${name.slice(3)}`, keyword: false }];
  return [{ text: "de", keyword: true }, { text: ` ${name}`, keyword: false }];
}

// Pedido explicito (22/09/2026): mostrar un ejemplo con datos que existan
// de verdad (no inventados), para poder leerlo y probarlo tal cual.
function buildExampleParts(establishments: Establishment[], fields: FieldUnit[]): ExamplePart[] | null {
  const origin = establishments.find((establishment) => fields.some((field) => field.establishmentId === establishment.id));
  if (!origin) return null;

  const destination =
    establishments.find(
      (establishment) => establishment.id !== origin.id && fields.some((field) => field.establishmentId === establishment.id)
    ) ?? origin;

  const originField = fields.find((field) => field.establishmentId === origin.id);
  const destinationField = fields.find(
    (field) => field.establishmentId === destination.id && field.id !== originField?.id
  ) ?? fields.find((field) => field.establishmentId === destination.id);

  if (!originField || !destinationField) return null;

  const category = categoryCatalog.vacunos[0];
  const categoryLabel = category ? formatCategoryLabel(category.label) : "vacas de cria";

  return [
    { text: "Traslado", keyword: true },
    { text: " ", keyword: false },
    ...spokenEstablishmentParts(origin.name, "de"),
    { text: " ", keyword: false },
    ...spokenEstablishmentParts(destination.name, "a"),
    { text: ", ", keyword: false },
    { text: "del potrero", keyword: true },
    { text: ` ${originField.name} `, keyword: false },
    { text: "al potrero", keyword: true },
    { text: ` ${destinationField.name}, `, keyword: false },
    { text: "cantidad", keyword: true },
    { text: ` 5, ${categoryLabel}.`, keyword: false }
  ];
}

// Mismo criterio que buildExampleParts, para "nacimiento" (29/09/2026): no
// pide categoria (se infiere sola de la especie). "del campo" es una
// muletilla fija que el parser sabe sacar -- no hace falta la contraccion
// de articulo de spokenEstablishmentParts aca.
function buildBirthExampleParts(establishments: Establishment[], fields: FieldUnit[]): ExamplePart[] | null {
  const establishment = establishments.find((item) => fields.some((field) => field.establishmentId === item.id));
  if (!establishment) return null;
  const field = fields.find((item) => item.establishmentId === establishment.id);
  if (!field) return null;

  return [
    { text: "Nacimiento", keyword: true },
    { text: " ", keyword: false },
    { text: "del campo", keyword: true },
    { text: ` ${establishment.name} `, keyword: false },
    { text: "potrero", keyword: true },
    { text: ` ${field.name}, `, keyword: false },
    { text: "cantidad", keyword: true },
    { text: " 3, vacunos.", keyword: false }
  ];
}

// Mismo criterio, para "resumen" (29/09/2026).
function buildSummaryExampleParts(establishments: Establishment[], fields: FieldUnit[]): ExamplePart[] | null {
  const establishment = establishments.find((item) => fields.some((field) => field.establishmentId === item.id));
  if (!establishment) return null;
  const field = fields.find((item) => item.establishmentId === establishment.id);
  if (!field) return null;

  return [
    { text: "Resumen", keyword: true },
    { text: " ", keyword: false },
    { text: "del campo", keyword: true },
    { text: ` ${establishment.name} `, keyword: false },
    { text: "potrero", keyword: true },
    { text: ` ${field.name}.`, keyword: false }
  ];
}

type VoiceExampleKind = "traslado" | "nacimiento" | "resumen";

const VOICE_EXAMPLE_LABELS: Record<VoiceExampleKind, string> = {
  traslado: "Traslado",
  nacimiento: "Nacimiento",
  resumen: "Resumen"
};

export function AgroVoiceSection({
  establishments,
  fields,
  onSubmitTransfer,
  onSubmitBirth,
  stockBalanceMap,
  sanitaryRecords,
  accountingEntries
}: AgroVoiceSectionProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ tone: "info" | "warning" | "error"; text: string } | null>(null);
  // "draft" reemplaza al viejo "pendingTransfer" (28/09/2026, pedido
  // explicito: "sin importar si falta algo al principio o al final, que
  // pueda seguir y completar"). Antes, si algo de la frase no se
  // reconocia, se descartaba TODO y habia que repetir de cero. Ahora
  // parseVoiceTransferCommand devuelve lo que SI se entendio (aunque sea
  // parcial) en `slots`, y el modal completa a mano solo lo que falta --
  // nunca se pierde lo que ya se dijo bien.
  const [draft, setDraft] = useState<VoiceTransferSlots | null>(null);
  // La parte que mas se confunde el reconocimiento de voz es un numero
  // dicho solo (pedido explicito: "dije 5 y entendio 95... dije 5 y
  // entendio 35") -- por eso la cantidad se puede corregir a mano antes de
  // confirmar, sin tener que repetir toda la frase de nuevo.
  const [editedQuantity, setEditedQuantity] = useState("");
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedVoiceRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Modal informativo (pedido explicito, 26/09/2026): en vez de un mensaje
  // suelto cuando el traslado no se puede hacer, un modal prolijo como el
  // de confirmar, explicando el motivo.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  // Comando "resumen" (29/09/2026, pedido explicito). summaryDraft es igual
  // de espiritu que "draft" para traslado: lo que se entendio, completando
  // a mano en un modal lo que falte. activeSummary es el combo ya resuelto
  // (campo + potrero) que efectivamente se muestra debajo.
  const [summaryDraft, setSummaryDraft] = useState<VoiceSummarySlots | null>(null);
  const [activeSummary, setActiveSummary] = useState<{ establishment: Establishment; field: FieldUnit } | null>(null);
  // Comando "nacimiento" (29/09/2026, pedido explicito) -- mismo espiritu
  // que "draft" para traslado, pero sin categoria (se infiere sola).
  const [birthDraft, setBirthDraft] = useState<VoiceBirthSlots | null>(null);
  const [editedBirthQuantity, setEditedBirthQuantity] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const maxListeningTimeoutRef = useRef<number | null>(null);
  const heardSoFarRef = useRef("");
  const hadErrorRef = useRef(false);

  // Selector de ejemplo (29/09/2026, pedido explicito): en vez de mostrar
  // siempre el ejemplo de traslado, se elige de un desplegable cual
  // comando ver -- asi entran los 7 que se vayan armando sin amontonar
  // texto en la pantalla.
  const [selectedExampleKind, setSelectedExampleKind] = useState<VoiceExampleKind>("traslado");
  const transferExampleParts = useMemo(() => buildExampleParts(establishments, fields), [establishments, fields]);
  const birthExampleParts = useMemo(() => buildBirthExampleParts(establishments, fields), [establishments, fields]);
  const summaryExampleParts = useMemo(() => buildSummaryExampleParts(establishments, fields), [establishments, fields]);
  const exampleParts =
    selectedExampleKind === "traslado"
      ? transferExampleParts
      : selectedExampleKind === "nacimiento"
        ? birthExampleParts
        : summaryExampleParts;

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  // Si se sale de esta pestana con el microfono abierto, se corta y se
  // limpian los timers -- que no quede escuchando de fondo en otra
  // pantalla de Agro.
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current !== null) window.clearTimeout(silenceTimeoutRef.current);
      if (maxListeningTimeoutRef.current !== null) window.clearTimeout(maxListeningTimeoutRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  function clearListeningTimers() {
    if (silenceTimeoutRef.current !== null) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (maxListeningTimeoutRef.current !== null) {
      window.clearTimeout(maxListeningTimeoutRef.current);
      maxListeningTimeoutRef.current = null;
    }
  }

  function handleStartListening() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setIsSupported(false);
      return;
    }

    setStatusMessage(null);
    setTranscript("");
    heardSoFarRef.current = "";
    hadErrorRef.current = false;

    const recognition = new Recognition();
    recognition.lang = "es-UY";
    // continuous=true (pedido explicito, 29/09/2026: se cortaba apenas
    // hacia una pausa minima al hablar, antes de que le diera tiempo a
    // terminar la frase) -- con false, Chrome corta solo apenas detecta
    // SU propia pausa (mucho mas corta que SILENCE_TIMEOUT_MS, fuera de
    // nuestro control). Con true, Chrome sigue escuchando entre pausas y
    // el UNICO que decide cuando termino la frase es nuestro propio timer
    // de silencio, de abajo.
    recognition.continuous = true;
    // interimResults=true: asi llegan avisos MIENTRAS la persona habla
    // (no solo al terminar), y se puede reiniciar el reloj de silencio
    // propio cada vez que hay actividad -- ver resetSilenceTimer.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Si no hay palabras nuevas en SILENCE_TIMEOUT_MS, se da la frase por
    // terminada y se corta a mano. MAX_LISTENING_TIMEOUT_MS es un tope
    // duro por si nunca hay un hueco de silencio (ruido de fondo
    // constante, etc.).
    function resetSilenceTimer() {
      if (silenceTimeoutRef.current !== null) window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = window.setTimeout(() => recognition.stop(), SILENCE_TIMEOUT_MS);
    }

    maxListeningTimeoutRef.current = window.setTimeout(() => recognition.stop(), MAX_LISTENING_TIMEOUT_MS);

    recognition.onresult = (event) => {
      // Llego algo (parcial o final): hubo actividad, se reinicia el
      // reloj de silencio.
      resetSilenceTimer();

      // Con continuous=true, event.results va acumulando TODOS los
      // pedazos de la sesion (los ya finalizados se quedan, el ultimo
      // puede seguir siendo parcial) -- se junta todo para mostrar/usar
      // la frase completa dicha hasta ahora, sin depender de que cada
      // pedazo se marque "final" (en algunos navegadores eso no es
      // confiable -- ver comentario mas arriba sobre iPhone).
      let combined = "";
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i]?.[0]?.transcript ?? "";
        if (text.trim()) combined += (combined ? " " : "") + text.trim();
      }
      heardSoFarRef.current = combined;
      setTranscript(combined);
    };

    recognition.onerror = (event) => {
      hadErrorRef.current = true;
      clearListeningTimers();
      setIsListening(false);
      if (event.error === "no-speech") {
        setStatusMessage({ tone: "warning", text: "No se escucho nada. Proba de nuevo." });
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatusMessage({ tone: "error", text: "No se dio permiso para usar el microfono." });
      } else {
        setStatusMessage({ tone: "error", text: `No se pudo escuchar (${event.error}).` });
      }
    };

    recognition.onend = () => {
      clearListeningTimers();
      setIsListening(false);
      if (!hadErrorRef.current && heardSoFarRef.current.trim()) {
        handleTranscript(heardSoFarRef.current);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function handleStopListening() {
    clearListeningTimers();
    recognitionRef.current?.stop();
  }

  function handleTranscript(heard: string) {
    if (!heard.trim()) return;

    const transferResult = parseVoiceTransferCommand(heard, { establishments, fields, categoryCatalog });
    if (transferResult.status !== "no_intent") {
      setStatusMessage(null);
      setActiveSummary(null);

      if (transferResult.status === "ready") {
        setDraft({
          originEstablishment: transferResult.origin.establishment,
          originField: transferResult.origin.field,
          destinationEstablishment: transferResult.destination.establishment,
          destinationField: transferResult.destination.field,
          quantity: transferResult.quantity,
          species: transferResult.species,
          category: transferResult.category
        });
        setEditedQuantity(String(transferResult.quantity));
        return;
      }

      // "partial": se guarda tal cual lo que se entendio -- los campos en
      // null se completan a mano en el modal (ver mas abajo).
      setDraft(transferResult.slots);
      setEditedQuantity(transferResult.slots.quantity ? String(transferResult.slots.quantity) : "");
      return;
    }

    const birthResult = parseVoiceBirthCommand(heard, { establishments, fields, categoryCatalog });
    if (birthResult.status !== "no_intent") {
      setStatusMessage(null);
      setActiveSummary(null);

      if (birthResult.status === "ready") {
        setBirthDraft({
          establishment: birthResult.establishment,
          field: birthResult.field,
          quantity: birthResult.quantity,
          species: birthResult.species
        });
        setEditedBirthQuantity(String(birthResult.quantity));
        return;
      }

      setBirthDraft(birthResult.slots);
      setEditedBirthQuantity(birthResult.slots.quantity ? String(birthResult.slots.quantity) : "");
      return;
    }

    const summaryResult = parseVoiceSummaryCommand(heard, { establishments, fields });
    if (summaryResult.status !== "no_intent") {
      setStatusMessage(null);
      setDraft(null);

      if (summaryResult.status === "ready") {
        setActiveSummary({ establishment: summaryResult.establishment, field: summaryResult.field });
        setSummaryDraft(null);
        return;
      }

      setSummaryDraft(summaryResult.slots);
      return;
    }

    setStatusMessage({
      tone: "info",
      text: "No empezo con \"traslado\", \"nacimiento\" ni \"resumen\", asi que no se interpreto nada."
    });
  }

  function updateSummaryDraft(patch: Partial<VoiceSummarySlots>) {
    setSummaryDraft((current) => (current ? { ...current, ...patch } : current));
  }

  const isSummaryDraftComplete = Boolean(summaryDraft?.establishment && summaryDraft?.field);
  const summaryDraftFieldOptions = summaryDraft?.establishment
    ? fields.filter((field) => field.establishmentId === summaryDraft.establishment!.id)
    : fields;

  function handleConfirmSummaryDraft() {
    if (!summaryDraft || !isSummaryDraftComplete) return;
    setActiveSummary({ establishment: summaryDraft.establishment!, field: summaryDraft.field! });
    setSummaryDraft(null);
  }

  function handleCancelSummaryDraft() {
    setSummaryDraft(null);
  }

  function updateBirthDraft(patch: Partial<VoiceBirthSlots>) {
    setBirthDraft((current) => (current ? { ...current, ...patch } : current));
  }

  const parsedEditedBirthQuantity = Number(editedBirthQuantity.replace(",", "."));
  const isEditedBirthQuantityValid = Number.isFinite(parsedEditedBirthQuantity) && parsedEditedBirthQuantity > 0;
  const isBirthDraftComplete = Boolean(birthDraft?.establishment && birthDraft?.field && birthDraft?.species);
  const birthDraftFieldOptions = birthDraft?.establishment
    ? fields.filter((field) => field.establishmentId === birthDraft.establishment!.id)
    : fields;

  async function handleConfirmBirth() {
    if (!birthDraft || !isBirthDraftComplete || !isEditedBirthQuantityValid || isSubmitting) return;

    const category = categoryCatalog[birthDraft.species!].find((item) => item.code === BIRTH_CATEGORY_CODE[birthDraft.species!]);
    if (!category) return;

    const readyBirth: VoiceBirthReady = {
      status: "ready",
      establishment: birthDraft.establishment!,
      field: birthDraft.field!,
      quantity: parsedEditedBirthQuantity,
      species: birthDraft.species!,
      category
    };

    setIsSubmitting(true);
    const result = await onSubmitBirth(readyBirth);
    setIsSubmitting(false);

    if (!result.ok) {
      setBirthDraft(null);
      setBlockedMessage(result.message);
      return;
    }

    const row: ConfirmedVoiceRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: getTodayDate(),
      kind: "birth",
      origin: { establishment: readyBirth.establishment, field: readyBirth.field },
      destination: null,
      quantity: parsedEditedBirthQuantity,
      species: readyBirth.species,
      categoryLabel: formatCategoryLabel(readyBirth.category.label)
    };

    setConfirmedRows((current) => [row, ...current]);
    setBirthDraft(null);
    setTranscript("");
  }

  function handleCancelBirth() {
    if (isSubmitting) return;
    setBirthDraft(null);
  }

  // Datos del resumen (29/09/2026): animales = stock actual (sin filtro de
  // fecha, es una foto de HOY); sanidad y contabilidad se acotan al mes
  // calendario actual (pedido explicito: "traemos los del mes actual...
  // luego podemos hacer mejoras tipo ingresar fecha").
  const currentMonthRange = useMemo(() => {
    const today = getTodayDate();
    return getMonthDateRange(today.slice(0, 4), today.slice(5, 7));
  }, []);

  const summaryAnimalRows = useMemo((): SummaryAnimalRow[] => {
    if (!activeSummary) return [];
    const prefix = `${activeSummary.field.id}:`;
    const rows: SummaryAnimalRow[] = [];

    for (const [key, quantity] of stockBalanceMap.entries()) {
      if (!key.startsWith(prefix) || quantity <= 0) continue;
      const [, species, categoryCode] = key.split(":") as [string, AgroSpecies, string];
      const category = categoryCatalog[species]?.find((item) => item.code === categoryCode);
      if (!category) continue;
      rows.push({
        species,
        categoryCode,
        categoryLabel: formatCategoryLabel(category.label),
        quantity,
        ug: quantity * category.ug
      });
    }

    return rows.sort((a, b) => a.species.localeCompare(b.species) || a.categoryLabel.localeCompare(b.categoryLabel));
  }, [activeSummary, stockBalanceMap]);

  const summaryTotalHeads = summaryAnimalRows.reduce((sum, row) => sum + row.quantity, 0);
  const summaryTotalUg = summaryAnimalRows.reduce((sum, row) => sum + row.ug, 0);

  const summarySanitaryRecords = useMemo(() => {
    if (!activeSummary) return [];
    return sanitaryRecords
      .filter(
        (record) =>
          record.fieldId === activeSummary.field.id &&
          isDateWithinRange(record.date, currentMonthRange.startDate, currentMonthRange.endDate)
      )
      .sort(compareRecordsByDateDesc);
  }, [activeSummary, currentMonthRange, sanitaryRecords]);

  const summaryMoneyTotals = useMemo((): SummaryMoneyTotals[] => {
    if (!activeSummary) return [];
    const byCurrency = new Map<MoneyCurrency, SummaryMoneyTotals>();

    for (const entry of accountingEntries) {
      if (entry.fieldId !== activeSummary.field.id) continue;
      if (!isDateWithinRange(entry.date, currentMonthRange.startDate, currentMonthRange.endDate)) continue;

      const totals = byCurrency.get(entry.currency) ?? { currency: entry.currency, income: 0, expense: 0 };
      if (entry.type === "income") {
        totals.income += entry.netAmount;
      } else {
        totals.expense += entry.netAmount;
      }
      byCurrency.set(entry.currency, totals);
    }

    return [...byCurrency.values()];
  }, [accountingEntries, activeSummary, currentMonthRange]);

  function updateDraft(patch: Partial<VoiceTransferSlots>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  const parsedEditedQuantity = Number(editedQuantity.replace(",", "."));
  const isEditedQuantityValid = Number.isFinite(parsedEditedQuantity) && parsedEditedQuantity > 0;
  const isDraftComplete = Boolean(
    draft &&
      draft.originEstablishment &&
      draft.originField &&
      draft.destinationEstablishment &&
      draft.destinationField &&
      draft.species &&
      draft.category
  );

  // Campos disponibles para elegir a mano: si ya se sabe el establecimiento
  // (por voz o porque se acaba de elegir), se filtra a los potreros de ese
  // establecimiento -- si todavia no se sabe, se dejan todos (recien se
  // acotan cuando se elija el establecimiento).
  const originFieldOptions = draft?.originEstablishment
    ? fields.filter((field) => field.establishmentId === draft.originEstablishment!.id)
    : fields;
  const destinationFieldOptions = draft?.destinationEstablishment
    ? fields.filter((field) => field.establishmentId === draft.destinationEstablishment!.id)
    : fields;
  const categoryOptionsForSpecies = draft?.species ? categoryCatalog[draft.species] : [];

  async function handleConfirmTransfer() {
    if (!draft || !isDraftComplete || !isEditedQuantityValid || isSubmitting) return;

    const readyTransfer: VoiceTransferReady = {
      status: "ready",
      origin: { establishment: draft.originEstablishment!, field: draft.originField! },
      destination: { establishment: draft.destinationEstablishment!, field: draft.destinationField! },
      quantity: parsedEditedQuantity,
      species: draft.species!,
      category: draft.category!
    };

    setIsSubmitting(true);
    const result = await onSubmitTransfer(readyTransfer, parsedEditedQuantity);
    setIsSubmitting(false);

    if (!result.ok) {
      // El traslado no se hizo -- modal informativo con el motivo (mismas
      // validaciones que el formulario manual: stock, categoria, etc.). El
      // modal de confirmacion se cierra: para reintentar, se vuelve a
      // hablar (asi se puede corregir cantidad/categoria/potrero).
      setDraft(null);
      setBlockedMessage(result.message);
      return;
    }

    const row: ConfirmedVoiceRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: getTodayDate(),
      kind: "transfer",
      origin: readyTransfer.origin,
      destination: readyTransfer.destination,
      quantity: parsedEditedQuantity,
      species: readyTransfer.species,
      categoryLabel: formatCategoryLabel(readyTransfer.category.label)
    };

    setConfirmedRows((current) => [row, ...current]);
    setDraft(null);
    setTranscript("");
  }

  function handleCancelTransfer() {
    if (isSubmitting) return;
    setDraft(null);
  }

  function handleRemoveRow(id: string) {
    setConfirmedRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <>
      <article className="panel wide voice-banner">
        <div className="panel-header">
          <div>
            <h2>🎙️ Voz</h2>
          </div>
        </div>

        <div className="voice-example-picker">
          <label htmlFor="voice-example-select">Ejemplo</label>
          <select
            id="voice-example-select"
            value={selectedExampleKind}
            onChange={(event) => setSelectedExampleKind(event.target.value as VoiceExampleKind)}
          >
            {(Object.keys(VOICE_EXAMPLE_LABELS) as VoiceExampleKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {VOICE_EXAMPLE_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        {exampleParts ? (
          <p className="voice-example">
            Decí: <em>"{exampleParts.map((part, index) => (part.keyword ? <span key={index} className="voice-keyword">{part.text}</span> : <span key={index}>{part.text}</span>))}"</em>
          </p>
        ) : null}

        {!isSupported ? (
          <p className="voice-status voice-status-error">
            Este navegador no tiene reconocimiento de voz disponible. Proba con Chrome o Edge.
          </p>
        ) : (
          <div className="voice-controls">
            <button
              type="button"
              className={isListening ? "primary-button voice-mic-button is-listening" : "primary-button voice-mic-button"}
              onClick={isListening ? handleStopListening : handleStartListening}
            >
              {isListening ? "🎤 Escuchando... (tocar para parar)" : "🎤 Hablar"}
            </button>
            {transcript ? (
              <p className="voice-transcript">
                Se escucho: <strong>"{transcript}"</strong>
              </p>
            ) : null}
            {statusMessage ? <p className={`voice-status voice-status-${statusMessage.tone}`}>{statusMessage.text}</p> : null}
          </div>
        )}
      </article>

      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Movimientos por voz de esta sesion</h2>
            <p>
              Ya quedaron guardados de verdad (se ven tambien en "Animales"). Esta lista es solo un repaso rapido y se
              pierde al recargar la pagina.
            </p>
          </div>
          {confirmedRows.length ? (
            <div className="table-actions">
              <button type="button" className="ghost-button" onClick={() => setConfirmedRows([])}>
                Vaciar
              </button>
            </div>
          ) : null}
        </div>
        <div className="table-wrap">
          <table className="animal-ledger-table">
            <thead>
              <tr>
                <th className="cell-date">Fecha</th>
                <th className="cell-kind">Motivo</th>
                <th className="cell-field">Origen</th>
                <th className="cell-field">Destino</th>
                <th className="cell-category">Categoria</th>
                <th className="cell-number">Cantidad</th>
                <th className="cell-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {confirmedRows.length ? (
                confirmedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatShortDate(row.date)}</td>
                    <td>{row.kind === "transfer" ? "Traslado (voz)" : "Nacimiento (voz)"}</td>
                    <td>
                      {row.origin.establishment.name} / {row.origin.field.name}
                    </td>
                    <td>
                      {row.destination ? `${row.destination.establishment.name} / ${row.destination.field.name}` : "-"}
                    </td>
                    <td>
                      {speciesLabels[row.species]} · {row.categoryLabel}
                    </td>
                    <td className="cell-number">{row.quantity}</td>
                    <td className="cell-actions">
                      <button type="button" className="ghost-button danger" onClick={() => handleRemoveRow(row.id)}>
                        Quitar de esta lista
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="cell-empty" colSpan={7}>
                    Todavia no hiciste ningun movimiento por voz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {activeSummary ? (
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <h2>
                Resumen · {activeSummary.establishment.name} / {activeSummary.field.name}
              </h2>
              <p>Sanidad y contabilidad son del mes actual. Animales es el stock de hoy.</p>
            </div>
            <div className="table-actions">
              <button type="button" className="ghost-button" onClick={() => setActiveSummary(null)}>
                Cerrar
              </button>
            </div>
          </div>

          <div className="voice-summary-section">
            <h3>Animales</h3>
            {summaryAnimalRows.length ? (
              <div className="table-wrap">
                <table className="animal-ledger-table">
                  <thead>
                    <tr>
                      <th>Especie</th>
                      <th>Categoria</th>
                      <th className="cell-number">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryAnimalRows.map((row) => (
                      <tr key={`${row.species}-${row.categoryCode}`}>
                        <td>{speciesLabels[row.species]}</td>
                        <td>{row.categoryLabel}</td>
                        <td className="cell-number">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="voice-status voice-status-info">No hay animales en este potrero.</p>
            )}
            {summaryAnimalRows.length ? (
              <p className="voice-summary-totals">
                Total: {summaryTotalHeads} cabeza(s) · {summaryTotalUg.toFixed(1)} UG
              </p>
            ) : null}
          </div>

          <div className="voice-summary-section">
            <h3>Sanidad (mes actual)</h3>
            {summarySanitaryRecords.length ? (
              <div className="table-wrap">
                <table className="animal-ledger-table">
                  <thead>
                    <tr>
                      <th className="cell-date">Fecha</th>
                      <th>Categoria</th>
                      <th className="cell-number">Cantidad</th>
                      <th>Tratamiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summarySanitaryRecords.map((record) => {
                      const category = categoryCatalog[record.species]?.find((item) => item.code === record.categoryCode);
                      return (
                        <tr key={record.id}>
                          <td>{formatShortDate(record.date)}</td>
                          <td>
                            {speciesLabels[record.species]} · {category ? formatCategoryLabel(category.label) : record.categoryCode}
                          </td>
                          <td className="cell-number">{record.quantity}</td>
                          <td>{record.treatment}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="voice-status voice-status-info">No hay tratamientos de sanidad este mes en este potrero.</p>
            )}
          </div>

          <div className="voice-summary-section">
            <h3>Contabilidad (mes actual)</h3>
            {summaryMoneyTotals.length ? (
              <div className="table-wrap">
                <table className="animal-ledger-table">
                  <thead>
                    <tr>
                      <th>Moneda</th>
                      <th className="cell-number">Ingresos</th>
                      <th className="cell-number">Egresos</th>
                      <th className="cell-number">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryMoneyTotals.map((totals) => (
                      <tr key={totals.currency}>
                        <td>{totals.currency}</td>
                        <td className="cell-number">{formatMoney(totals.income, totals.currency)}</td>
                        <td className="cell-number">{formatMoney(totals.expense, totals.currency)}</td>
                        <td className="cell-number">{formatMoney(totals.income - totals.expense, totals.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="voice-status voice-status-info">No hay movimientos contables este mes en este potrero.</p>
            )}
          </div>
        </article>
      ) : null}

      {summaryDraft ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="voice-summary-confirm-title">
            <div className="confirm-modal-copy">
              <strong id="voice-summary-confirm-title">¿Ver resumen de que potrero?</strong>
              <span>Entendi parte de la frase -- completa lo que falta antes de continuar.</span>
            </div>
            <div className="voice-confirm-summary">
              <label className="voice-confirm-field">
                <span>Campo</span>
                {summaryDraft.establishment ? (
                  <strong>{summaryDraft.establishment.name}</strong>
                ) : (
                  <select
                    value=""
                    onChange={(event) => {
                      const establishment = establishments.find((item) => item.id === event.target.value) ?? null;
                      updateSummaryDraft({ establishment, field: null });
                    }}
                  >
                    <option value="">Elegir...</option>
                    {establishments.map((establishment) => (
                      <option key={establishment.id} value={establishment.id}>
                        {establishment.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="voice-confirm-field">
                <span>Potrero</span>
                {summaryDraft.field ? (
                  <strong>{summaryDraft.field.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={!summaryDraft.establishment}
                    onChange={(event) => {
                      const field = summaryDraftFieldOptions.find((item) => item.id === event.target.value) ?? null;
                      updateSummaryDraft({ field });
                    }}
                  >
                    <option value="">{summaryDraft.establishment ? "Elegir..." : "Elegi el campo primero"}</option>
                    {summaryDraftFieldOptions.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
            <div className="action-row">
              <button type="button" className="ghost-button" onClick={handleCancelSummaryDraft}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!isSummaryDraftComplete}
                onClick={handleConfirmSummaryDraft}
              >
                Ver resumen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {birthDraft ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="voice-birth-confirm-title">
            <div className="confirm-modal-copy">
              <strong id="voice-birth-confirm-title">¿Confirmar nacimiento?</strong>
              <span>
                {isBirthDraftComplete
                  ? "Se va a guardar de verdad, igual que cargarlo a mano desde \"Animales\"."
                  : "Entendi parte de la frase -- completa lo que falta antes de confirmar."}
              </span>
            </div>
            <div className="voice-confirm-summary">
              <label className="voice-confirm-field">
                <span>Campo</span>
                {birthDraft.establishment ? (
                  <strong>{birthDraft.establishment.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const establishment = establishments.find((item) => item.id === event.target.value) ?? null;
                      updateBirthDraft({ establishment, field: null });
                    }}
                  >
                    <option value="">Elegir...</option>
                    {establishments.map((establishment) => (
                      <option key={establishment.id} value={establishment.id}>
                        {establishment.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="voice-confirm-field">
                <span>Potrero</span>
                {birthDraft.field ? (
                  <strong>{birthDraft.field.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting || !birthDraft.establishment}
                    onChange={(event) => {
                      const field = birthDraftFieldOptions.find((item) => item.id === event.target.value) ?? null;
                      updateBirthDraft({ field });
                    }}
                  >
                    <option value="">{birthDraft.establishment ? "Elegir..." : "Elegi el campo primero"}</option>
                    {birthDraftFieldOptions.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="voice-confirm-quantity-field">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editedBirthQuantity}
                  onChange={(event) => setEditedBirthQuantity(event.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </label>
              {!isEditedBirthQuantityValid ? <p className="voice-status voice-status-error">Ingresa una cantidad valida mayor a 0.</p> : null}

              <label className="voice-confirm-field">
                <span>Especie</span>
                {birthDraft.species ? (
                  <strong>{speciesLabels[birthDraft.species]}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const species = (event.target.value || null) as AgroSpecies | null;
                      updateBirthDraft({ species });
                    }}
                  >
                    <option value="">Elegir...</option>
                    {(Object.keys(speciesLabels) as AgroSpecies[]).map((species) => (
                      <option key={species} value={species}>
                        {speciesLabels[species]}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
            <div className="action-row">
              <button type="button" className="ghost-button" onClick={handleCancelBirth} disabled={isSubmitting}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!isBirthDraftComplete || !isEditedBirthQuantityValid || isSubmitting}
                onClick={() => void handleConfirmBirth()}
              >
                {isSubmitting ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="voice-confirm-title">
            <div className="confirm-modal-copy">
              <strong id="voice-confirm-title">¿Confirmar traslado?</strong>
              <span>
                {isDraftComplete
                  ? "Se va a guardar de verdad, igual que cargarlo a mano desde \"Animales\"."
                  : "Entendi parte de la frase -- completa lo que falta antes de confirmar."}
              </span>
            </div>
            <div className="voice-confirm-summary">
              <label className="voice-confirm-field">
                <span>Campo origen</span>
                {draft.originEstablishment ? (
                  <strong>{draft.originEstablishment.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const establishment = establishments.find((item) => item.id === event.target.value) ?? null;
                      updateDraft({ originEstablishment: establishment, originField: null });
                    }}
                  >
                    <option value="">Elegir...</option>
                    {establishments.map((establishment) => (
                      <option key={establishment.id} value={establishment.id}>
                        {establishment.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="voice-confirm-field">
                <span>Potrero origen</span>
                {draft.originField ? (
                  <strong>{draft.originField.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting || !draft.originEstablishment}
                    onChange={(event) => {
                      const field = originFieldOptions.find((item) => item.id === event.target.value) ?? null;
                      updateDraft({ originField: field });
                    }}
                  >
                    <option value="">{draft.originEstablishment ? "Elegir..." : "Elegi el campo primero"}</option>
                    {originFieldOptions.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <p className="voice-confirm-arrow">↓</p>

              <label className="voice-confirm-field">
                <span>Campo destino</span>
                {draft.destinationEstablishment ? (
                  <strong>{draft.destinationEstablishment.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const establishment = establishments.find((item) => item.id === event.target.value) ?? null;
                      updateDraft({ destinationEstablishment: establishment, destinationField: null });
                    }}
                  >
                    <option value="">Elegir...</option>
                    {establishments.map((establishment) => (
                      <option key={establishment.id} value={establishment.id}>
                        {establishment.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="voice-confirm-field">
                <span>Potrero destino</span>
                {draft.destinationField ? (
                  <strong>{draft.destinationField.name}</strong>
                ) : (
                  <select
                    value=""
                    disabled={isSubmitting || !draft.destinationEstablishment}
                    onChange={(event) => {
                      const field = destinationFieldOptions.find((item) => item.id === event.target.value) ?? null;
                      updateDraft({ destinationField: field });
                    }}
                  >
                    <option value="">{draft.destinationEstablishment ? "Elegir..." : "Elegi el campo primero"}</option>
                    {destinationFieldOptions.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="voice-confirm-quantity-field">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editedQuantity}
                  onChange={(event) => setEditedQuantity(event.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </label>
              {!isEditedQuantityValid ? <p className="voice-status voice-status-error">Ingresa una cantidad valida mayor a 0.</p> : null}

              <label className="voice-confirm-field">
                <span>Categoria</span>
                {draft.category ? (
                  <strong>{speciesLabels[draft.species!]} · {formatCategoryLabel(draft.category.label)}</strong>
                ) : (
                  <div className="voice-confirm-category-pickers">
                    <select
                      value={draft.species ?? ""}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        const species = (event.target.value || null) as AgroSpecies | null;
                        updateDraft({ species, category: null });
                      }}
                    >
                      <option value="">Especie...</option>
                      {(Object.keys(speciesLabels) as AgroSpecies[]).map((species) => (
                        <option key={species} value={species}>
                          {speciesLabels[species]}
                        </option>
                      ))}
                    </select>
                    <select
                      value=""
                      disabled={isSubmitting || !draft.species}
                      onChange={(event) => {
                        const category = categoryOptionsForSpecies.find((item) => item.code === event.target.value) ?? null;
                        updateDraft({ category });
                      }}
                    >
                      <option value="">{draft.species ? "Categoria..." : "Elegi la especie primero"}</option>
                      {categoryOptionsForSpecies.map((category) => (
                        <option key={category.code} value={category.code}>
                          {formatCategoryLabel(category.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </label>
            </div>
            <div className="action-row">
              <button type="button" className="ghost-button" onClick={handleCancelTransfer} disabled={isSubmitting}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!isDraftComplete || !isEditedQuantityValid || isSubmitting}
                onClick={handleConfirmTransfer}
              >
                {isSubmitting ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {blockedMessage ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="voice-blocked-title">
            <div className="confirm-modal-copy">
              <strong id="voice-blocked-title">No se pudo hacer el traslado</strong>
              <span>{blockedMessage}</span>
            </div>
            <div className="action-row">
              <button type="button" className="primary-button" onClick={() => setBlockedMessage(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
