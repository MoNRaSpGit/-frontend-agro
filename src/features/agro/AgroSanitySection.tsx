import { formatShortDate } from "./agro.home.shared";
import { speciesLabels } from "./agro.demo.data";
import { Establishment, FieldUnit } from "./agro.types";
import type { AgroSpecies } from "./agro.types";

interface AgroSanitySectionProps {
  establishments: Establishment[];
  fields: FieldUnit[];
  editingSanitaryRecordId: string | null;
  sanitaryForm: {
    date: string;
    establishmentId: string;
    fieldId: string;
    species: AgroSpecies;
    quantity: string;
    treatment: string;
    notes: string;
  };
  sanitaryRows: Array<{
    id: string;
    date: string;
    establishmentId: string;
    fieldId: string;
    species: AgroSpecies;
    quantity: number;
    treatment: string;
    notes: string;
  }>;
  sanitarySearchTerm: string;
  resetSanitaryForm: () => void;
  requestDeleteSanitaryRecord: (recordId: string) => void;
  setSanitaryForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      establishmentId: string;
      fieldId: string;
      species: AgroSpecies;
      quantity: string;
      treatment: string;
      notes: string;
    }>
  >;
  setSanitarySearchTerm: (value: string) => void;
  onEditSanitaryRecord: (recordId: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function AgroSanitySection({
  establishments,
  fields,
  editingSanitaryRecordId,
  sanitaryForm,
  sanitaryRows,
  sanitarySearchTerm,
  resetSanitaryForm,
  requestDeleteSanitaryRecord,
  setSanitaryForm,
  setSanitarySearchTerm,
  onEditSanitaryRecord,
  onSubmit
}: AgroSanitySectionProps) {
  const selectedEstablishment = establishments.find((item) => item.id === sanitaryForm.establishmentId);

  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar tratamiento sanitario</h2>
            <p>Registro simple por establecimiento con cantidad, tratamiento y fecha.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="span-2">
            <span>Fecha</span>
            <input
              type="date"
              value={sanitaryForm.date}
              onChange={(event) => setSanitaryForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label className="span-2">
            <span>Campo activo</span>
            <div className="readonly-field">{selectedEstablishment?.name ?? "-"}</div>
          </label>
          <label>
            <span>Especie</span>
            <select
              value={sanitaryForm.species}
              onChange={(event) => setSanitaryForm((current) => ({ ...current, species: event.target.value as AgroSpecies }))}
            >
              {Object.entries(speciesLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cantidad de animales</span>
            <input
              type="number"
              min="1"
              step="1"
              value={sanitaryForm.quantity}
              onChange={(event) => setSanitaryForm((current) => ({ ...current, quantity: event.target.value }))}
            />
          </label>
          <label>
            <span>Tratamiento sanitario</span>
            <input
              type="text"
              value={sanitaryForm.treatment}
              onChange={(event) => setSanitaryForm((current) => ({ ...current, treatment: event.target.value }))}
            />
          </label>
          <label className="span-2">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={sanitaryForm.notes}
              onChange={(event) => setSanitaryForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              {editingSanitaryRecordId ? "Guardar cambios" : "Guardar tratamiento"}
            </button>
            {editingSanitaryRecordId ? (
              <button type="button" className="ghost-button" onClick={resetSanitaryForm}>
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Planilla sanitaria</h2>
            <p>Lectura cronologica de tratamientos por establecimiento.</p>
          </div>
        </div>
        <label className="table-search">
          <span>Buscar en sanidad</span>
          <input
            type="search"
            placeholder="Establecimiento, fecha, tratamiento u observacion..."
            value={sanitarySearchTerm}
            onChange={(event) => setSanitarySearchTerm(event.target.value)}
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Establecimiento</th>
                <th>Especie</th>
                <th>Cantidad</th>
                <th>Tratamiento</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sanitaryRows.map((record) => {
                const field = fields.find((item) => item.id === record.fieldId);
                return (
                  <tr key={record.id}>
                    <td>{formatShortDate(record.date)}</td>
                    <td>{field?.name ?? "-"}</td>
                    <td>{speciesLabels[record.species]}</td>
                    <td>{record.quantity}</td>
                    <td>{record.treatment}</td>
                    <td>{record.notes || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => onEditSanitaryRecord(record.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => requestDeleteSanitaryRecord(record.id)}
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
  );
}
