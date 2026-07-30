import { categoryCatalog, movementKindLabels, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatNumber, formatShortDate, getMovementDirection } from "./agro.home.shared";
import { AgroSpecies, AnimalMovementRecord, Establishment, FieldUnit } from "./agro.types";

interface AgroStockCorrectionSectionProps {
  establishments: Establishment[];
  correctionFields: FieldUnit[];
  correctionEstablishmentId: string;
  correctionFieldId: string;
  onChangeEstablishment: (establishmentId: string) => void;
  onChangeField: (fieldId: string) => void;
  correctionFieldStock: Record<AgroSpecies, Array<{ categoryCode: string; quantity: number }>>;
  correctionSelectedRow: { species: AgroSpecies; categoryCode: string } | null;
  correctionSelectedCurrentQuantity: number;
  correctionSelectedHistory: AnimalMovementRecord[];
  correctionTargetQuantity: string;
  correctionNotes: string;
  onSelectRow: (species: AgroSpecies, categoryCode: string) => void;
  onCancelSelection: () => void;
  onChangeTargetQuantity: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function getMovementLabel(kind: AnimalMovementRecord["kind"]) {
  if (kind === "transfer_in" || kind === "transfer_out") {
    return "Traslado";
  }

  return movementKindLabels[kind as keyof typeof movementKindLabels] ?? kind;
}

export function AgroStockCorrectionSection({
  establishments,
  correctionFields,
  correctionEstablishmentId,
  correctionFieldId,
  onChangeEstablishment,
  onChangeField,
  correctionFieldStock,
  correctionSelectedRow,
  correctionSelectedCurrentQuantity,
  correctionSelectedHistory,
  correctionTargetQuantity,
  correctionNotes,
  onSelectRow,
  onCancelSelection,
  onChangeTargetQuantity,
  onChangeNotes,
  onSubmit
}: AgroStockCorrectionSectionProps) {
  const selectedCategory = correctionSelectedRow
    ? categoryCatalog[correctionSelectedRow.species].find((item) => item.code === correctionSelectedRow.categoryCode)
    : undefined;

  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Stock por potrero</h2>
            <p>Elegi el establecimiento y el potrero para ver y corregir el stock actual por categoria.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>Establecimiento</span>
            <select value={correctionEstablishmentId} onChange={(event) => onChangeEstablishment(event.target.value)}>
              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Potrero</span>
            <select value={correctionFieldId} onChange={(event) => onChangeField(event.target.value)}>
              {correctionFields.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table className="stock-correction-table">
            <thead>
              <tr>
                <th>Especie</th>
                <th>Categoria</th>
                <th>Cantidad actual</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(speciesLabels) as AgroSpecies[]).map((species) =>
                correctionFieldStock[species].map((row) => {
                  const category = categoryCatalog[species].find((item) => item.code === row.categoryCode);
                  const isSelected =
                    correctionSelectedRow?.species === species && correctionSelectedRow?.categoryCode === row.categoryCode;
                  return (
                    <tr key={`${species}-${row.categoryCode}`} className={isSelected ? "is-selected-row" : undefined}>
                      <td>{speciesLabels[species]}</td>
                      <td>{category ? formatCategoryLabel(category.label) : row.categoryCode}</td>
                      <td>{formatNumber(row.quantity, 0)}</td>
                      <td>
                        <button type="button" className="ghost-button" onClick={() => onSelectRow(species, row.categoryCode)}>
                          {isSelected ? "Corrigiendo" : "Corregir"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Corregir categoria elegida</h2>
            <p>El total correcto que escribas reemplaza al que muestra el sistema, con el historial que lo explica.</p>
          </div>
        </div>
        {correctionSelectedRow ? (
          <>
            <p>
              <strong>{speciesLabels[correctionSelectedRow.species]}</strong>
              {" - "}
              {selectedCategory ? formatCategoryLabel(selectedCategory.label) : correctionSelectedRow.categoryCode}
            </p>
            <form className="form-grid" onSubmit={onSubmit}>
              <label>
                <span>Cantidad actual segun el sistema</span>
                <div className="readonly-field">{formatNumber(correctionSelectedCurrentQuantity, 0)}</div>
              </label>
              <label>
                <span>Cantidad correcta</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={correctionTargetQuantity}
                  onChange={(event) => onChangeTargetQuantity(event.target.value)}
                />
              </label>
              <label className="span-2">
                <span>Observaciones</span>
                <textarea rows={2} value={correctionNotes} onChange={(event) => onChangeNotes(event.target.value)} />
              </label>
              <div className="action-row span-2">
                <button type="submit" className="primary-button">
                  Guardar correccion
                </button>
                <button type="button" className="ghost-button" onClick={onCancelSelection}>
                  Cancelar
                </button>
              </div>
            </form>

            <h3>Historial de esta categoria en este potrero</h3>
            {correctionSelectedHistory.length === 0 ? (
              <p>Todavia no hay movimientos cargados para esta categoria en este potrero.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Movimiento</th>
                      <th>Cantidad</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionSelectedHistory.map((movement) => (
                      <tr key={movement.id}>
                        <td>{formatShortDate(movement.date)}</td>
                        <td>{getMovementLabel(movement.kind)}</td>
                        <td>
                          {getMovementDirection(movement) === "entry" ? "+" : "-"}
                          {formatNumber(movement.quantity, 0)}
                        </td>
                        <td>{movement.notes.trim() || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p>Elegi una fila de la tabla para corregir esa categoria.</p>
        )}
      </article>
    </section>
  );
}
