import { animalMovementFormKinds, categoryCatalog, currencyLabels, movementKindLabels, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatMoney, formatNumber, formatShortDate, parseDecimalInput } from "./agro.home.shared";
import { AgroSpecies, AnimalMovementKind, AnimalMovementRecord, Establishment, FieldUnit, MoneyCurrency } from "./agro.types";

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
  isBirthOrDeathAnimalMovement: boolean;
  isCattleDeathWithEarTag: boolean;
  isCommercialAnimalMovement: boolean;
  isAdjustmentAnimalMovement: boolean;
  projectedAnimalTotal: number;
  transferAvailableSpecies: AgroSpecies[];
  transferAvailableCategories: Array<{ categoryCode: string; quantity: number }>;
  transferAvailableQuantity: number;
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

export function AgroAnimalsSection({
  establishments,
  fields,
  animalForm,
  animalFormErrors,
  animalFormPanelRef,
  animalMovements,
  animalLedgerRows,
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
  isBirthOrDeathAnimalMovement,
  isCattleDeathWithEarTag,
  isCommercialAnimalMovement,
  isAdjustmentAnimalMovement,
  projectedAnimalTotal,
  transferAvailableSpecies,
  transferAvailableCategories,
  transferAvailableQuantity,
  registerAnimalFieldRef,
  requestDeleteAnimalMovement,
  resetAnimalForm,
  setAnimalForm,
  setAnimalSearchTerm,
  showAnimalFloatingScrollbar,
  onEditMovement
}: AgroAnimalsSectionProps) {
  const isInternalTransfer = animalForm.kind === "transfer_internal";
  const isTransferMovement = animalForm.kind === "transfer" || isInternalTransfer;
  const selectedEstablishment = establishments.find((item) => item.id === animalForm.establishmentId);
  const selectedFields = fields.filter((item) => item.establishmentId === animalForm.establishmentId);
  const externalTransferDestinations = establishments.filter((item) => item.id !== animalForm.establishmentId);
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

  function getMovementDestinationLabel(movement: AnimalMovementRecord) {
    if (movement.kind === "transfer_out" || movement.kind === "transfer_in") {
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

  return (
    <section className="content-grid">
      <article ref={animalFormPanelRef} className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar movimiento de animales</h2>
            <p>Alta de compras, ventas, nacimientos, muertes, traslados, faltantes o ajustes.</p>
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
          {isInternalTransfer ? (
            <label className={animalFormErrors.quantity ? "field-error" : undefined}>
              <span>Cantidad</span>
              <input
                ref={registerAnimalFieldRef("quantity")}
                type="text"
                inputMode="numeric"
                min="1"
                value={animalForm.quantity}
                onChange={(event) => {
                  clearAnimalFieldError("quantity");
                  setAnimalForm((current) => ({ ...current, quantity: event.target.value }));
                }}
              />
            </label>
          ) : null}
          {animalForm.kind === "transfer" ? (
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
                      fields.find((item) => item.establishmentId === nextEstablishmentId)?.id ?? ""
                  }));
                }}
              >
                {externalTransferDestinations.map((item) => (
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
                      transferDestinationEstablishmentId:
                        current.kind === "transfer_internal"
                          ? current.establishmentId
                          : current.transferDestinationEstablishmentId,
                      transferDestinationFieldId:
                        current.kind === "transfer_internal" && current.transferDestinationFieldId === nextFieldId
                          ? selectedFields.find((item) => item.id !== nextFieldId)?.id ?? ""
                          : current.kind === "transfer_internal" &&
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
                  const nextFieldId = event.target.value;
                  setAnimalForm((current) => ({
                    ...current,
                    fieldId: nextFieldId,
                    transferDestinationEstablishmentId:
                      current.kind === "transfer_internal"
                        ? current.establishmentId
                        : current.transferDestinationEstablishmentId,
                    transferDestinationFieldId:
                      current.kind === "transfer_internal" && current.transferDestinationFieldId === nextFieldId
                        ? selectedFields.find((item) => item.id !== nextFieldId)?.id ?? ""
                        : current.kind === "transfer_internal" &&
                            !selectedFields.some((item) => item.id === current.transferDestinationFieldId && item.id !== nextFieldId)
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
          )}
          {animalForm.kind === "transfer" ? (
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
          {!isInternalTransfer ? (
            <label className={animalFormErrors.quantity ? "field-error" : undefined}>
              <span>Cantidad</span>
              <input
                ref={registerAnimalFieldRef("quantity")}
                type="text"
                inputMode="numeric"
                min="1"
                value={animalForm.quantity}
                onChange={(event) => {
                  clearAnimalFieldError("quantity");
                  setAnimalForm((current) => ({ ...current, quantity: event.target.value }));
                }}
              />
            </label>
          ) : null}
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
              <label className={animalFormErrors.weightKg ? "field-error" : undefined}>
                <span>Peso</span>
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
              </label>
              <label className={animalFormErrors.unitPrice ? "field-error" : undefined}>
                <span>Precio</span>
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
          {isBirthOrDeathAnimalMovement && !isInternalTransfer ? (
            <div className="projection-card span-2 compact-card">
              <span>Movimiento sin impacto economico</span>
              <strong>No lleva precio, flete, comision, IVA ni moneda.</strong>
            </div>
          ) : null}
          {animalForm.kind === "transfer" ? (
            <div className="projection-card span-2 compact-card">
              <span>Traslado entre campos</span>
              <strong>Al guardar, baja stock en el campo y potrero origen y sube el mismo stock en el campo y potrero destino.</strong>
              <small>Disponibles en origen: {formatNumber(transferAvailableQuantity, 0)}</small>
            </div>
          ) : null}
          {isAdjustmentAnimalMovement ? (
            <div className="projection-card span-2 compact-card">
              <span>Ajuste de existencias</span>
              <strong>Usalo para corregir diferencias entre lo que hay en el establecimiento y lo que figura cargado.</strong>
            </div>
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
              <span>Monto total proyectado</span>
              <strong>{formatMoney(projectedAnimalTotal, animalForm.currency)}</strong>
              {animalForm.kind === "sale" ? (
                <small>
                  Pendiente {formatMoney(Math.max(0, projectedAnimalTotal - (parseDecimalInput(animalForm.collectedAmount) || 0)), animalForm.currency)}
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
            <p>Vista de trabajo para revisar compras, ventas y movimientos del rodeo.</p>
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
              {animalLedgerRows.map((movement) => {
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
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => requestDeleteAnimalMovement(movement.id)}
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
          ref={animalTableScrollbarRef}
          className={showAnimalFloatingScrollbar ? "floating-table-scrollbar" : "floating-table-scrollbar hidden"}
        >
          <div ref={animalTableScrollbarInnerRef} className="floating-table-scrollbar-inner" />
        </div>
      </article>
    </section>
  );
}
