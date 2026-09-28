import { useMemo, useState } from "react";
import { categoryCatalog, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatNumber } from "./agro.home.shared";
import { AgroSpecies, Establishment, FieldUnit } from "./agro.types";

type AgroFieldStockSectionProps = {
  establishments: Establishment[];
  fields: FieldUnit[];
  // Mismo mapa (fieldId:species:categoryCode -> cantidad) que ya usa toda la
  // app para saber cuanto stock hay -- no se recalcula nada nuevo aca.
  stockBalanceMap: Map<string, number>;
};

// Pestana "Potrero" (28/09/2026, pedido explicito): elegir campo y potrero
// y ver, de forma simple, cuantos animales hay ahora de cada categoria --
// mismo formato que el PDF de registro: "La Milagrosa, Potrero 8 -> 5 Vacas
// de cria, 3 Potrillos...".
export function AgroFieldStockSection({ establishments, fields, stockBalanceMap }: AgroFieldStockSectionProps) {
  const [establishmentId, setEstablishmentId] = useState(establishments[0]?.id ?? "");
  const fieldsForEstablishment = useMemo(
    () => fields.filter((field) => field.establishmentId === establishmentId),
    [fields, establishmentId]
  );
  const [fieldId, setFieldId] = useState(fieldsForEstablishment[0]?.id ?? "");

  function handleEstablishmentChange(nextEstablishmentId: string) {
    setEstablishmentId(nextEstablishmentId);
    const nextFields = fields.filter((field) => field.establishmentId === nextEstablishmentId);
    setFieldId(nextFields[0]?.id ?? "");
  }

  const selectedField = fields.find((field) => field.id === fieldId);
  const selectedEstablishment = establishments.find((item) => item.id === establishmentId);

  const rows = useMemo(() => {
    if (!fieldId) return [];

    const result: Array<{ species: AgroSpecies; label: string; quantity: number }> = [];
    (Object.keys(speciesLabels) as AgroSpecies[]).forEach((species) => {
      categoryCatalog[species].forEach((category) => {
        const key = `${fieldId}:${species}:${category.code}`;
        const quantity = stockBalanceMap.get(key) ?? 0;
        if (quantity > 0) {
          result.push({ species, label: formatCategoryLabel(category.label), quantity });
        }
      });
    });
    return result.sort((left, right) => right.quantity - left.quantity);
  }, [fieldId, stockBalanceMap]);

  return (
    <section className="content-grid">
      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Potrero</h2>
            <p>Cuantos animales hay hoy en un potrero, por categoria.</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="table-search">
            <span>Campo</span>
            <select value={establishmentId} onChange={(event) => handleEstablishmentChange(event.target.value)}>
              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="table-search">
            <span>Potrero</span>
            <select value={fieldId} onChange={(event) => setFieldId(event.target.value)}>
              {fieldsForEstablishment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedEstablishment && selectedField ? (
          <div className="field-stock-result">
            <h3 className="field-stock-title">
              {selectedEstablishment.name} — Potrero {selectedField.name}
            </h3>
            {rows.length ? (
              <ul className="field-stock-list">
                {rows.map((row) => (
                  <li key={`${row.species}:${row.label}`} className="field-stock-row">
                    <span className="field-stock-quantity">{formatNumber(row.quantity, 0)}</span>
                    <span className="field-stock-label">{row.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-stock-empty">Este potrero no tiene animales cargados.</p>
            )}
          </div>
        ) : (
          <p className="field-stock-empty">Elegi un campo y un potrero para ver el stock.</p>
        )}
      </article>
    </section>
  );
}
