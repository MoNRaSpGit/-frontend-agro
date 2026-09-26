import { useEffect, useMemo, useRef, useState } from "react";
import { formatCategoryLabel, formatShortDate, getTodayDate } from "./agro.home.shared";
import { AgroSpecies, Establishment, FieldUnit } from "./agro.types";
import { parseVoiceTransferCommand, VoiceTransferReady } from "./agro.voice";
import { categoryCatalog, speciesLabels } from "./agro.demo.data";

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
};

type ConfirmedTransferRow = {
  id: string;
  date: string;
  origin: { establishment: Establishment; field: FieldUnit };
  destination: { establishment: Establishment; field: FieldUnit };
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
// (ver el timer de silencio propio en handleStartListening).
const SILENCE_TIMEOUT_MS = 2500;
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

export function AgroVoiceSection({ establishments, fields, onSubmitTransfer }: AgroVoiceSectionProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ tone: "info" | "warning" | "error"; text: string } | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<VoiceTransferReady | null>(null);
  // La parte que mas se confunde el reconocimiento de voz es un numero
  // dicho solo (pedido explicito: "dije 5 y entendio 95... dije 5 y
  // entendio 35") -- por eso la cantidad se puede corregir a mano antes de
  // confirmar, sin tener que repetir toda la frase de nuevo.
  const [editedQuantity, setEditedQuantity] = useState("");
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedTransferRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Modal informativo (pedido explicito, 26/09/2026): en vez de un mensaje
  // suelto cuando el traslado no se puede hacer, un modal prolijo como el
  // de confirmar, explicando el motivo.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const maxListeningTimeoutRef = useRef<number | null>(null);

  const exampleParts = useMemo(() => buildExampleParts(establishments, fields), [establishments, fields]);

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

    const recognition = new Recognition();
    recognition.lang = "es-UY";
    recognition.continuous = false;
    // interimResults=true: asi llegan avisos MIENTRAS la persona habla
    // (no solo al terminar), y se puede reiniciar el reloj de silencio
    // propio cada vez que hay actividad -- ver resetSilenceTimer.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Si no hay palabras nuevas en SILENCE_TIMEOUT_MS, se da la frase por
    // terminada y se corta sola (en Chrome esto ya lo hace el navegador,
    // pero no hay que depender de eso -- ver el comentario en el tipo de
    // arriba). MAX_LISTENING_TIMEOUT_MS es un tope duro por si nunca hay
    // un hueco de silencio (ruido de fondo constante, etc.).
    function resetSilenceTimer() {
      if (silenceTimeoutRef.current !== null) window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = window.setTimeout(() => recognition.stop(), SILENCE_TIMEOUT_MS);
    }

    maxListeningTimeoutRef.current = window.setTimeout(() => recognition.stop(), MAX_LISTENING_TIMEOUT_MS);

    recognition.onresult = (event) => {
      // Llego algo (parcial o final): hubo actividad, se reinicia el
      // reloj de silencio.
      resetSilenceTimer();

      const lastResult = event.results[event.results.length - 1];
      if (!lastResult?.isFinal) return;

      clearListeningTimers();
      const heard = lastResult[0]?.transcript ?? "";
      setTranscript(heard);
      handleTranscript(heard);
    };

    recognition.onerror = (event) => {
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

    const result = parseVoiceTransferCommand(heard, { establishments, fields, categoryCatalog });

    if (result.status === "no_intent") {
      setStatusMessage({ tone: "info", text: "No empezo con \"traslado\", asi que no se interpreto nada." });
      return;
    }

    if (result.status === "incomplete") {
      setStatusMessage({ tone: "warning", text: result.message });
      return;
    }

    setStatusMessage(null);
    setPendingTransfer(result);
    setEditedQuantity(String(result.quantity));
  }

  const parsedEditedQuantity = Number(editedQuantity.replace(",", "."));
  const isEditedQuantityValid = Number.isFinite(parsedEditedQuantity) && parsedEditedQuantity > 0;

  async function handleConfirmTransfer() {
    if (!pendingTransfer || !isEditedQuantityValid || isSubmitting) return;

    setIsSubmitting(true);
    const result = await onSubmitTransfer(pendingTransfer, parsedEditedQuantity);
    setIsSubmitting(false);

    if (!result.ok) {
      // El traslado no se hizo -- modal informativo con el motivo (mismas
      // validaciones que el formulario manual: stock, categoria, etc.). El
      // modal de confirmacion se cierra: para reintentar, se vuelve a
      // hablar (asi se puede corregir cantidad/categoria/potrero).
      setPendingTransfer(null);
      setBlockedMessage(result.message);
      return;
    }

    const row: ConfirmedTransferRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: getTodayDate(),
      origin: pendingTransfer.origin,
      destination: pendingTransfer.destination,
      quantity: parsedEditedQuantity,
      species: pendingTransfer.species,
      categoryLabel: formatCategoryLabel(pendingTransfer.category.label)
    };

    setConfirmedRows((current) => [row, ...current]);
    setPendingTransfer(null);
    setTranscript("");
  }

  function handleCancelTransfer() {
    if (isSubmitting) return;
    setPendingTransfer(null);
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
            <p>
              <strong>Beta:</strong> interpreta una orden de traslado hablada y, si confirmas, la guarda de verdad,{" "}
              igual que cargarla a mano desde "Animales". Si la cantidad, la categoria o el potrero no tienen stock
              suficiente, no se guarda nada y se avisa por que.
            </p>
          </div>
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
            <h2>Traslados por voz de esta sesion</h2>
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
                    <td>Traslado (voz)</td>
                    <td>
                      {row.origin.establishment.name} / {row.origin.field.name}
                    </td>
                    <td>
                      {row.destination.establishment.name} / {row.destination.field.name}
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
                    Todavia no hiciste ningun traslado por voz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {pendingTransfer ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="voice-confirm-title">
            <div className="confirm-modal-copy">
              <strong id="voice-confirm-title">¿Confirmar traslado?</strong>
              <span>Se va a guardar de verdad, igual que cargarlo a mano desde "Animales".</span>
            </div>
            <div className="voice-confirm-summary">
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
                <span>{speciesLabels[pendingTransfer.species]} · {formatCategoryLabel(pendingTransfer.category.label)}</span>
              </label>
              {!isEditedQuantityValid ? <p className="voice-status voice-status-error">Ingresa una cantidad valida mayor a 0.</p> : null}
              <p className="voice-confirm-place">
                {pendingTransfer.origin.establishment.name} — Potrero {pendingTransfer.origin.field.name}
              </p>
              <p className="voice-confirm-arrow">↓</p>
              <p className="voice-confirm-place">
                {pendingTransfer.destination.establishment.name} — Potrero {pendingTransfer.destination.field.name}
              </p>
            </div>
            <div className="action-row">
              <button type="button" className="ghost-button" onClick={handleCancelTransfer} disabled={isSubmitting}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!isEditedQuantityValid || isSubmitting}
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
