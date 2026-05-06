import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ProductShell } from "../../shared/components/ProductShell";
import { readJsonStorage, writeJsonStorage } from "../../shared/lib/persistence";
import { agroWorkspaceSections } from "./agro.workspace.config";
import {
  categoryCatalog,
  discoveryQuestions,
  establishments,
  fields,
  initialAccountingEntries,
  initialMovements,
  initialStock,
  speciesLabels
} from "./agro.demo.data";
import {
  AccountingEntry,
  AccountingEntryType,
  AgroSpecies,
  AgroView,
  ExpenseConcept,
  IncomeConcept,
  StockDirection,
  StockMovement,
  StockReason
} from "./agro.types";
const incomeConceptLabels = {
  venta_vacunos: "Venta de vacunos",
  venta_ovinos: "Venta de ovinos",
  venta_lana: "Venta de lana",
  venta_equinos: "Venta de equinos"
} as const;

const expenseConceptLabels = {
  alimentacion: "Alimentacion",
  sanidad: "Sanidad",
  combustible: "Combustible",
  sueldos: "Sueldos",
  mantenimiento: "Mantenimiento",
  impuestos: "Impuestos",
  otros: "Otros"
} as const;

const today = "2026-05-06";
const answersStorageKey = "saaspro-agro-discovery-answers";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0
  }).format(value);
}

function getNetAmount(
  type: AccountingEntryType,
  grossAmount: number,
  commissionAmount: number,
  taxAmount: number
) {
  if (type === "income") {
    return grossAmount - commissionAmount - taxAmount;
  }

  return grossAmount + commissionAmount + taxAmount;
}

export function AgroHomePage() {
  const [activeView, setActiveView] = useState<AgroView | null>(null);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState(establishments[0]?.id ?? "");
  const [movements, setMovements] = useState<StockMovement[]>(initialMovements);
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>(initialAccountingEntries);
  const [answers, setAnswers] = useState<Record<string, string>>(() => readJsonStorage(answersStorageKey, {}));

  const [stockForm, setStockForm] = useState({
    date: today,
    establishmentId: establishments[0]?.id ?? "",
    fieldId: fields[0]?.id ?? "",
    species: "vacunos" as AgroSpecies,
    categoryCode: categoryCatalog.vacunos[0]?.code ?? "",
    direction: "in" as StockDirection,
    reason: "compra" as StockReason,
    quantity: "10",
    notes: ""
  });

  const [accountingForm, setAccountingForm] = useState({
    date: today,
    establishmentId: establishments[0]?.id ?? "",
    type: "income" as AccountingEntryType,
    concept: "venta_vacunos" as IncomeConcept | ExpenseConcept,
    species: "vacunos" as AgroSpecies,
    kilos: "1200",
    pricePerKilo: "4.2",
    grossAmount: "5040",
    commissionAmount: "151",
    taxAmount: "48",
    notes: ""
  });

  const visibleFields = useMemo(
    () => fields.filter((field) => field.establishmentId === selectedEstablishmentId),
    [selectedEstablishmentId]
  );

  const stockBySpecies = useMemo(() => {
    const balanceMap = new Map<string, number>();

    for (const item of initialStock) {
      const key = `${item.fieldId}:${item.species}:${item.categoryCode}`;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + item.quantity);
    }

    for (const movement of movements) {
      const key = `${movement.fieldId}:${movement.species}:${movement.categoryCode}`;
      const signedQuantity = movement.direction === "in" ? movement.quantity : movement.quantity * -1;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + signedQuantity);
    }

    const speciesTotals: Record<AgroSpecies, number> = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0
    };

    for (const [key, quantity] of balanceMap.entries()) {
      const [, species] = key.split(":") as [string, AgroSpecies, string];
      speciesTotals[species] += quantity;
    }

    return speciesTotals;
  }, [movements]);

  const accountingTotals = useMemo(() => {
    return accountingEntries.reduce(
      (summary, entry) => {
        if (entry.type === "income") {
          summary.income += entry.netAmount;
        } else {
          summary.expense += entry.netAmount;
        }

        return summary;
      },
      { income: 0, expense: 0 }
    );
  }, [accountingEntries]);

  const fieldStockRows = useMemo(() => {
    const rows = initialStock
      .map((snapshot) => ({
        ...snapshot,
        movements: movements.filter(
          (movement) =>
            movement.fieldId === snapshot.fieldId &&
            movement.species === snapshot.species &&
            movement.categoryCode === snapshot.categoryCode
        )
      }))
      .map((row) => ({
        ...row,
        total:
          row.quantity +
          row.movements.reduce((sum, movement) => sum + (movement.direction === "in" ? movement.quantity : -movement.quantity), 0)
      }))
      .filter((row) => {
        const field = fields.find((item) => item.id === row.fieldId);
        return field?.establishmentId === selectedEstablishmentId;
      });

    return rows;
  }, [movements, selectedEstablishmentId]);

  const latestMovements = useMemo(() => {
    return [...movements].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  }, [movements]);

  const latestAccountingEntries = useMemo(() => {
    return [...accountingEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  }, [accountingEntries]);

  function showSuccess(message: string) {
    toast.success(message, { autoClose: 2400 });
  }

  function showError(message: string) {
    toast.error(message, { autoClose: false });
  }

  function handleStockSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(stockForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showError("La cantidad debe ser mayor a 0.");
      return;
    }

    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      date: stockForm.date,
      establishmentId: stockForm.establishmentId,
      fieldId: stockForm.fieldId,
      species: stockForm.species,
      categoryCode: stockForm.categoryCode,
      direction: stockForm.direction,
      reason: stockForm.reason,
      quantity,
      notes: stockForm.notes.trim()
    };

    setMovements((current) => [movement, ...current]);
    setSelectedEstablishmentId(stockForm.establishmentId);
    setStockForm((current) => ({ ...current, quantity: "", notes: "" }));
    showSuccess("Movimiento de stock guardado.");
  }

  function handleAccountingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const grossAmount = Number(accountingForm.grossAmount);
    const commissionAmount = Number(accountingForm.commissionAmount);
    const taxAmount = Number(accountingForm.taxAmount);
    const kilos = Number(accountingForm.kilos);
    const pricePerKilo = Number(accountingForm.pricePerKilo);

    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      showError("El importe bruto debe ser mayor a 0.");
      return;
    }

    if (accountingForm.type === "income") {
      if (accountingForm.kilos && (!Number.isFinite(kilos) || kilos < 0)) {
        showError("Los kilos deben ser un numero valido.");
        return;
      }

      if (accountingForm.pricePerKilo && (!Number.isFinite(pricePerKilo) || pricePerKilo < 0)) {
        showError("El precio por kilo debe ser un numero valido.");
        return;
      }
    }

    if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
      showError("La comision debe ser un numero valido.");
      return;
    }

    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      showError("Los impuestos deben ser un numero valido.");
      return;
    }

    const entry: AccountingEntry = {
      id: `acc-${Date.now()}`,
      date: accountingForm.date,
      establishmentId: accountingForm.establishmentId,
      type: accountingForm.type,
      concept: accountingForm.type === "income" ? accountingForm.concept : accountingForm.concept,
      species: accountingForm.type === "income" ? accountingForm.species : undefined,
      kilos: accountingForm.type === "income" && Number.isFinite(kilos) && kilos > 0 ? kilos : undefined,
      pricePerKilo:
        accountingForm.type === "income" && Number.isFinite(pricePerKilo) && pricePerKilo > 0
          ? pricePerKilo
          : undefined,
      grossAmount,
      commissionAmount: Number.isFinite(commissionAmount) ? commissionAmount : 0,
      taxAmount: Number.isFinite(taxAmount) ? taxAmount : 0,
      netAmount: getNetAmount(accountingForm.type, grossAmount, commissionAmount, taxAmount),
      notes: accountingForm.notes.trim()
    };

    setAccountingEntries((current) => [entry, ...current]);
    setSelectedEstablishmentId(accountingForm.establishmentId);
    setAccountingForm((current) => ({
      ...current,
      kilos: current.type === "income" ? "" : "",
      pricePerKilo: current.type === "income" ? "" : "",
      notes: ""
    }));
    showSuccess("Registro contable guardado.");
  }

  const projectedNet = getNetAmount(
    accountingForm.type,
    Number(accountingForm.grossAmount) || 0,
    Number(accountingForm.commissionAmount) || 0,
    Number(accountingForm.taxAmount) || 0
  );

  const establishmentSummary = establishments
    .filter((item) => item.id === selectedEstablishmentId)
    .map((item) => ({
      ...item,
      fieldCount: fields.filter((field) => field.establishmentId === item.id).length
    }))[0];
  const selectedFieldIds = fields
    .filter((field) => field.establishmentId === selectedEstablishmentId)
    .map((field) => field.id);
  const reportSpeciesRows = (Object.keys(speciesLabels) as AgroSpecies[]).map((species) => {
    const opening = initialStock
      .filter((item) => item.species === species && selectedFieldIds.includes(item.fieldId))
      .reduce((sum, item) => sum + item.quantity, 0);
    const entries = movements
      .filter((movement) => movement.species === species && selectedFieldIds.includes(movement.fieldId))
      .reduce((sum, movement) => sum + (movement.direction === "in" ? movement.quantity : 0), 0);
    const exits = movements
      .filter((movement) => movement.species === species && selectedFieldIds.includes(movement.fieldId))
      .reduce((sum, movement) => sum + (movement.direction === "out" ? movement.quantity : 0), 0);

    return {
      species,
      opening,
      entries,
      exits,
      current: opening + entries - exits
    };
  });
  const selectedAccountingEntries = accountingEntries.filter(
    (entry) => entry.establishmentId === selectedEstablishmentId
  );
  const reportAccounting = selectedAccountingEntries.reduce(
    (summary, entry) => {
      if (entry.type === "income") {
        summary.income += entry.netAmount;
      } else {
        summary.expense += entry.netAmount;
      }
      return summary;
    },
    { income: 0, expense: 0 }
  );
  const reportIncomeConcepts = Object.entries(incomeConceptLabels).map(([concept, label]) => {
    const total = selectedAccountingEntries
      .filter((entry) => entry.type === "income" && entry.concept === concept)
      .reduce((sum, entry) => sum + entry.netAmount, 0);
    return { concept, label, total };
  });
  const maxIncomeConceptValue = Math.max(...reportIncomeConcepts.map((item) => item.total), 1);
  useEffect(() => {
    writeJsonStorage(answersStorageKey, answers);
  }, [answers]);

  function handleResetAnswers() {
    writeJsonStorage(answersStorageKey, answers);
    showSuccess("Respuestas guardadas.");
  }

  return (
    <main className="app-shell">
      <ProductShell
        title="Agro demo"
        subtitle="Demo"
        badge=""
        navItems={agroWorkspaceSections}
        activeKey={activeView}
        onSelect={(key) => setActiveView(key as AgroView)}
        onTitleClick={() => setActiveView(null)}
      >
      <section className="toolbar">
        <label className="establishment-picker">
          <span>Establecimiento visible</span>
          <select value={selectedEstablishmentId} onChange={(event) => setSelectedEstablishmentId(event.target.value)}>
            {establishments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="summary-grid">
        <article className="metric-card">
          <span>Total vacunos</span>
          <strong>{stockBySpecies.vacunos}</strong>
          <small>Con base inicial mas movimientos cargados en demo.</small>
        </article>
        <article className="metric-card">
          <span>Total ovinos</span>
          <strong>{stockBySpecies.ovinos}</strong>
          <small>Visibles por categoria y por campo.</small>
        </article>
        <article className="metric-card">
          <span>Total equinos</span>
          <strong>{stockBySpecies.equinos}</strong>
          <small>Incluye caballada operativa del establecimiento.</small>
        </article>
        <article className="metric-card accent">
          <span>Resultado neto demo</span>
          <strong>{formatCurrency(accountingTotals.income - accountingTotals.expense)}</strong>
          <small>
            Ingresos {formatCurrency(accountingTotals.income)} | Egresos {formatCurrency(accountingTotals.expense)}
          </small>
        </article>
      </section>

      {activeView === "overview" ? (
        <section className="content-grid">
          <article className="panel wide">
            <div className="panel-header">
              <div>
                <h2>Campos del establecimiento</h2>
                <p>
                  {establishmentSummary?.location ?? "-"} | {establishmentSummary?.hectares ?? 0} ha |{" "}
                  {establishmentSummary?.fieldCount ?? 0} campos
                </p>
              </div>
            </div>
            <div className="chip-grid">
              {visibleFields.map((field) => (
                <article key={field.id} className="chip-card">
                  <strong>{field.name}</strong>
                  <span>{field.notes}</span>
                </article>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Ultimos movimientos de stock</h2>
              </div>
            </div>
            <div className="list-stack">
              {latestMovements.map((movement) => (
                <div key={movement.id} className="list-row">
                  <div>
                    <strong>{movement.reason}</strong>
                    <span>
                      {movement.date} | {speciesLabels[movement.species]}
                    </span>
                  </div>
                  <strong className={movement.direction === "in" ? "tone-positive" : "tone-negative"}>
                    {movement.direction === "in" ? "+" : "-"}
                    {movement.quantity}
                  </strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Ultimos asientos contables</h2>
              </div>
            </div>
            <div className="list-stack">
              {latestAccountingEntries.map((entry) => (
                <div key={entry.id} className="list-row">
                  <div>
                    <strong>
                      {entry.type === "income"
                        ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
                        : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels]}
                    </strong>
                    <span>{entry.date}</span>
                  </div>
                  <strong className={entry.type === "income" ? "tone-positive" : "tone-negative"}>
                    {entry.type === "income" ? "+" : "-"}
                    {formatCurrency(entry.netAmount)}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "stock" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Cargar movimiento de stock</h2>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleStockSubmit}>
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={stockForm.date}
                  onChange={(event) => setStockForm((current) => ({ ...current, date: event.target.value }))}
                />
              </label>
              <label>
                <span>Establecimiento</span>
                <select
                  value={stockForm.establishmentId}
                  onChange={(event) => {
                    const nextEstablishmentId = event.target.value;
                    const nextFieldId = fields.find((field) => field.establishmentId === nextEstablishmentId)?.id ?? "";
                    setStockForm((current) => ({
                      ...current,
                      establishmentId: nextEstablishmentId,
                      fieldId: nextFieldId
                    }));
                  }}
                >
                  {establishments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Campo</span>
                <select
                  value={stockForm.fieldId}
                  onChange={(event) => setStockForm((current) => ({ ...current, fieldId: event.target.value }))}
                >
                  {fields
                    .filter((field) => field.establishmentId === stockForm.establishmentId)
                    .map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Especie</span>
                <select
                  value={stockForm.species}
                  onChange={(event) => {
                    const nextSpecies = event.target.value as AgroSpecies;
                    setStockForm((current) => ({
                      ...current,
                      species: nextSpecies,
                      categoryCode: categoryCatalog[nextSpecies][0]?.code ?? ""
                    }));
                  }}
                >
                  {Object.entries(speciesLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Categoria MGAP</span>
                <select
                  value={stockForm.categoryCode}
                  onChange={(event) => setStockForm((current) => ({ ...current, categoryCode: event.target.value }))}
                >
                  {categoryCatalog[stockForm.species].map((category) => (
                    <option key={category.code} value={category.code}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tipo</span>
                <select
                  value={stockForm.direction}
                  onChange={(event) => setStockForm((current) => ({ ...current, direction: event.target.value as StockDirection }))}
                >
                  <option value="in">Entrada</option>
                  <option value="out">Salida</option>
                </select>
              </label>
              <label>
                <span>Motivo</span>
                <select
                  value={stockForm.reason}
                  onChange={(event) => setStockForm((current) => ({ ...current, reason: event.target.value as StockReason }))}
                >
                  <option value="compra">Compra</option>
                  <option value="nacimiento">Nacimiento</option>
                  <option value="venta">Venta</option>
                  <option value="muerte">Muerte</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </label>
              <label>
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  value={stockForm.quantity}
                  onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))}
                />
              </label>
              <label className="span-2">
                <span>Observaciones</span>
                <textarea
                  rows={3}
                  value={stockForm.notes}
                  onChange={(event) => setStockForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
              <button type="submit" className="primary-button">
                Guardar movimiento demo
              </button>
            </form>
          </article>

          <article className="panel wide">
            <div className="panel-header">
              <div>
                <h2>Stock actual por campo y categoria</h2>
                <p>Cantidad de animales por categoria y equivalencia en unidad ganadera.</p>
              </div>
            </div>
            <div className="info-inline-card">
              <strong>UG = Unidad Ganadera</strong>
              <span>
                Es una referencia para comparar categorias distintas dentro del stock. No pesa igual un toro que un
                ternero, por eso cada categoria tiene su equivalencia.
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Especie</th>
                    <th>Categoria</th>
                    <th>Unidad ganadera</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldStockRows.map((row) => {
                    const field = fields.find((item) => item.id === row.fieldId);
                    const category = categoryCatalog[row.species].find((item) => item.code === row.categoryCode);
                    return (
                      <tr key={`${row.fieldId}-${row.species}-${row.categoryCode}`}>
                        <td>{field?.name}</td>
                        <td>{speciesLabels[row.species]}</td>
                        <td>{category?.label ?? row.categoryCode}</td>
                        <td>{category?.ug ?? "-"}</td>
                        <td>{row.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "accounting" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Cargar ingreso o gasto</h2>
                <p>Registro simple para ventas, compras y gastos del establecimiento.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleAccountingSubmit}>
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={accountingForm.date}
                  onChange={(event) => setAccountingForm((current) => ({ ...current, date: event.target.value }))}
                />
              </label>
              <label>
                <span>Establecimiento</span>
                <select
                  value={accountingForm.establishmentId}
                  onChange={(event) =>
                    setAccountingForm((current) => ({ ...current, establishmentId: event.target.value }))
                  }
                >
                  {establishments.map((item) => (
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
                  onChange={(event) =>
                    setAccountingForm((current) => ({
                      ...current,
                      type: event.target.value as AccountingEntryType,
                      concept: (event.target.value === "income" ? "venta_vacunos" : "alimentacion") as
                        | IncomeConcept
                        | ExpenseConcept,
                      kilos: event.target.value === "income" ? current.kilos : "",
                      pricePerKilo: event.target.value === "income" ? current.pricePerKilo : ""
                    }))
                  }
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
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
              {accountingForm.type === "income" ? (
                <>
                  <label>
                    <span>Especie</span>
                    <select
                      value={accountingForm.species}
                      onChange={(event) =>
                        setAccountingForm((current) => ({ ...current, species: event.target.value as AgroSpecies }))
                      }
                    >
                      {Object.entries(speciesLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Kilos</span>
                    <input
                      type="number"
                      min="0"
                      value={accountingForm.kilos}
                      onChange={(event) => setAccountingForm((current) => ({ ...current, kilos: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Precio por kilo</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={accountingForm.pricePerKilo}
                      onChange={(event) =>
                        setAccountingForm((current) => ({ ...current, pricePerKilo: event.target.value }))
                      }
                    />
                  </label>
                </>
              ) : null}
              <label>
                <span>Importe bruto</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={accountingForm.grossAmount}
                  onChange={(event) =>
                    setAccountingForm((current) => ({ ...current, grossAmount: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Comision</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={accountingForm.commissionAmount}
                  onChange={(event) =>
                    setAccountingForm((current) => ({ ...current, commissionAmount: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Impuestos</span>
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
                <span>Neto proyectado</span>
                <strong>{formatCurrency(projectedNet)}</strong>
              </div>
              <button type="submit" className="primary-button">
                Guardar asiento demo
              </button>
            </form>
          </article>

          <article className="panel wide">
            <div className="panel-header">
              <div>
                <h2>Planilla contable demo</h2>
                <p>Resumen de ingresos y gastos con bruto, comision, impuestos y neto final.</p>
              </div>
            </div>
            <div className="info-inline-card">
              <strong>Neto final</strong>
              <span>
                Es el resultado que queda despues de descontar comision e impuestos en una venta, o el costo final en
                un gasto.
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Rubro</th>
                    <th>Kilos</th>
                    <th>Bruto</th>
                    <th>Comision</th>
                    <th>Impuestos</th>
                    <th>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {accountingEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.date}</td>
                      <td>{entry.type === "income" ? "Ingreso" : "Gasto"}</td>
                      <td>
                        {entry.type === "income"
                          ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
                          : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels]}
                      </td>
                      <td>{entry.kilos ?? "-"}</td>
                      <td>{formatCurrency(entry.grossAmount)}</td>
                      <td>{formatCurrency(entry.commissionAmount)}</td>
                      <td>{formatCurrency(entry.taxAmount)}</td>
                      <td>{formatCurrency(entry.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "questions" ? (
        <section className="content-grid">
          <article className="panel wide">
            <div className="panel-header">
              <div>
                <h2>Preguntas</h2>
              </div>
            </div>
            <div className="question-stack">
              {discoveryQuestions.map((question) => (
                <section key={question.id} className="question-card">
                  <div>
                    <h3>{question.title}</h3>
                    <p>{question.helper}</p>
                  </div>
                  <div className="option-row">
                    {question.options.map((option) => (
                      <label
                        key={option}
                        className={answers[question.id] === option ? "option-pill active" : "option-pill"}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={(event) =>
                            setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="answers-summary">
              <button type="button" className="primary-button" onClick={handleResetAnswers}>
                Guardar respuestas
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "reports" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Stock por especie</h2>
              </div>
            </div>
            <div className="report-stack">
              {reportSpeciesRows.map((row) => (
                <article key={row.species} className="report-row-card">
                  <div className="report-row-head">
                    <strong>{speciesLabels[row.species]}</strong>
                    <span>{row.current} actuales</span>
                  </div>
                  <div className="mini-stats">
                    <span>Apertura {row.opening}</span>
                    <span>Entradas {row.entries}</span>
                    <span>Salidas {row.exits}</span>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${Math.max((row.current / Math.max(row.opening + row.entries, 1)) * 100, 10)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Resultado economico</h2>
              </div>
            </div>
            <div className="finance-highlight">
              <div>
                <span>Ingresos netos</span>
                <strong>{formatCurrency(reportAccounting.income)}</strong>
              </div>
              <div>
                <span>Gastos netos</span>
                <strong>{formatCurrency(reportAccounting.expense)}</strong>
              </div>
              <div>
                <span>Resultado</span>
                <strong>{formatCurrency(reportAccounting.income - reportAccounting.expense)}</strong>
              </div>
            </div>
          </article>

          <article className="panel wide">
            <div className="panel-header">
              <div>
                <h2>Ingresos por rubro</h2>
                <p>Nos sirve para ver qué actividad pesa más y qué lenguaje entiende mejor el cliente.</p>
              </div>
            </div>
            <div className="report-stack">
              {reportIncomeConcepts.map((item) => (
                <article key={item.concept} className="income-bar-card">
                  <div className="income-bar-head">
                    <strong>{item.label}</strong>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                  <div className="bar-track warm">
                    <span style={{ width: `${Math.max((item.total / maxIncomeConceptValue) * 100, item.total > 0 ? 8 : 0)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </article>

        </section>
      ) : null}
      </ProductShell>
    </main>
  );
}
