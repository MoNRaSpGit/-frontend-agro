import { useEffect, useRef, useState } from "react";
import { expenseConceptLabels, formatMoney, formatShortDate, getNetAmount, incomeConceptLabels } from "./agro.home.shared";
import { currencyLabels, fields } from "./agro.demo.data";
import { AccountingEntryType, ExpenseConcept, IncomeConcept, MoneyCurrency } from "./agro.types";

interface AgroAccountingSectionProps {
  accountingFormPanelRef: React.RefObject<HTMLElement | null>;
  accountingForm: {
    date: string;
    establishmentId: string;
    fieldId: string;
    type: AccountingEntryType;
    concept: IncomeConcept | ExpenseConcept;
    currency: MoneyCurrency;
    grossAmount: string;
    commissionAmount: string;
    taxAmount: string;
    notes: string;
  };
  accountingLedgerRows: any[];
  accountingSearchTerm: string;
  editingAccountingEntryId: string | null;
  projectedNet: number;
  requestDeleteAccountingEntry: (entryId: string) => void;
  resetAccountingForm: () => void;
  selectedEstablishmentId: string;
  setAccountingForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      establishmentId: string;
      fieldId: string;
      type: AccountingEntryType;
      concept: IncomeConcept | ExpenseConcept;
      currency: MoneyCurrency;
      grossAmount: string;
      commissionAmount: string;
      taxAmount: string;
      notes: string;
    }>
  >;
  setAccountingSearchTerm: (value: string) => void;
  visibleFields: { id: string; name: string; establishmentId: string }[];
  onEditEntry: (entryId: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function AgroAccountingSection({
  accountingFormPanelRef,
  accountingForm,
  accountingLedgerRows,
  accountingSearchTerm,
  editingAccountingEntryId,
  projectedNet,
  requestDeleteAccountingEntry,
  resetAccountingForm,
  setAccountingForm,
  setAccountingSearchTerm,
  visibleFields,
  onEditEntry,
  onSubmit
}: AgroAccountingSectionProps) {
  const accountingTableWrapRef = useRef<HTMLDivElement | null>(null);
  const accountingTableRef = useRef<HTMLTableElement | null>(null);
  const accountingTableScrollbarRef = useRef<HTMLDivElement | null>(null);
  const accountingTableScrollbarInnerRef = useRef<HTMLDivElement | null>(null);
  const syncingAccountingScrollRef = useRef<"table" | "bottom-bar" | null>(null);
  const [showAccountingFloatingScrollbar, setShowAccountingFloatingScrollbar] = useState(false);

  useEffect(() => {
    function syncAccountingScrollbarMetrics() {
      const tableWrap = accountingTableWrapRef.current;
      const table = accountingTableRef.current;
      const scrollbar = accountingTableScrollbarRef.current;
      const scrollbarInner = accountingTableScrollbarInnerRef.current;

      if (!tableWrap || !table || !scrollbar || !scrollbarInner) {
        return;
      }

      const hasOverflow = table.scrollWidth > tableWrap.clientWidth + 4;
      setShowAccountingFloatingScrollbar(hasOverflow);
      scrollbarInner.style.width = `${table.scrollWidth}px`;
      scrollbar.scrollLeft = tableWrap.scrollLeft;
    }

    syncAccountingScrollbarMetrics();
    window.addEventListener("resize", syncAccountingScrollbarMetrics);
    return () => window.removeEventListener("resize", syncAccountingScrollbarMetrics);
  }, [accountingLedgerRows]);

  useEffect(() => {
    const tableWrap = accountingTableWrapRef.current;
    const scrollbar = accountingTableScrollbarRef.current;

    if (!tableWrap || !scrollbar) {
      return;
    }

    const nextTableWrap = tableWrap;
    const nextScrollbar = scrollbar;

    function handleTableScroll() {
      if (syncingAccountingScrollRef.current === "bottom-bar") {
        syncingAccountingScrollRef.current = null;
        return;
      }

      syncingAccountingScrollRef.current = "table";
      nextScrollbar.scrollLeft = nextTableWrap.scrollLeft;
    }

    function handleBottomBarScroll() {
      if (syncingAccountingScrollRef.current === "table") {
        syncingAccountingScrollRef.current = null;
        return;
      }

      syncingAccountingScrollRef.current = "bottom-bar";
      nextTableWrap.scrollLeft = nextScrollbar.scrollLeft;
    }

    nextTableWrap.addEventListener("scroll", handleTableScroll);
    nextScrollbar.addEventListener("scroll", handleBottomBarScroll);

    return () => {
      nextTableWrap.removeEventListener("scroll", handleTableScroll);
      nextScrollbar.removeEventListener("scroll", handleBottomBarScroll);
    };
  }, [accountingLedgerRows]);

  return (
    <section className="content-grid">
      <article ref={accountingFormPanelRef} className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar movimiento de caja</h2>
            <p>Alta de ingresos y gastos por rubro, campo y moneda.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            <span>Fecha</span>
            <input
              type="date"
              value={accountingForm.date}
              onChange={(event) => setAccountingForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label>
            <span>Campo</span>
            <select
              value={accountingForm.fieldId}
              onChange={(event) => setAccountingForm((current) => ({ ...current, fieldId: event.target.value }))}
            >
              {visibleFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={accountingForm.type}
              onChange={(event) => {
                const nextType = event.target.value as AccountingEntryType;
                setAccountingForm((current) => ({
                  ...current,
                  type: nextType,
                  concept: nextType === "income" ? "venta_vacunos" : "alimentacion",
                  currency: nextType === "income" ? "USD" : current.currency
                }));
              }}
            >
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
            </select>
          </label>
          <label>
            <span>Rubro</span>
            <select
              value={accountingForm.concept}
              onChange={(event) =>
                setAccountingForm((current) => ({
                  ...current,
                  concept: event.target.value as IncomeConcept | ExpenseConcept
                }))
              }
            >
              {accountingForm.type === "income"
                ? Object.entries(incomeConceptLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))
                : Object.entries(expenseConceptLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
            </select>
          </label>
          <label>
            <span>Moneda</span>
            <select
              value={accountingForm.currency}
              disabled={accountingForm.type === "income"}
              onChange={(event) => setAccountingForm((current) => ({ ...current, currency: event.target.value as MoneyCurrency }))}
            >
              {accountingForm.type === "income" ? (
                <option value="USD">USD</option>
              ) : (
                Object.entries(currencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            <span>Importe bruto</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={accountingForm.grossAmount}
              onChange={(event) => setAccountingForm((current) => ({ ...current, grossAmount: event.target.value }))}
            />
          </label>
          <label>
            <span>Comision</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={accountingForm.commissionAmount}
              onChange={(event) => setAccountingForm((current) => ({ ...current, commissionAmount: event.target.value }))}
            />
          </label>
          <label>
            <span>IVA</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={accountingForm.taxAmount}
              onChange={(event) => setAccountingForm((current) => ({ ...current, taxAmount: event.target.value }))}
            />
          </label>
          <label className="span-2">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={accountingForm.notes}
              onChange={(event) => setAccountingForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <div className="projection-card span-2">
            <span>Neto visible</span>
            <strong>
              {formatMoney(
                getNetAmount(
                  accountingForm.type,
                  Number(accountingForm.grossAmount) || 0,
                  Number(accountingForm.commissionAmount) || 0,
                  Number(accountingForm.taxAmount) || 0
                ),
                accountingForm.currency
              )}
            </strong>
          </div>
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              {editingAccountingEntryId ? "Guardar cambios" : "Guardar movimiento contable"}
            </button>
            {editingAccountingEntryId ? (
              <button type="button" className="ghost-button" onClick={resetAccountingForm}>
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
      </article>

      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Planilla contable</h2>
            <p>Lectura cronologica para revisar ingresos, egresos, rubros y moneda.</p>
          </div>
        </div>
        <div className="inline-metrics">
          <span className="data-badge accent">Neto visible {formatMoney(projectedNet, accountingForm.currency)}</span>
        </div>
        <label className="table-search">
          <span>Buscar en contabilidad</span>
          <input
            type="search"
            placeholder="Campo, fecha, rubro, moneda o nota..."
            value={accountingSearchTerm}
            onChange={(event) => setAccountingSearchTerm(event.target.value)}
          />
        </label>
        <div ref={accountingTableWrapRef} className="table-wrap">
          <table ref={accountingTableRef}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Campo</th>
                <th>Tipo</th>
                <th>Rubro</th>
                <th>Moneda</th>
                <th>Bruto</th>
                <th>Comision</th>
                <th>IVA</th>
                <th>Neto</th>
                <th>Relacionado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accountingLedgerRows.map((entry) => {
                const field = fields.find((item) => item.id === entry.fieldId);
                return (
                  <tr key={entry.id}>
                    <td>{formatShortDate(entry.date)}</td>
                    <td>{field?.name ?? "-"}</td>
                    <td>{entry.type === "income" ? "Ingreso" : "Egreso"}</td>
                    <td>
                      {entry.type === "income"
                        ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
                        : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels]}
                    </td>
                    <td>{entry.currency}</td>
                    <td>{formatMoney(entry.grossAmount, entry.currency)}</td>
                    <td>{formatMoney(entry.commissionAmount, entry.currency)}</td>
                    <td>{formatMoney(entry.taxAmount, entry.currency)}</td>
                    <td>{formatMoney(entry.netAmount, entry.currency)}</td>
                    <td>{entry.linkedAnimalMovementId ? "Si" : "No"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => onEditEntry(entry.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => requestDeleteAccountingEntry(entry.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          ref={accountingTableScrollbarRef}
          className={showAccountingFloatingScrollbar ? "floating-table-scrollbar" : "floating-table-scrollbar hidden"}
        >
          <div ref={accountingTableScrollbarInnerRef} className="floating-table-scrollbar-inner" />
        </div>
      </article>
    </section>
  );
}
