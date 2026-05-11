import { formatShortDate } from "./agro.home.shared";
import { Establishment, FieldUnit } from "./agro.types";

interface AgroRainfallSectionProps {
  establishments: Establishment[];
  fields: FieldUnit[];
  getFieldIdForEstablishment: (establishmentId: string) => string;
  editingRainfallRecordId: string | null;
  rainfallForm: {
    date: string;
    establishmentId: string;
    fieldId: string;
    millimeters: string;
    notes: string;
  };
  rainfallRows: Array<{
    id: string;
    date: string;
    fieldId: string;
    millimeters: number;
    notes: string;
  }>;
  rainfallSearchTerm: string;
  resetRainfallForm: () => void;
  requestDeleteRainfallRecord: (recordId: string) => void;
  setRainfallForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      establishmentId: string;
      fieldId: string;
      millimeters: string;
      notes: string;
    }>
  >;
  setRainfallSearchTerm: (value: string) => void;
  onEditRainfallRecord: (recordId: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function AgroRainfallSection({
  establishments,
  fields,
  getFieldIdForEstablishment,
  editingRainfallRecordId,
  rainfallForm,
  rainfallRows,
  rainfallSearchTerm,
  resetRainfallForm,
  requestDeleteRainfallRecord,
  setRainfallForm,
  setRainfallSearchTerm,
  onEditRainfallRecord,
  onSubmit
}: AgroRainfallSectionProps) {
  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar lluvia por establecimiento</h2>
            <p>Carga manual para llevar el registro de lluvias del establecimiento.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="span-2">
            <span>Fecha</span>
            <input
              type="date"
              value={rainfallForm.date}
              onChange={(event) => setRainfallForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label className="span-2">
            <span>Establecimiento</span>
            <select
              value={rainfallForm.establishmentId}
              onChange={(event) => {
                const nextEstablishmentId = event.target.value;
                setRainfallForm((current) => ({
                  ...current,
                  establishmentId: nextEstablishmentId,
                  fieldId: getFieldIdForEstablishment(nextEstablishmentId)
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
            <span>Milimetros</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={rainfallForm.millimeters}
              onChange={(event) => setRainfallForm((current) => ({ ...current, millimeters: event.target.value }))}
            />
          </label>
          <label className="span-2">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={rainfallForm.notes}
              onChange={(event) => setRainfallForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              {editingRainfallRecordId ? "Guardar cambios" : "Guardar lluvia"}
            </button>
            {editingRainfallRecordId ? (
              <button type="button" className="ghost-button" onClick={resetRainfallForm}>
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Bitacora de lluvias</h2>
            <p>Ultimos registros del establecimiento que estas mirando.</p>
          </div>
        </div>
        <label className="table-search">
          <span>Buscar en lluvias</span>
          <input
            type="search"
            placeholder="Establecimiento, fecha, observacion o mm..."
            value={rainfallSearchTerm}
            onChange={(event) => setRainfallSearchTerm(event.target.value)}
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Establecimiento</th>
                <th>Milimetros</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rainfallRows.map((record) => {
                const field = fields.find((item) => item.id === record.fieldId);
                return (
                  <tr key={record.id}>
                    <td>{formatShortDate(record.date)}</td>
                    <td>{field?.name ?? "-"}</td>
                    <td>{record.millimeters} mm</td>
                    <td>{record.notes || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => onEditRainfallRecord(record.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => requestDeleteRainfallRecord(record.id)}
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
