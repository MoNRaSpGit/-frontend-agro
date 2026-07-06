import { categoryCatalog, movementKindLabels, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatNumber, formatShortDate } from "./agro.home.shared";
import { AgroSpecies, AnimalMovementRecord, Establishment, FieldUnit } from "./agro.types";

interface TransferRow {
  id: string;
  editMovementId: string;
  date: string;
  sourceEstablishmentId: string;
  sourceFieldId: string;
  destinationEstablishmentId: string;
  destinationFieldId: string;
  species: AgroSpecies;
  categoryCode: string;
  quantity: number;
  notes: string;
}

interface AgroTransfersSectionProps {
  establishments: Establishment[];
  fields: FieldUnit[];
  animalForm: {
    date: string;
    establishmentId: string;
    fieldId: string;
    transferDestinationEstablishmentId: string;
    transferDestinationFieldId: string;
    species: AgroSpecies;
    categoryCode: string;
    kind: AnimalMovementRecord["kind"];
    quantity: string;
    notes: string;
  };
  animalFormErrors: Record<string, string>;
  animalFormPanelRef: React.RefObject<HTMLElement | null>;
  editingAnimalMovementId: string | null;
  registerAnimalFieldRef: (fieldName: string) => (element: HTMLInputElement | HTMLSelectElement | null) => void;
  clearAnimalFieldError: (fieldName: string) => void;
  setAnimalForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      establishmentId: string;
      fieldId: string;
      transferDestinationEstablishmentId: string;
      transferDestinationFieldId: string;
      species: AgroSpecies;
      categoryCode: string;
      kind: AnimalMovementRecord["kind"];
      quantity: string;
      earTag: string;
      weightKg: string;
      unitPrice: string;
      freightAmount: string;
      commissionAmount: string;
      taxAmount: string;
      collectedAmount: string;
      currency: "USD" | "UYU";
      notes: string;
    }>
  >;
  handleAnimalSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  resetAnimalForm: (preserveContext?: boolean) => void;
  onEditMovement: (movementId: string) => void;
  requestDeleteAnimalMovement: (movementId: string) => void;
  transferRows: TransferRow[];
}

export function AgroTransfersSection({
  establishments,
  fields,
  animalForm,
  animalFormErrors,
  animalFormPanelRef,
  editingAnimalMovementId,
  registerAnimalFieldRef,
  clearAnimalFieldError,
  setAnimalForm,
  handleAnimalSubmit,
  resetAnimalForm,
  onEditMovement,
  requestDeleteAnimalMovement,
  transferRows
}: AgroTransfersSectionProps) {
  const selectedEstablishment = establishments.find((item) => item.id === animalForm.establishmentId);
  const selectedFields = fields.filter((item) => item.establishmentId === animalForm.establishmentId);
  const transferDestinationFields = fields.filter((item) => item.establishmentId === animalForm.transferDestinationEstablishmentId);

  const getEstablishmentName = (establishmentId: string) =>
    establishments.find((item) => item.id === establishmentId)?.name ?? "Campo";

  const getFieldName = (fieldId: string) => fields.find((item) => item.id === fieldId)?.name ?? "Potrero";

  const getCategoryLabel = (species: AgroSpecies, categoryCode: string) => {
    const category = categoryCatalog[species].find((item) => item.code === categoryCode);
    return category ? formatCategoryLabel(category.label) : categoryCode;
  };

  return (
    <section className="content-grid">
      <article ref={animalFormPanelRef} className="panel">
        <div className="panel-header">
          <div>
            <h2>Registrar traslado</h2>
            <p>Movelo de un potrero a otro sin tocar cantidades a mano. El origen baja y el destino sube en una sola operacion.</p>
          </div>
        </div>
        <form
          className="form-grid"
          onSubmit={handleAnimalSubmit}
        >
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
          <label>
            <span>Campo origen</span>
            <div className="readonly-field">{selectedEstablishment?.name ?? "-"}</div>
          </label>
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
                      ? selectedFields.find((field) => field.id !== nextFieldId)?.id ?? nextFieldId
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
          <label className={animalFormErrors.transferDestinationEstablishmentId ? "field-error" : undefined}>
            <span>Campo destino</span>
            <select
              ref={registerAnimalFieldRef("transferDestinationEstablishmentId")}
              value={animalForm.transferDestinationEstablishmentId}
              onChange={(event) => {
                clearAnimalFieldError("transferDestinationEstablishmentId");
                const nextEstablishmentId = event.target.value;
                const destinationFields = fields.filter((field) => field.establishmentId === nextEstablishmentId);
                const fallbackFieldId =
                  nextEstablishmentId === animalForm.establishmentId
                    ? destinationFields.find((field) => field.id !== animalForm.fieldId)?.id ?? destinationFields[0]?.id ?? ""
                    : destinationFields[0]?.id ?? "";
                setAnimalForm((current) => ({
                  ...current,
                  transferDestinationEstablishmentId: nextEstablishmentId,
                  transferDestinationFieldId: fallbackFieldId
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
              {(Object.keys(speciesLabels) as AgroSpecies[]).map((species) => (
                <option key={species} value={species}>
                  {speciesLabels[species]}
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
              {categoryCatalog[animalForm.species].map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className={animalFormErrors.quantity ? "field-error" : undefined}>
            <span>Cantidad</span>
            <input
              ref={registerAnimalFieldRef("quantity")}
              inputMode="decimal"
              value={animalForm.quantity}
              onChange={(event) => {
                clearAnimalFieldError("quantity");
                setAnimalForm((current) => ({ ...current, quantity: event.target.value }));
              }}
              placeholder="10"
            />
          </label>
          <label className="full-width">
            <span>Observacion</span>
            <textarea
              rows={3}
              value={animalForm.notes}
              onChange={(event) => setAnimalForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Ejemplo: lote para pastoreo corto o cambio de manga."
            />
          </label>
          <div className="form-actions full-width">
            <button type="submit" className="primary">
              {editingAnimalMovementId ? "Guardar traslado" : "Registrar traslado"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                resetAnimalForm(true);
                const firstField = selectedFields[0]?.id ?? "";
                const firstDifferentField =
                  selectedFields.find((field) => field.id !== firstField)?.id ?? firstField;
                setAnimalForm((current) => ({
                  ...current,
                  kind: "transfer",
                  establishmentId: current.establishmentId || selectedEstablishment?.id || "",
                  fieldId: current.fieldId || firstField,
                  transferDestinationEstablishmentId: current.establishmentId || selectedEstablishment?.id || "",
                  transferDestinationFieldId:
                    current.transferDestinationFieldId || firstDifferentField
                }));
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Historial de traslados</h2>
            <p>Un registro por operacion para revisar rapido de donde salio y a donde fue cada lote.</p>
          </div>
          <span className="data-badge">
            {movementKindLabels.transfer} {transferRows.length}
          </span>
        </div>
        <div className="table-wrap">
          <table className="animal-ledger-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Especie</th>
                <th>Categoria</th>
                <th>Cantidad</th>
                <th>Nota</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transferRows.length ? (
                transferRows.map((transfer) => (
                  <tr key={transfer.id}>
                    <td>{formatShortDate(transfer.date)}</td>
                    <td>
                      {getEstablishmentName(transfer.sourceEstablishmentId)} / {getFieldName(transfer.sourceFieldId)}
                    </td>
                    <td>
                      {getEstablishmentName(transfer.destinationEstablishmentId)} / {getFieldName(transfer.destinationFieldId)}
                    </td>
                    <td>{speciesLabels[transfer.species]}</td>
                    <td>{getCategoryLabel(transfer.species, transfer.categoryCode)}</td>
                    <td>{formatNumber(transfer.quantity, 0)}</td>
                    <td>{transfer.notes || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost" onClick={() => onEditMovement(transfer.editMovementId)}>
                          Editar
                        </button>
                        <button type="button" className="danger" onClick={() => requestDeleteAnimalMovement(transfer.editMovementId)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>Todavia no hay traslados cargados para el campo o potrero visible.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
