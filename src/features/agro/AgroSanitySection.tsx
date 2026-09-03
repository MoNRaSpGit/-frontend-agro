import { categoryCatalog, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatNumber, formatShortDate } from "./agro.home.shared";
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
    categoryCode: string;
    quantity: string;
    treatment: string;
    notes: string;
  };
  sanitaryCategoryOptions: Array<{ categoryCode: string; quantity: number }>;
  sanitarySpeciesAvailableQuantity: Record<AgroSpecies, number>;
  // Recalcular especie/categoria en el mismo tick que el cambio de
  // Potrero/Especie (en vez de esperar al useEffect de AgroHomePage, un
  // render despues) -- mismo bug intermitente "Esa categoria no tiene
  // stock disponible" que se arreglo en Animales, encontrado tambien aca.
  getSanitaryAvailabilityForField: (fieldId: string) => Map<AgroSpecies, Array<{ categoryCode: string; quantity: number }>>;
  sanitaryRows: Array<{
    id: string;
    date: string;
    establishmentId: string;
    fieldId: string;
    species: AgroSpecies;
    categoryCode: string;
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
      categoryCode: string;
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
  sanitaryCategoryOptions,
  sanitarySpeciesAvailableQuantity,
  getSanitaryAvailabilityForField,
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
  const selectedFields = fields.filter((item) => item.establishmentId === sanitaryForm.establishmentId);

  // Recalcula especie/categoria para el potrero que se acaba de elegir, en
  // el mismo tick que el cambio de fieldId -- ver el comentario de
  // getSanitaryAvailabilityForField en la interfaz de props de arriba.
  function resolveSpeciesAndCategoryForField(nextFieldId: string, currentSpecies: AgroSpecies, currentCategoryCode: string) {
    const availability = getSanitaryAvailabilityForField(nextFieldId);
    const availableSpecies = Array.from(availability.keys());
    const nextSpecies = availableSpecies.includes(currentSpecies) ? currentSpecies : availableSpecies[0] ?? currentSpecies;
    const nextCategories = availability.get(nextSpecies) ?? [];
    const nextCategoryCode = nextCategories.some((item) => item.categoryCode === currentCategoryCode)
      ? currentCategoryCode
      : nextCategories[0]?.categoryCode ?? "";
    return { species: nextSpecies, categoryCode: nextCategoryCode };
  }

  // Exporta exactamente lo que muestra "Planilla sanitaria" (ya filtrada
  // por "Buscar en sanidad").
  function buildSanitaryExportRows() {
    return sanitaryRows.map((record) => {
      const field = fields.find((item) => item.id === record.fieldId);
      const establishment = establishments.find((item) => item.id === record.establishmentId);
      const category = categoryCatalog[record.species]?.find((item) => item.code === record.categoryCode);
      return [
        record.date,
        establishment?.name ?? "-",
        field?.name ?? "-",
        speciesLabels[record.species],
        category ? formatCategoryLabel(category.label) : record.categoryCode || "-",
        record.quantity,
        record.treatment,
        record.notes || "-"
      ];
    });
  }

  async function exportSanitaryToExcel() {
    const { exportRowsToExcel } = await import("./agro.exportExcel");
    await exportRowsToExcel({
      sheetName: "Planilla sanitaria",
      columns: [
        { header: "Fecha", width: 12, numFmt: "dd/mm/yyyy" },
        { header: "Campo", width: 18 },
        { header: "Potrero", width: 18 },
        { header: "Especie", width: 12 },
        { header: "Categoria", width: 24 },
        { header: "Cantidad", width: 10, numFmt: "#,##0" },
        { header: "Tratamiento", width: 24 },
        { header: "Observaciones", width: 32 }
      ],
      rows: buildSanitaryExportRows().map((row) => [new Date(`${row[0]}T00:00:00`), ...row.slice(1)]),
      fileName: `planilla-sanitaria-${new Date().toISOString().slice(0, 10)}.xlsx`
    });
  }

  async function exportSanitaryToPdf() {
    const { exportRowsToPdf } = await import("./agro.exportPdf");
    const rows = buildSanitaryExportRows();
    await exportRowsToPdf({
      title: "Planilla sanitaria",
      subtitle: `${rows.length} tratamiento(s)`,
      columns: ["Fecha", "Campo", "Potrero", "Especie", "Categoria", "Cantidad", "Tratamiento", "Observaciones"],
      rows: rows.map((row) => [formatShortDate(String(row[0])), ...row.slice(1)]),
      fileName: `planilla-sanitaria-${new Date().toISOString().slice(0, 10)}.pdf`
    });
  }

  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar tratamiento sanitario</h2>
            <p>Registro simple por campo y potrero con cantidad, tratamiento y fecha.</p>
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
          <label className="span-2">
            <span>Potrero</span>
            <select
              value={sanitaryForm.fieldId}
              onChange={(event) => {
                const nextFieldId = event.target.value;
                setSanitaryForm((current) => ({
                  ...current,
                  fieldId: nextFieldId,
                  ...resolveSpeciesAndCategoryForField(nextFieldId, current.species, current.categoryCode)
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
          <label>
            <span>Especie</span>
            <select
              value={sanitaryForm.species}
              onChange={(event) => {
                const nextSpecies = event.target.value as AgroSpecies;
                // La categoria se recalcula aca mismo (en el mismo tick que
                // la especie), en vez de esperar al efecto de autocompletado
                // de AgroHomePage -- ver getSanitaryAvailabilityForField.
                setSanitaryForm((current) => {
                  const nextCategories = getSanitaryAvailabilityForField(current.fieldId).get(nextSpecies) ?? [];
                  const nextCategoryCode = nextCategories.some((item) => item.categoryCode === current.categoryCode)
                    ? current.categoryCode
                    : nextCategories[0]?.categoryCode ?? "";
                  return { ...current, species: nextSpecies, categoryCode: nextCategoryCode };
                });
              }}
            >
              {Object.entries(speciesLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {`${label} (${formatNumber(sanitarySpeciesAvailableQuantity[value as AgroSpecies] ?? 0, 0)} en el potrero)`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Categoria</span>
            {sanitaryCategoryOptions.length ? (
              <select
                value={sanitaryForm.categoryCode}
                onChange={(event) => setSanitaryForm((current) => ({ ...current, categoryCode: event.target.value }))}
              >
                {sanitaryCategoryOptions.map(({ categoryCode, quantity }) => {
                  const category = categoryCatalog[sanitaryForm.species].find((item) => item.code === categoryCode);
                  return (
                    <option key={categoryCode} value={categoryCode}>
                      {`${formatCategoryLabel(category?.label ?? categoryCode)} (${formatNumber(quantity, 0)} en el potrero)`}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="readonly-field">No hay animales de esta especie en este potrero.</div>
            )}
          </label>
          <label>
            <span>Cantidad de animales</span>
            <input
              type="text"
              inputMode="numeric"
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
            <p>Lectura cronologica de tratamientos por campo y potrero.</p>
          </div>
          <div className="table-actions">
            <button
              type="button"
              className="ghost-button excel-button"
              onClick={() => void exportSanitaryToExcel()}
              disabled={sanitaryRows.length === 0}
            >
              Exportar a Excel
            </button>
            <button
              type="button"
              className="ghost-button pdf-button"
              onClick={() => void exportSanitaryToPdf()}
              disabled={sanitaryRows.length === 0}
            >
              Exportar a PDF
            </button>
          </div>
        </div>
        <label className="table-search">
          <span>Buscar en sanidad</span>
          <input
            type="search"
            placeholder="Campo, potrero, fecha, tratamiento u observacion..."
            value={sanitarySearchTerm}
            onChange={(event) => setSanitarySearchTerm(event.target.value)}
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Campo</th>
                <th>Potrero</th>
                <th>Especie</th>
                <th>Categoria</th>
                <th>Cantidad</th>
                <th>Tratamiento</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sanitaryRows.map((record) => {
                const field = fields.find((item) => item.id === record.fieldId);
                const establishment = establishments.find((item) => item.id === record.establishmentId);
                const category = categoryCatalog[record.species]?.find((item) => item.code === record.categoryCode);
                return (
                  <tr key={record.id}>
                    <td>{formatShortDate(record.date)}</td>
                    <td>{establishment?.name ?? "-"}</td>
                    <td>{field?.name ?? "-"}</td>
                    <td>{speciesLabels[record.species]}</td>
                    <td>{category ? formatCategoryLabel(category.label) : record.categoryCode || "-"}</td>
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
