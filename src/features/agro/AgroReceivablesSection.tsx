import { useState } from "react";
import { formatMoney, formatShortDate } from "./agro.home.shared";
import { AccountingEntry, Establishment } from "./agro.types";

interface AgroReceivablesSectionProps {
  establishments: Establishment[];
  receivableEntries: Array<AccountingEntry & { pendingAmount: number; isDue: boolean }>;
  onMarkEntryCollected: (entryId: string) => void;
  onPostponeEntryDueDate: (entryId: string, newDueDate: string) => void;
}

// Planilla simple, separada de la Contabilidad grande: solo ventas a
// plazo (tienen cliente + vencimiento cargados), pensada para responder
// una sola pregunta de un vistazo -- "quien me debe, cuanto, y desde
// cuando" -- sin tener que ir a buscarlo mezclado entre gastos, rubros y
// filtros de la planilla contable. Pedido explicito del cliente
// (12/09/2026).
export function AgroReceivablesSection({
  establishments,
  receivableEntries,
  onMarkEntryCollected,
  onPostponeEntryDueDate
}: AgroReceivablesSectionProps) {
  const [postponingEntryId, setPostponingEntryId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");

  function handleStartPostpone(entryId: string) {
    setPostponingEntryId(entryId);
    setPostponeDate("");
  }

  function handleCancelPostpone() {
    setPostponingEntryId(null);
    setPostponeDate("");
  }

  function handleConfirmPostpone(entryId: string) {
    if (!postponeDate) {
      return;
    }
    onPostponeEntryDueDate(entryId, postponeDate);
    setPostponingEntryId(null);
    setPostponeDate("");
  }

  const vencidas = receivableEntries.filter((entry) => entry.isDue);
  const aVencer = receivableEntries.filter((entry) => !entry.isDue);

  return (
    <section className="content-grid">
      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Cuentas por cobrar</h2>
            <p>Ventas a plazo con cliente y fecha de vencimiento cargados -- de todos los meses, no solo el visible.</p>
          </div>
        </div>

        <div className="inline-metrics">
          <span className="data-badge warning">Vencidas {vencidas.length}</span>
          <span className="data-badge">Por vencer {aVencer.length}</span>
        </div>

        {receivableEntries.length === 0 ? (
          <p className="empty-hint">
            Todavia no hay ninguna venta a plazo cargada con cliente y vencimiento. Se cargan desde Contabilidad, en un
            Ingreso.
          </p>
        ) : (
          <div className="receivables-list">
            {receivableEntries.map((entry) => {
              const establishment = establishments.find((item) => item.id === entry.establishmentId);
              return (
                <div key={entry.id} className={entry.isDue ? "receivable-card due" : "receivable-card"}>
                  <div className="receivable-card-main">
                    <strong>{entry.clientName}</strong>
                    <span className="receivable-card-concept">
                      {establishment?.name ?? "-"} · {formatMoney(entry.pendingAmount, entry.currency)} pendiente
                    </span>
                    {entry.notes ? <span className="receivable-card-notes">{entry.notes}</span> : null}
                  </div>

                  <div className="receivable-card-status">
                    {entry.isDue ? (
                      <span className="data-badge compact warning">Vencido {formatShortDate(entry.dueDate!)}</span>
                    ) : (
                      <span className="data-badge compact">Vence {formatShortDate(entry.dueDate!)}</span>
                    )}
                  </div>

                  {entry.isDue ? (
                    postponingEntryId === entry.id ? (
                      <div className="table-actions due-postpone-row">
                        <input type="date" value={postponeDate} onChange={(event) => setPostponeDate(event.target.value)} />
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!postponeDate}
                          onClick={() => handleConfirmPostpone(entry.id)}
                        >
                          Confirmar nueva fecha
                        </button>
                        <button type="button" className="ghost-button" onClick={handleCancelPostpone}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="table-actions due-actions-row">
                        <button type="button" className="ghost-button" onClick={() => onMarkEntryCollected(entry.id)}>
                          Pago
                        </button>
                        <button type="button" className="ghost-button danger" onClick={() => handleStartPostpone(entry.id)}>
                          Sigue en deuda
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
