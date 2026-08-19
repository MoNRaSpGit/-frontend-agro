import { useEffect, useState } from "react";
import { animalMovementFormKinds, categoryCatalog, currencyLabels, movementKindLabels, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatMoney, formatNumber, formatShortDate, parseDecimalInput } from "./agro.home.shared";
import {
  AgroSpecies,
  AnimalMovementKind,
  AnimalMovementRecord,
  AnimalPricingMode,
  Establishment,
  FieldUnit,
  MoneyCurrency
} from "./agro.types";

interface AgroAnimalsSectionProps {
  establishments: Establishment[];
  fields: FieldUnit[];
  animalFieldRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLSelectElement | null>>;
  animalForm: {
    date: string;
    establishmentId: string;
    fieldId: string;
    transferDestinationEstablishmentId: string;
    transferDestinationFieldId: string;
    species: AgroSpecies;
    categoryCode: string;
    kind: AnimalMovementKind;
    quantity: string;
    earTag: string;
    pricingMode: AnimalPricingMode;
    weightKg: string;
    unitPrice: string;
    freightAmount: string;
    commissionAmount: string;
    taxAmount: string;
    collectedAmount: string;
    currency: MoneyCurrency;
    notes: string;
  };
  animalFormErrors: Record<string, string>;
  animalFormPanelRef: React.RefObject<HTMLElement | null>;
  animalMovements: AnimalMovementRecord[];
  animalLedgerRows: AnimalMovementRecord[];
  // Igual que animalLedgerRows pero sin el filtro de campo seleccionado --
  // se usa para la tabla "Movimientos recientes" (ver mas abajo), que
  // muestra los ultimos movimientos de cualquier campo/establecimiento sin
  // que el cliente tenga que ir cambiando el filtro para ver ambas puntas
  // de un traslado entre establecimientos distintos.
  globalAnimalLedgerRows: AnimalMovementRecord[];
  animalLedgerSummary: {
    purchases: number;
    sales: number;
    stockInternalMoves: number;
    stockIncidents: number;
    linkedCommercialRows: number;
  };
  animalSearchTerm: string;
  animalTableRef: React.RefObject<HTMLTableElement | null>;
  animalTableScrollbarInnerRef: React.RefObject<HTMLDivElement | null>;
  animalTableScrollbarRef: React.RefObject<HTMLDivElement | null>;
  animalTableWrapRef: React.RefObject<HTMLDivElement | null>;
  clearAnimalFieldError: (fieldName: string) => void;
  editingAnimalMovementId: string | null;
  handleAnimalKindChange: (kind: AnimalMovementKind) => void;
  handleAnimalSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCattleDeathWithEarTag: boolean;
  isCommercialAnimalMovement: boolean;
  isCorrectionAnimalMovement: boolean;
  correctionCurrentQuantity: number;
  projectedAnimalTotal: number;
  transferAvailableSpecies: AgroSpecies[];
  transferAvailableCategories: Array<{ categoryCode: string; quantity: number }>;
  registerAnimalFieldRef: (fieldName: string) => (element: HTMLInputElement | HTMLSelectElement | null) => void;
  requestDeleteAnimalMovement: (movementId: string) => void;
  resetAnimalForm: () => void;
  setAnimalForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      establishmentId: string;
      fieldId: string;
      transferDestinationEstablishmentId: string;
      transferDestinationFieldId: string;
      species: AgroSpecies;
      categoryCode: string;
      kind: AnimalMovementKind;
      quantity: string;
      earTag: string;
      pricingMode: AnimalPricingMode;
      weightKg: string;
      unitPrice: string;
      freightAmount: string;
      commissionAmount: string;
      taxAmount: string;
      collectedAmount: string;
      currency: MoneyCurrency;
      notes: string;
    }>
  >;
  setAnimalSearchTerm: (value: string) => void;
  showAnimalFloatingScrollbar: boolean;
  onEditMovement: (movementId: string) => void;
}

// Desglosa el calculo del monto neto en texto (ej: "10 Vacunos x 200kg x
// $4,50 - $100 comision - $50 IVA = $8.850"), para que quede claro de donde
// sale el numero sin tener que adivinar la formula.
function buildAnimalTotalFormula(
  animalForm: {
    kind: AnimalMovementKind;
    species: AgroSpecies;
    pricingMode: AnimalPricingMode;
    quantity: string;
    weightKg: string;
    unitPrice: string;
    commissionAmount: string;
    taxAmount: string;
    freightAmount: string;
    currency: MoneyCurrency;
  },
  total: number
) {
  const quantity = parseDecimalInput(animalForm.quantity) || 0;
  const weight = parseDecimalInput(animalForm.weightKg) || 0;
  const price = parseDecimalInput(animalForm.unitPrice) || 0;
  const commission = parseDecimalInput(animalForm.commissionAmount) || 0;
  const tax = parseDecimalInput(animalForm.taxAmount) || 0;
  const freight = parseDecimalInput(animalForm.freightAmount) || 0;
  const speciesLabel = speciesLabels[animalForm.species];

  const grossFormula =
    animalForm.pricingMode === "kilo"
      ? `${formatNumber(quantity, 0)} ${speciesLabel} x ${formatNumber(weight, 0)}kg x ${formatMoney(price, animalForm.currency)}`
      : `${formatNumber(quantity, 0)} ${speciesLabel} x ${formatMoney(price, animalForm.currency)}`;

  const adjustments: string[] = [];
  if (animalForm.kind === "sale") {
    if (commission) adjustments.push(`- ${formatMoney(commission, animalForm.currency)} comision`);
    if (tax) adjustments.push(`- ${formatMoney(tax, animalForm.currency)} IVA`);
  } else {
    if (commission) adjustments.push(`+ ${formatMoney(commission, animalForm.currency)} comision`);
    if (tax) adjustments.push(`+ ${formatMoney(tax, animalForm.currency)} IVA`);
    if (freight) adjustments.push(`+ ${formatMoney(freight, animalForm.currency)} flete`);
  }

  return `${grossFormula}${adjustments.length ? ` ${adjustments.join(" ")}` : ""} = ${formatMoney(total, animalForm.currency)}`;
}

export function AgroAnimalsSection({
  establishments,
  fields,
  animalForm,
  animalFormErrors,
  animalFormPanelRef,
  animalMovements,
  animalLedgerRows,
  globalAnimalLedgerRows,
  animalLedgerSummary,
  animalSearchTerm,
  animalTableRef,
  animalTableScrollbarInnerRef,
  animalTableScrollbarRef,
  animalTableWrapRef,
  clearAnimalFieldError,
  editingAnimalMovementId,
  handleAnimalKindChange,
  handleAnimalSubmit,
  isCattleDeathWithEarTag,
  isCommercialAnimalMovement,
  isCorrectionAnimalMovement,
  correctionCurrentQuantity,
  projectedAnimalTotal,
  transferAvailableSpecies,
  transferAvailableCategories,
  registerAnimalFieldRef,
  requestDeleteAnimalMovement,
  resetAnimalForm,
  setAnimalForm,
  setAnimalSearchTerm,
  showAnimalFloatingScrollbar,
  onEditMovement
}: AgroAnimalsSectionProps) {
  const LEDGER_PREVIEW_COUNT = 5;
  const LEDGER_PREVIEW_STEP = 5;
  const [visibleFilteredCount, setVisibleFilteredCount] = useState(LEDGER_PREVIEW_COUNT);
  const [visibleRecentCount, setVisibleRecentCount] = useState(LEDGER_PREVIEW_COUNT);

  const visibleFilteredMovements = animalLedgerRows.slice(0, visibleFilteredCount);
  const visibleRecentMovements = globalAnimalLedgerRows.slice(0, visibleRecentCount);

  // Vuelve a la vista compacta cuando cambia la busqueda -- si no, el
  // usuario podia quedar viendo "todos" de una busqueda vieja mezclado con
  // los resultados nuevos.
  useEffect(() => {
    setVisibleFilteredCount(LEDGER_PREVIEW_COUNT);
  }, [animalSearchTerm]);

  const isTransferMovement = animalForm.kind === "transfer";
  const isInternalTransfer = isTransferMovement && animalForm.transferDestinationEstablishmentId === animalForm.establishmentId;
  const selectedEstablishment = establishments.find((item) => item.id === animalForm.establishmentId);
  const selectedFields = fields.filter((item) => item.establishmentId === animalForm.establishmentId);
  const transferDestinations = establishments;
  const transferDestinationFields = fields.filter(
    (item) =>
      item.establishmentId === animalForm.transferDestinationEstablishmentId &&
      (!isInternalTransfer || item.id !== animalForm.fieldId)
  );

  function getMovementLabel(movement: AnimalMovementRecord) {
    if (movement.kind === "transfer_in" || movement.kind === "transfer_out") {
      return "Traslado";
    }

    return movementKindLabels[movement.kind as keyof typeof movementKindLabels];
  }

  // La fila "transfer_in" YA es la llegada (su propio establishmentId/fieldId
  // es el destino real, ver AgroHomePage.tsx donde se crea el par), asi que
  // ahi el destino se lee de la propia fila. La fila "transfer_out" todavia
  // no llego a ningun lado -- ahi el destino hay que sacarlo de la fila
  // emparejada (la transfer_in). Antes esto no distinguia el caso y siempre
  // miraba la fila emparejada, mostrando el ORIGEN como "Destino" en la fila
  // de llegada.
  function getMovementDestinationLabel(movement: AnimalMovementRecord) {
    if (movement.kind === "transfer_in") {
      const ownEstablishment = establishments.find((item) => item.id === movement.establishmentId);
      const ownField = fields.find((item) => item.id === movement.fieldId);

      if (!ownEstablishment) {
        return "-";
      }

      return ownField ? `${ownEstablishment.name} / ${ownField.name}` : ownEstablishment.name;
    }

    if (movement.kind === "transfer_out") {
      const pairedMovement = movement.pairedTransferMovementId
        ? animalMovements.find((item) => item.id === movement.pairedTransferMovementId)
        : undefined;
      const pairedEstablishment = pairedMovement
        ? establishments.find((item) => item.id === pairedMovement.establishmentId)
        : undefined;
      const pairedField = pairedMovement ? fields.find((item) => item.id === pairedMovement.fieldId) : undefined;

      if (!pairedEstablishment) {
        return "-";
      }

      return pairedField ? `${pairedEstablishment.name} / ${pairedField.name}` : pairedEstablishment.name;
    }

    return "-";
  }

  // Reusada por la tabla "Movimientos recientes" (sin filtro de campo) y
  // por la "Planilla de animales" (filtrada) para que ambas muestren
  // exactamente lo mismo por fila -- una sola fuente de verdad para el
  // origen/destino y el resto de las columnas.
  function renderLedgerRow(movement: AnimalMovementRecord) {
    const establishment = establishments.find((item) => item.id === movement.establishmentId);
    const field = fields.find((item) => item.id === movement.fieldId);
    const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
    const movementDestinationLabel = getMovementDestinationLabel(movement);
    return (
      <tr key={movement.id}>
        <td className="cell-date">{formatShortDate(movement.date)}</td>
        <td className="cell-field">{establishment?.name ?? "-"}</td>
        <td className="cell-field">{field?.name ?? "-"}</td>
        <td className="cell-kind">{getMovementLabel(movement)}</td>
        <td className="cell-detail">{movementDestinationLabel}</td>
        <td className="cell-description">{movement.notes.trim() || "-"}</td>
        <td className="cell-number">{movement.quantity}</td>
        <td className="cell-category">{category ? formatCategoryLabel(category.label) : movement.categoryCode}</td>
        <td className="cell-tag">{movement.earTag ?? "-"}</td>
        <td className="cell-number">{formatNumber(movement.weightKg)}</td>
        <td className="cell-money">
          {movement.unitPrice !== undefined ? formatMoney(movement.unitPrice, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.freightAmount !== undefined ? formatMoney(movement.freightAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.commissionAmount !== undefined ? formatMoney(movement.commissionAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.taxAmount !== undefined ? formatMoney(movement.taxAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.totalAmount !== undefined ? formatMoney(movement.totalAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-link">
          <span className={movement.linkedAccountingEntryId ? "data-badge accent compact" : "data-badge compact"}>
            {movement.linkedAccountingEntryId ? "Si" : "No"}
          </span>
        </td>
        <td className="cell-actions">
          <div className="table-actions">
            <button type="button" className="ghost-button" onClick={() => onEditMovement(movement.id)}>
              Editar
            </button>
            <button type="button" className="ghost-button danger" onClick={() => requestDeleteAnimalMovement(movement.id)}>
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <section className="content-grid">
      <article ref={animalFormPanelRef} className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar movimiento de animales</h2>
            <p>Alta de compras, ventas, nacimientos, muertes, traslados, faltantes, ajustes o correcciones de stock.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleAnimalSubmit}>
          <label className={animalFormErrors.date ? "field-error" : undefined}>
            <span>Fecha</span>
            <input
              ref={registerAnimalFieldRef("date")}
              type="date"
              value={animalForm.date}
              onChange={(event) => {
                clearAnimalFieldError("date");
                setAnimalForm((current) => ({ ...current, date: event.target.value }));
              }}
            />
          </label>
          <label className={animalFormErrors.kind ? "field-error" : undefined}>
            <span>Movimiento</span>
            <select
              ref={registerAnimalFieldRef("kind")}
              value={animalForm.kind}
              onChange={(event) => handleAnimalKindChange(event.target.value as AnimalMovementKind)}
            >
              {animalMovementFormKinds.map((value) => (
                <option key={value} value={value}>
                  {movementKindLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Campo origen</span>
            <div className="readonly-field">{selectedEstablishment?.name ?? "-"}</div>
          </label>
          {isTransferMovement ? (
            <label className={animalFormErrors.transferDestinationEstablishmentId ? "field-error" : undefined}>
              <span>Campo destino</span>
              <select
                ref={registerAnimalFieldRef("transferDestinationEstablishmentId")}
                value={animalForm.transferDestinationEstablishmentId}
                onChange={(event) => {
                  clearAnimalFieldError("transferDestinationEstablishmentId");
                  const nextEstablishmentId = event.target.value;
                  setAnimalForm((current) => ({
                    ...current,
                    transferDestinationEstablishmentId: nextEstablishmentId,
                    transferDestinationFieldId:
                      nextEstablishmentId === current.establishmentId
                        ? fields.find((item) => item.establishmentId === nextEstablishmentId && item.id !== current.fieldId)?.id ?? ""
                        : fields.find((item) => item.establishmentId === nextEstablishmentId)?.id ?? ""
                  }));
                }}
              >
                {transferDestinations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isInternalTransfer ? (
            <div className="form-grid span-2">
              <label className={animalFormErrors.fieldId ? "field-error" : undefined}>
                <span>Potrero origen</span>
                <select
                  ref={registerAnimalFieldRef("fieldId")}
                  value={animalForm.fieldId}
                  onChange={(event) => {
                    clearAnimalFieldError("fieldId");
                    const nextFieldId = event.target.value;
                    setAnimalForm((current) => ({
                      ...current,
                      fieldId: nextFieldId,
                      transferDestinationFieldId:
                        current.transferDestinationEstablishmentId === current.establishmentId &&
                        current.transferDestinationFieldId === nextFieldId
                          ? selectedFields.find((item) => item.id !== nextFieldId)?.id ?? ""
                          : current.transferDestinationEstablishmentId === current.establishmentId &&
                              !selectedFields.some(
                                (item) => item.id === current.transferDestinationFieldId && item.id !== nextFieldId
                              )
                            ? selectedFields.find((item) => item.id !== nextFieldId)?.id ?? ""
                            : current.transferDestinationFieldId
                    }));
                  }}
                >
                  {selectedFields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={animalFormErrors.transferDestinationFieldId ? "field-error" : undefined}>
                <span>Potrero destino</span>
                <select
                  ref={registerAnimalFieldRef("transferDestinationFieldId")}
                  value={animalForm.transferDestinationFieldId}
                  onChange={(event) => {
                    clearAnimalFieldError("transferDestinationFieldId");
                    setAnimalForm((current) => ({ ...current, transferDestinationFieldId: event.target.value }));
                  }}
                >
                  {transferDestinationFields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className={animalFormErrors.fieldId ? "field-error" : undefined}>
              <span>Potrero origen</span>
              <select
                ref={registerAnimalFieldRef("fieldId")}
                value={animalForm.fieldId}
                onChange={(event) => {
                  clearAnimalFieldError("fieldId");
                  setAnimalForm((current) => ({ ...current, fieldId: event.target.value }));
                }}
              >
                {selectedFields.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isTransferMovement && !isInternalTransfer ? (
            <label className={animalFormErrors.transferDestinationFieldId ? "field-error" : undefined}>
              <span>Potrero destino</span>
              <select
                ref={registerAnimalFieldRef("transferDestinationFieldId")}
                value={animalForm.transferDestinationFieldId}
                onChange={(event) => {
                  clearAnimalFieldError("transferDestinationFieldId");
                  setAnimalForm((current) => ({ ...current, transferDestinationFieldId: event.target.value }));
                }}
              >
                {transferDestinationFields.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={animalFormErrors.species ? "field-error" : undefined}>
            <span>Especie</span>
            <select
              ref={registerAnimalFieldRef("species")}
              value={animalForm.species}
              onChange={(event) => {
                clearAnimalFieldError("species");
                const nextSpecies = event.target.value as AgroSpecies;
                setAnimalForm((current) => ({
                  ...current,
                  species: nextSpecies,
                  categoryCode: categoryCatalog[nextSpecies][0]?.code ?? ""
                }));
              }}
            >
              {(isTransferMovement
                ? transferAvailableSpecies
                : (Object.keys(speciesLabels) as AgroSpecies[])
              ).map((value) => (
                <option key={value} value={value}>
                  {speciesLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className={animalFormErrors.categoryCode ? "field-error" : undefined}>
            <span>Categoria</span>
            <select
              ref={registerAnimalFieldRef("categoryCode")}
              value={animalForm.categoryCode}
              onChange={(event) => {
                clearAnimalFieldError("categoryCode");
                setAnimalForm((current) => ({ ...current, categoryCode: event.target.value }));
              }}
            >
              {(isTransferMovement
                ? transferAvailableCategories.map((entry) => {
                    const category = categoryCatalog[animalForm.species].find((item) => item.code === entry.categoryCode);
                    return {
                      code: entry.categoryCode,
                      label: category ? `${category.label} (${formatNumber(entry.quantity, 0)} disponibles)` : entry.categoryCode
                    };
                  })
                : categoryCatalog[animalForm.species].map((category) => ({
                    code: category.code,
                    label: category.label
                  }))
              ).map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className={animalFormErrors.quantity ? "field-error" : undefined}>
            <span>{isCorrectionAnimalMovement ? "Cantidad correcta (total real)" : "Cantidad"}</span>
            <input
              ref={registerAnimalFieldRef("quantity")}
              type="text"
              inputMode="numeric"
              min="0"
              value={animalForm.quantity}
              onChange={(event) => {
                clearAnimalFieldError("quantity");
                setAnimalForm((current) => ({ ...current, quantity: event.target.value }));
              }}
            />
            {isCorrectionAnimalMovement ? (
              <small>
                {`El sistema muestra ${formatNumber(correctionCurrentQuantity, 0)} en este potrero para esta especie y categoria. Al guardar, se ajusta sola la diferencia.`}
              </small>
            ) : null}
          </label>
          {isCattleDeathWithEarTag ? (
            <label className={animalFormErrors.earTag ? "field-error" : undefined}>
              <span>Numero de caravana</span>
              <input
                ref={registerAnimalFieldRef("earTag")}
                type="text"
                placeholder="Ej. UY-458921"
                value={animalForm.earTag}
                onChange={(event) => {
                  clearAnimalFieldError("earTag");
                  setAnimalForm((current) => ({ ...current, earTag: event.target.value }));
                }}
              />
            </label>
          ) : null}
          {isCommercialAnimalMovement ? (
            <>
              <label>
                <span>Modalidad de venta</span>
                <select
                  value={animalForm.pricingMode}
                  onChange={(event) => {
                    clearAnimalFieldError("weightKg");
                    setAnimalForm((current) => ({ ...current, pricingMode: event.target.value as AnimalPricingMode }));
                  }}
                >
                  <option value="kilo">Por kilo</option>
                  <option value="unidad">Por unidad</option>
                </select>
              </label>
              {animalForm.pricingMode === "kilo" ? (
                <label className={animalFormErrors.weightKg ? "field-error" : undefined}>
                  <span>Peso individual (kg)</span>
                  <input
                    ref={registerAnimalFieldRef("weightKg")}
                    type="text"
                    inputMode="decimal"
                    value={animalForm.weightKg}
                    onChange={(event) => {
                      clearAnimalFieldError("weightKg");
                      setAnimalForm((current) => ({ ...current, weightKg: event.target.value }));
                    }}
                  />
                  <small>Se multiplica por la cantidad para obtener el peso total.</small>
                </label>
              ) : null}
              <label className={animalFormErrors.unitPrice ? "field-error" : undefined}>
                <span>{animalForm.pricingMode === "kilo" ? "Precio por kilo" : "Precio por unidad"}</span>
                <input
                  ref={registerAnimalFieldRef("unitPrice")}
                  type="text"
                  inputMode="decimal"
                  value={animalForm.unitPrice}
                  onChange={(event) => {
                    clearAnimalFieldError("unitPrice");
                    setAnimalForm((current) => ({ ...current, unitPrice: event.target.value }));
                  }}
                />
              </label>
              {animalForm.kind === "purchase" ? (
                <label className={animalFormErrors.freightAmount ? "field-error" : undefined}>
                  <span>Flete</span>
                  <input
                    ref={registerAnimalFieldRef("freightAmount")}
                    type="text"
                    inputMode="decimal"
                    value={animalForm.freightAmount}
                    onChange={(event) => {
                      clearAnimalFieldError("freightAmount");
                      setAnimalForm((current) => ({ ...current, freightAmount: event.target.value }));
                    }}
                  />
                </label>
              ) : null}
              <label className={animalFormErrors.commissionAmount ? "field-error" : undefined}>
                <span>Comision</span>
                <input
                  ref={registerAnimalFieldRef("commissionAmount")}
                  type="text"
                  inputMode="decimal"
                  value={animalForm.commissionAmount}
                  onChange={(event) => {
                    clearAnimalFieldError("commissionAmount");
                    setAnimalForm((current) => ({ ...current, commissionAmount: event.target.value }));
                  }}
                />
              </label>
              <label className={animalFormErrors.taxAmount ? "field-error" : undefined}>
                <span>IVA</span>
                <input
                  ref={registerAnimalFieldRef("taxAmount")}
                  type="text"
                  inputMode="decimal"
                  value={animalForm.taxAmount}
                  onChange={(event) => {
                    clearAnimalFieldError("taxAmount");
                    setAnimalForm((current) => ({ ...current, taxAmount: event.target.value }));
                  }}
                  />
                </label>
              {animalForm.kind === "sale" ? (
                <label className={animalFormErrors.collectedAmount ? "field-error" : undefined}>
                  <span>Cobrado</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={animalForm.collectedAmount}
                    onChange={(event) => setAnimalForm((current) => ({ ...current, collectedAmount: event.target.value }))}
                  />
                </label>
              ) : null}
              <label>
                <span>Moneda</span>
                <select
                  value={animalForm.currency}
                  onChange={(event) => setAnimalForm((current) => ({ ...current, currency: event.target.value as MoneyCurrency }))}
                >
                  {Object.entries(currencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="span-2">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={animalForm.notes}
              onChange={(event) => setAnimalForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          {isCommercialAnimalMovement ? (
            <div className="projection-card span-2">
              <span>Monto neto proyectado</span>
              <strong>{formatMoney(projectedAnimalTotal, animalForm.currency)}</strong>
              <small className="projection-formula">{buildAnimalTotalFormula(animalForm, projectedAnimalTotal)}</small>
              {animalForm.kind === "sale" ? (
                <small>
                  Pendiente de cobro{" "}
                  {formatMoney(Math.max(0, projectedAnimalTotal - (parseDecimalInput(animalForm.collectedAmount) || 0)), animalForm.currency)}
                </small>
              ) : null}
            </div>
          ) : null}
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              {editingAnimalMovementId ? "Guardar cambios" : "Guardar movimiento demo"}
            </button>
            {editingAnimalMovementId ? (
              <button type="button" className="ghost-button" onClick={resetAnimalForm}>
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
      </article>

      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Planilla de animales</h2>
            <p>Vista de trabajo para revisar compras, ventas y movimientos del rodeo, filtrada por el campo/potrero seleccionado.</p>
          </div>
        </div>
        <div className="inline-metrics">
          <span className="data-badge">Compras {animalLedgerSummary.purchases}</span>
          <span className="data-badge">Ventas {animalLedgerSummary.sales}</span>
          <span className="data-badge">Traslados {animalLedgerSummary.stockInternalMoves}</span>
          <span className="data-badge">Nacimientos, muertes y faltantes {animalLedgerSummary.stockIncidents}</span>
          <span className="data-badge accent">Relacionados a contabilidad {animalLedgerSummary.linkedCommercialRows}</span>
        </div>
        <label className="table-search">
          <span>Buscar en animales</span>
          <input
            type="search"
            placeholder="Campo, potrero, categoria, especie, fecha o nota..."
            value={animalSearchTerm}
            onChange={(event) => setAnimalSearchTerm(event.target.value)}
          />
        </label>
        <div ref={animalTableWrapRef} className="table-wrap floating-scroll-host">
          <table ref={animalTableRef} className="animal-ledger-table">
            <thead>
              <tr>
                <th className="cell-date">Fecha</th>
                <th className="cell-field">Campo</th>
                <th className="cell-field">Potrero</th>
                <th className="cell-kind">Movimiento</th>
                <th className="cell-detail">Destino</th>
                <th className="cell-description">Descripcion</th>
                <th className="cell-number">Cantidad</th>
                <th className="cell-category">Categoria</th>
                <th className="cell-tag">Caravana</th>
                <th className="cell-number">Peso</th>
                <th className="cell-money">Precio</th>
                <th className="cell-money">Flete</th>
                <th className="cell-money">Comision</th>
                <th className="cell-money">IVA</th>
                <th className="cell-money">Monto total</th>
                <th className="cell-link">Relacion contable</th>
                <th className="cell-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleFilteredMovements.length ? (
                visibleFilteredMovements.map((movement) => renderLedgerRow(movement))
              ) : (
                <tr>
                  <td className="cell-empty" colSpan={17}>
                    No hay movimientos para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div
          ref={animalTableScrollbarRef}
          className={showAnimalFloatingScrollbar ? "floating-table-scrollbar" : "floating-table-scrollbar hidden"}
        >
          <div ref={animalTableScrollbarInnerRef} className="floating-table-scrollbar-inner" />
        </div>
        {animalLedgerRows.length > LEDGER_PREVIEW_COUNT ? (
          <div className="action-row">
            {visibleFilteredCount < animalLedgerRows.length ? (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setVisibleFilteredCount((current) => Math.min(current + LEDGER_PREVIEW_STEP, animalLedgerRows.length))}
                >
                  Ver 5 más
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setVisibleFilteredCount(animalLedgerRows.length)}
                >
                  Ver todos ({animalLedgerRows.length})
                </button>
              </>
            ) : (
              <button type="button" className="ghost-button" onClick={() => setVisibleFilteredCount(LEDGER_PREVIEW_COUNT)}>
                Ver menos
              </button>
            )}
          </div>
        ) : null}
      </article>

      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Movimientos recientes</h2>
            <p>Todos los movimientos (compras, ventas, traslados, etc.), sin importar el campo filtrado arriba -- para ver ambas puntas de un traslado entre establecimientos sin tener que cambiar el filtro.</p>
          </div>
        </div>
        <div className="table-wrap floating-scroll-host">
          <table className="animal-ledger-table">
            <thead>
              <tr>
                <th className="cell-date">Fecha</th>
                <th className="cell-field">Campo</th>
                <th className="cell-field">Potrero</th>
                <th className="cell-kind">Movimiento</th>
                <th className="cell-detail">Destino</th>
                <th className="cell-description">Descripcion</th>
                <th className="cell-number">Cantidad</th>
                <th className="cell-category">Categoria</th>
                <th className="cell-tag">Caravana</th>
                <th className="cell-number">Peso</th>
                <th className="cell-money">Precio</th>
                <th className="cell-money">Flete</th>
                <th className="cell-money">Comision</th>
                <th className="cell-money">IVA</th>
                <th className="cell-money">Monto total</th>
                <th className="cell-link">Relacion contable</th>
                <th className="cell-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecentMovements.length ? (
                visibleRecentMovements.map((movement) => renderLedgerRow(movement))
              ) : (
                <tr>
                  <td className="cell-empty" colSpan={17}>
                    No hay movimientos en el rango de fechas visible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {globalAnimalLedgerRows.length > LEDGER_PREVIEW_COUNT ? (
          <div className="action-row">
            {visibleRecentCount < globalAnimalLedgerRows.length ? (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setVisibleRecentCount((current) => Math.min(current + LEDGER_PREVIEW_STEP, globalAnimalLedgerRows.length))}
                >
                  Ver 5 más
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setVisibleRecentCount(globalAnimalLedgerRows.length)}
                >
                  Ver todos ({globalAnimalLedgerRows.length})
                </button>
              </>
            ) : (
              <button type="button" className="ghost-button" onClick={() => setVisibleRecentCount(LEDGER_PREVIEW_COUNT)}>
                Ver menos
              </button>
            )}
          </div>
        ) : null}
      </article>
    </section>
  );
}
