import { useEffect, useMemo, useRef, useState } from "react";
import { formatCategoryLabel, formatShortDate, getTodayDate } from "./agro.home.shared";
import { AgroSpecies, Establishment, FieldUnit } from "./agro.types";
import { parseVoiceTransferCommand, VoiceTransferReady } from "./agro.voice";
import { categoryCatalog, speciesLabels } from "./agro.demo.data";

// Pestana "Voz" (22/09/2026, pedido explicito): SIMULACION VISUAL
// SOLAMENTE. Interpreta una orden de traslado hablada y, si el usuario
// confirma, agrega una fila a una tabla que vive SOLO en el estado de este
// componente (se pierde al recargar la pagina). En ningun momento se llama
// al backend ni se toca la app real -- los establecimientos/potreros que
// usa para reconocer son los mismos de la app (props, solo lectura), pero
// nunca se manda nada de vuelta.
type AgroVoiceSectionProps = {
  establishments: Establishment[];
  fields: FieldUnit[];
};

type SimulatedTransferRow = {
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
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
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

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

// "de" antes de un nombre que arranca con articulo se dice contraido
// ("del Ombú"), salvo "la/las" que no se contrae ("de la Milagrosa"). "a"
// nunca se contrae. Se usa para armar el ejemplo de la pantalla tal como
// se diria en voz alta (y que ademas el parser lo entienda igual).
function toSpokenEstablishmentPhrase(name: string, precedingWord: "de" | "a"): string {
  if (precedingWord === "a") return `a ${name}`;
  if (/^el\s/i.test(name)) return `del ${name.slice(3)}`;
  if (/^los\s/i.test(name)) return `de los ${name.slice(4)}`;
  if (/^las\s/i.test(name)) return `de las ${name.slice(4)}`;
  if (/^la\s/i.test(name)) return `de la ${name.slice(3)}`;
  return `de ${name}`;
}

// Pedido explicito (22/09/2026): mostrar un ejemplo con datos que existan
// de verdad (no inventados), para poder leerlo y probarlo tal cual.
function buildExamplePhrase(establishments: Establishment[], fields: FieldUnit[]): string | null {
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

  return `Traslado ${toSpokenEstablishmentPhrase(origin.name, "de")} ${toSpokenEstablishmentPhrase(destination.name, "a")}, del potrero ${originField.name} al potrero ${destinationField.name}, cantidad 5, ${categoryLabel}.`;
}

export function AgroVoiceSection({ establishments, fields }: AgroVoiceSectionProps) {
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
  const [simulatedRows, setSimulatedRows] = useState<SimulatedTransferRow[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const examplePhrase = useMemo(() => buildExamplePhrase(establishments, fields), [establishments, fields]);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

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
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(heard);
      handleTranscript(heard);
    };

    recognition.onerror = (event) => {
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
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function handleStopListening() {
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

  function handleConfirmTransfer() {
    if (!pendingTransfer || !isEditedQuantityValid) return;

    const row: SimulatedTransferRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: getTodayDate(),
      origin: pendingTransfer.origin,
      destination: pendingTransfer.destination,
      quantity: parsedEditedQuantity,
      species: pendingTransfer.species,
      categoryLabel: formatCategoryLabel(pendingTransfer.category.label)
    };

    setSimulatedRows((current) => [row, ...current]);
    setPendingTransfer(null);
    setTranscript("");
  }

  function handleCancelTransfer() {
    setPendingTransfer(null);
  }

  function handleRemoveRow(id: string) {
    setSimulatedRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <>
      <article className="panel wide voice-banner">
        <div className="panel-header">
          <div>
            <h2>🎙️ Voz</h2>
            <p>
              <strong>Beta / Simulacion:</strong> esta pestana interpreta ordenes de traslado habladas a modo de prueba.{" "}
              <strong>No guarda nada en la base de datos ni afecta al resto de la app.</strong> Los traslados reales se
              siguen cargando desde "Animales".
            </p>
          </div>
        </div>
        {examplePhrase ? (
          <p className="voice-example">
            Decí: <em>"{examplePhrase}"</em>
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
            <h2>Traslados simulados</h2>
            <p>Solo en esta pantalla, se pierden al recargar la pagina. Nunca se guardaron de verdad.</p>
          </div>
          {simulatedRows.length ? (
            <div className="table-actions">
              <button type="button" className="ghost-button" onClick={() => setSimulatedRows([])}>
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
              {simulatedRows.length ? (
                simulatedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatShortDate(row.date)}</td>
                    <td>Traslado (voz, simulado)</td>
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
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="cell-empty" colSpan={7}>
                    Todavia no probaste ningun traslado por voz.
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
              <span>Esto es solo una simulacion, no se va a guardar nada real.</span>
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
              <button type="button" className="ghost-button" onClick={handleCancelTransfer}>
                Cancelar
              </button>
              <button type="button" className="primary-button" disabled={!isEditedQuantityValid} onClick={handleConfirmTransfer}>
                Confirmar (simulado)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
