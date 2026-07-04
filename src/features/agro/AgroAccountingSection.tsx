import { useEffect, useRef, useState } from "react";
import { expenseConceptLabels, formatMoney, formatNumber, formatShortDate, formatYearMonth, getNetAmount, parseDecimalInput } from "./agro.home.shared";
import { currencyLabels } from "./agro.demo.data";
import {
  AccountingEntry,
  AccountingEntryType,
  Establishment,
  ExpenseConcept,
  FieldUnit,
  IncomeConcept,
  MonthlyExchangeRate,
  MoneyCurrency
} from "./agro.types";

interface AgroAccountingSectionProps {
  establishments: Establishment[];
  fields: FieldUnit[];
  visibleMonthLabel: string;
  accountingStatusFilter: "all" | "pending" | "partial" | "collected";
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
    collectedAmount: string;
    notes: string;
  };
  exchangeRateForm: {
    yearMonth: string;
    averageRate: string;
  };
  accountingLedgerRows: AccountingEntry[];
  accountingLedgerWithConversions: Array<
    AccountingEntry & {
      expectedAmount: number;
      collectedAmount: number;
      pendingAmount: number;
      collectionStatus: string | null;
      exchangeRateAverage: number | null;
      usdEquivalent: number | null;
    }
  >;
  accountingSearchTerm: string;
  editingAccountingEntryId: string | null;
  monthlyExchangeRates: MonthlyExchangeRate[];
  projectedNet: number;
  accountingCollectionSummary: {
    incomeUsd: number;
    pendingIncomeUsd: number;
    livestockPurchaseExpenseUsdDirect: number;
    livestockPurchaseExpenseUyu: number;
    livestockPurchaseExpenseUyuDollarized: number;
    totalLivestockPurchaseExpenseUsdEquivalent: number;
    operationalExpenseUsdDirect: number;
    operationalExpenseUyu: number;
    operationalExpenseUyuDollarized: number;
    totalOperationalExpenseUsdEquivalent: number;
  };
  requestDeleteAccountingEntry: (entryId: string) => void;
  resetExchangeRateForm: () => void;
  resetAccountingForm: () => void;
  setExchangeRateForm: React.Dispatch<
    React.SetStateAction<{
      yearMonth: string;
      averageRate: string;
    }>
  >;
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
      collectedAmount: string;
      notes: string;
    }>
  >;
  setAccountingStatusFilter: (value: "all" | "pending" | "partial" | "collected") => void;
  setAccountingSearchTerm: (value: string) => void;
  onEditEntry: (entryId: string) => void;
  onEditExchangeRate: (rateId: string) => void;
  onDeleteExchangeRate: (rateId: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSubmitExchangeRate: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function AgroAccountingSection({
  establishments,
  fields,
  visibleMonthLabel,
  accountingStatusFilter,
  accountingFormPanelRef,
  accountingForm,
  exchangeRateForm,
  accountingLedgerRows,
  accountingLedgerWithConversions,
  accountingSearchTerm,
  editingAccountingEntryId,
  monthlyExchangeRates,
  projectedNet,
  accountingCollectionSummary,
  requestDeleteAccountingEntry,
  resetExchangeRateForm,
  resetAccountingForm,
  setExchangeRateForm,
  setAccountingForm,
  setAccountingStatusFilter,
  setAccountingSearchTerm,
  onEditEntry,
  onEditExchangeRate,
  onDeleteExchangeRate,
  onSubmit,
  onSubmitExchangeRate
}: AgroAccountingSectionProps) {
  const selectedEstablishment = establishments.find((item) => item.id === accountingForm.establishmentId);
  const selectedFields = fields.filter((item) => item.establishmentId === accountingForm.establishmentId);
  const accountingTableWrapRef = useRef<HTMLDivElement | null>(null);
  const accountingTableRef = useRef<HTMLTableElement | null>(null);
  const [showExchangeRateEditModal, setShowExchangeRateEditModal] = useState(false);
  const [pendingExchangeRateDelete, setPendingExchangeRateDelete] = useState<MonthlyExchangeRate | null>(null);

  useEffect(() => {
    function syncAccountingScrollbarMetrics() {
      const tableWrap = accountingTableWrapRef.current;
      const table = accountingTableRef.current;

      if (!tableWrap || !table) {
        return;
      }
    }

    syncAccountingScrollbarMetrics();
    window.addEventListener("resize", syncAccountingScrollbarMetrics);
    return () => window.removeEventListener("resize", syncAccountingScrollbarMetrics);
  }, [accountingLedgerRows]);

  function handleOpenExchangeRateEdit(rateId: string) {
    onEditExchangeRate(rateId);
    setShowExchangeRateEditModal(true);
  }

  function handleCloseExchangeRateEdit() {
    setShowExchangeRateEditModal(false);
    resetExchangeRateForm();
  }

  function handleExchangeRateModalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const averageRate = parseDecimalInput(exchangeRateForm.averageRate);
    if (!exchangeRateForm.yearMonth) {
      return;
    }

    if (!Number.isFinite(averageRate) || averageRate <= 0) {
      return;
    }

    onSubmitExchangeRate(event);
    setShowExchangeRateEditModal(false);
  }

  function handleConfirmExchangeRateDelete() {
    if (!pendingExchangeRateDelete) {
      return;
    }

    onDeleteExchangeRate(pendingExchangeRateDelete.id);
    setPendingExchangeRateDelete(null);
  }

  return (
    <>
      <section className="content-grid accounting-top-grid">
        <article ref={accountingFormPanelRef} className="panel accounting-split-panel accounting-form-panel">
        <div className="panel-header">
          <div>
            <h2>Cargar movimiento de caja</h2>
            <p>Alta de ingresos y gastos por rubro, establecimiento y moneda.</p>
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
            <span>Campo activo</span>
            <div className="readonly-field">{selectedEstablishment?.name ?? "-"}</div>
          </label>
          <label>
            <span>Potrero</span>
            <select
              value={accountingForm.fieldId}
              onChange={(event) => setAccountingForm((current) => ({ ...current, fieldId: event.target.value }))}
            >
              {selectedFields.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
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
                ? Object.entries({
                    venta_vacunos: "Venta de vacunos",
                    venta_ovinos: "Venta de ovinos",
                    venta_lana: "Venta de lana",
                    venta_equinos: "Venta de equinos"
                  }).map(([value, label]) => (
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
              type="text"
              inputMode="decimal"
              value={accountingForm.grossAmount}
              onChange={(event) => setAccountingForm((current) => ({ ...current, grossAmount: event.target.value }))}
            />
          </label>
          <label>
            <span>Comision</span>
            <input
              type="text"
              inputMode="decimal"
              value={accountingForm.commissionAmount}
              onChange={(event) => setAccountingForm((current) => ({ ...current, commissionAmount: event.target.value }))}
            />
          </label>
          <label>
            <span>IVA</span>
            <input
              type="text"
              inputMode="decimal"
              value={accountingForm.taxAmount}
              onChange={(event) => setAccountingForm((current) => ({ ...current, taxAmount: event.target.value }))}
            />
          </label>
          {accountingForm.type === "income" ? (
            <label>
              <span>Cobrado</span>
              <input
                type="text"
                inputMode="decimal"
                value={accountingForm.collectedAmount}
                onChange={(event) => setAccountingForm((current) => ({ ...current, collectedAmount: event.target.value }))}
              />
            </label>
          ) : null}
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
                  parseDecimalInput(accountingForm.grossAmount) || 0,
                  parseDecimalInput(accountingForm.commissionAmount) || 0,
                  parseDecimalInput(accountingForm.taxAmount) || 0
                ),
                accountingForm.currency
              )}
            </strong>
            {accountingForm.type === "income" ? (
              <small>
                Pendiente {formatMoney(Math.max(0, (parseDecimalInput(accountingForm.grossAmount) || 0) - (parseDecimalInput(accountingForm.commissionAmount) || 0) - (parseDecimalInput(accountingForm.taxAmount) || 0) - (parseDecimalInput(accountingForm.collectedAmount) || 0)), "USD")}
              </small>
            ) : null}
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

        <article className="panel accounting-split-panel">
          <div className="panel-header">
            <div>
              <h2>Tipo de cambio promedio mensual</h2>
              <p>Carga el promedio del mes para dolarizar los egresos en pesos.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={onSubmitExchangeRate}>
            <label>
              <span>Mes</span>
              <input
                type="month"
                value={exchangeRateForm.yearMonth}
                onChange={(event) => setExchangeRateForm((current) => ({ ...current, yearMonth: event.target.value }))}
              />
            </label>
            <label>
              <span>TC promedio</span>
              <input
                type="text"
                inputMode="decimal"
                value={exchangeRateForm.averageRate}
                onChange={(event) => setExchangeRateForm((current) => ({ ...current, averageRate: event.target.value }))}
              />
            </label>
            <div className="projection-card span-2 compact-card">
              <span>Total UYU pasados a USD</span>
              <strong>
                {formatMoney(
                  accountingCollectionSummary.livestockPurchaseExpenseUyuDollarized +
                    accountingCollectionSummary.operationalExpenseUyuDollarized,
                  "USD"
                )}
              </strong>
            </div>
            <div className="action-row span-2">
              <button type="submit" className="primary-button">
                Agregar TC
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>TC promedio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {monthlyExchangeRates.map((item) => (
                  <tr key={item.id}>
                    <td>{formatYearMonth(item.yearMonth)}</td>
                    <td>{formatNumber(item.averageRate)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => handleOpenExchangeRateEdit(item.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => setPendingExchangeRateDelete(item)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Planilla contable</h2>
            <p>Lectura cronologica de {visibleMonthLabel} para revisar ingresos, egresos, rubros y moneda.</p>
          </div>
        </div>
        <div className="inline-metrics">
          <span className="data-badge accent">Neto visible {formatMoney(projectedNet, accountingForm.currency)}</span>
          <span className="data-badge">Ingresos cobrados {formatMoney(accountingCollectionSummary.incomeUsd, "USD")}</span>
          <span className="data-badge warning">Pendiente de cobro {formatMoney(accountingCollectionSummary.pendingIncomeUsd, "USD")}</span>
          <span className="data-badge">Compra ganado USD {formatMoney(accountingCollectionSummary.livestockPurchaseExpenseUsdDirect, "USD")}</span>
          <span className="data-badge">Compra ganado UYU {formatMoney(accountingCollectionSummary.livestockPurchaseExpenseUyu, "UYU")}</span>
          <span className="data-badge">Compra ganado USD eq. {formatMoney(accountingCollectionSummary.totalLivestockPurchaseExpenseUsdEquivalent, "USD")}</span>
          <span className="data-badge">Gastos operativos USD {formatMoney(accountingCollectionSummary.operationalExpenseUsdDirect, "USD")}</span>
          <span className="data-badge">Gastos operativos UYU {formatMoney(accountingCollectionSummary.operationalExpenseUyu, "UYU")}</span>
          <span className="data-badge accent">Gastos operativos USD eq. {formatMoney(accountingCollectionSummary.totalOperationalExpenseUsdEquivalent, "USD")}</span>
        </div>
        <label className="table-search">
          <span>Buscar en contabilidad</span>
          <input
            type="search"
            placeholder="Campo, potrero, fecha, rubro, moneda o nota..."
            value={accountingSearchTerm}
            onChange={(event) => setAccountingSearchTerm(event.target.value)}
          />
        </label>
        <label className="table-search">
          <span>Estado de cobro</span>
          <select
            value={accountingStatusFilter}
            onChange={(event) =>
              setAccountingStatusFilter(event.target.value as "all" | "pending" | "partial" | "collected")
            }
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="partial">Parcial</option>
            <option value="collected">Cobrado</option>
          </select>
        </label>
        <div ref={accountingTableWrapRef} className="table-wrap">
          <table ref={accountingTableRef}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Campo</th>
                <th>Potrero</th>
                <th>Tipo</th>
                <th>Rubro</th>
                <th>Moneda</th>
                <th>Bruto</th>
                <th>Comision</th>
                <th>IVA</th>
                <th>Total</th>
                <th>Cobrado</th>
                <th>Pendiente</th>
                <th>Estado</th>
                <th>UYU a USD</th>
                <th>Relacionado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accountingLedgerWithConversions.map((entry) => {
                const field = fields.find((item) => item.id === entry.fieldId);
                const establishment = establishments.find((item) => item.id === entry.establishmentId);
                return (
                  <tr key={entry.id}>
                    <td>{formatShortDate(entry.date)}</td>
                    <td>{establishment?.name ?? "-"}</td>
                    <td>{field?.name ?? "-"}</td>
                    <td>{entry.type === "income" ? "Ingreso" : "Egreso"}</td>
                    <td>
                      {entry.type === "income"
                        ? {
                            venta_vacunos: "Venta de vacunos",
                            venta_ovinos: "Venta de ovinos",
                            venta_lana: "Venta de lana",
                            venta_equinos: "Venta de equinos"
                          }[entry.concept as IncomeConcept]
                        : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels]}
                    </td>
                    <td>{entry.currency}</td>
                    <td>{formatMoney(entry.grossAmount, entry.currency)}</td>
                    <td>{formatMoney(entry.commissionAmount, entry.currency)}</td>
                    <td>{formatMoney(entry.taxAmount, entry.currency)}</td>
                    <td>{formatMoney(entry.netAmount, entry.currency)}</td>
                    <td>{entry.type === "income" ? formatMoney(entry.collectedAmount, entry.currency) : "-"}</td>
                    <td>{entry.type === "income" ? formatMoney(entry.pendingAmount, entry.currency) : "-"}</td>
                    <td>{entry.collectionStatus ?? "-"}</td>
                    <td>{entry.usdEquivalent !== null ? formatMoney(entry.usdEquivalent, "USD") : "-"}</td>
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
        </article>
      </section>

      {showExchangeRateEditModal ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="edit-exchange-rate-title">
            <form className="form-grid" onSubmit={handleExchangeRateModalSubmit}>
              <div className="confirm-modal-copy span-2">
                <strong id="edit-exchange-rate-title">Editar tipo de cambio</strong>
                <span>Ajusta el mes y el promedio antes de guardar.</span>
              </div>
              <label>
                <span>Mes</span>
                <input
                  type="month"
                  value={exchangeRateForm.yearMonth}
                  onChange={(event) => setExchangeRateForm((current) => ({ ...current, yearMonth: event.target.value }))}
                />
              </label>
              <label>
                <span>TC promedio</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exchangeRateForm.averageRate}
                  onChange={(event) => setExchangeRateForm((current) => ({ ...current, averageRate: event.target.value }))}
                />
              </label>
              <div className="action-row span-2">
                <button type="button" className="ghost-button" onClick={handleCloseExchangeRateEdit}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  Aceptar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingExchangeRateDelete ? (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-exchange-rate-title">
            <div className="confirm-modal-copy">
              <strong id="delete-exchange-rate-title">Eliminar tipo de cambio</strong>
              <span>
                Se va a eliminar el tipo de cambio de {formatYearMonth(pendingExchangeRateDelete.yearMonth)}. Esta accion
                afecta la lectura de egresos UYU pasados a USD.
              </span>
            </div>
            <div className="action-row">
              <button type="button" className="ghost-button" onClick={() => setPendingExchangeRateDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="ghost-button danger" onClick={handleConfirmExchangeRateDelete}>
                Si, eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
