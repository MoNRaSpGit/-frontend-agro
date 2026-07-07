import { useEffect, useState } from "react";
import { categoryCatalog } from "./agro.demo.data";
import { AgroSpecies, Establishment } from "./agro.types";

interface AgroSetupSectionProps {
  establishments: Establishment[];
  setupFields: Array<{
    id: string;
    name: string;
    hectares: number;
    canDelete: boolean;
    deleteBlockReason: string | null;
  }>;
  setupEstablishmentId: string;
  setupFieldId: string;
  setupSpecies: AgroSpecies;
  newEstablishmentForm: {
    name: string;
    hectares: string;
    firstFieldName: string;
    firstFieldHectares: string;
  };
  newFieldForm: {
    name: string;
    hectares: string;
  };
  initialStockForm: {
    categoryCode: string;
    quantity: string;
    notes: string;
  };
  newEstablishmentErrors: {
    name?: string;
    hectares?: string;
    firstFieldName?: string;
    firstFieldHectares?: string;
  };
  newFieldErrors: {
    name?: string;
    hectares?: string;
  };
  setupSummary: {
    stockLoads: number;
  };
  setSetupEstablishmentId: (value: string) => void;
  setSetupFieldId: (value: string) => void;
  setSetupSpecies: (value: AgroSpecies) => void;
  clearNewEstablishmentError: (fieldName: "name" | "hectares" | "firstFieldName" | "firstFieldHectares") => void;
  clearNewFieldError: (fieldName: "name" | "hectares") => void;
  setNewEstablishmentForm: React.Dispatch<
      React.SetStateAction<{
        name: string;
        hectares: string;
        firstFieldName: string;
        firstFieldHectares: string;
      }>
  >;
  setNewFieldForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      hectares: string;
    }>
  >;
  setInitialStockForm: React.Dispatch<
    React.SetStateAction<{
      categoryCode: string;
      quantity: string;
      notes: string;
    }>
  >;
  resetInitialStockForm: () => void;
  onAddEstablishment: () => void;
  onAddField: () => void;
  onDeleteField: (fieldId: string) => void;
  onMergeField: (sourceFieldId: string, targetFieldId: string) => void;
  onSubmitInitialLoad: () => void;
}

export function AgroSetupSection({
  establishments,
  setupFields,
  setupEstablishmentId,
  setupFieldId,
  setupSpecies,
  newEstablishmentForm,
  newFieldForm,
  initialStockForm,
  newEstablishmentErrors,
  newFieldErrors,
  setupSummary,
  setSetupEstablishmentId,
  setSetupFieldId,
  setSetupSpecies,
  clearNewEstablishmentError,
  clearNewFieldError,
  setNewEstablishmentForm,
  setNewFieldForm,
  setInitialStockForm,
  resetInitialStockForm,
  onAddEstablishment,
  onAddField,
  onDeleteField,
  onMergeField,
  onSubmitInitialLoad
}: AgroSetupSectionProps) {
  const availableCategories = categoryCatalog[setupSpecies];
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});

  useEffect(() => {
    setMergeTargets((current) => {
      const next: Record<string, string> = {};

      for (const field of setupFields) {
        const alternatives = setupFields.filter((item) => item.id !== field.id);
        const currentTarget = current[field.id];
        next[field.id] = alternatives.some((item) => item.id === currentTarget) ? currentTarget : alternatives[0]?.id ?? "";
      }

      return next;
    });
  }, [setupFields]);

  return (
    <section className="content-grid">
      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Carga inicial</h2>
            <p>Definí una sola foto base y cargá todo desde ese mismo recuadro.</p>
          </div>
        </div>
        <div className="inline-metrics">
          <span className="data-badge accent">Stock inicial cargado {setupSummary.stockLoads}</span>
        </div>
        <form className="form-grid top-gap">
          <label>
            <span>Establecimiento</span>
            <select value={setupEstablishmentId} onChange={(event) => setSetupEstablishmentId(event.target.value)}>
              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Potrero</span>
            <select value={setupFieldId} onChange={(event) => setSetupFieldId(event.target.value)}>
              {setupFields.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Especie</span>
            <select value={setupSpecies} onChange={(event) => setSetupSpecies(event.target.value as AgroSpecies)}>
              <option value="vacunos">Vacunos</option>
              <option value="ovinos">Ovinos</option>
              <option value="equinos">Equinos</option>
            </select>
          </label>
        </form>

        <div className="content-grid top-gap">
          <section className="subpanel">
            <div className="panel-header">
              <div>
                <h2>Stock inicial de animales</h2>
                <p>Base actual del establecimiento para la especie seleccionada.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>Categoria</span>
                <select
                  value={initialStockForm.categoryCode}
                  onChange={(event) => setInitialStockForm((current) => ({ ...current, categoryCode: event.target.value }))}
                >
                  {availableCategories.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cantidad</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialStockForm.quantity}
                  onChange={(event) => setInitialStockForm((current) => ({ ...current, quantity: event.target.value }))}
                />
              </label>
              <label className="span-2">
                <span>Observaciones</span>
                <textarea
                  rows={3}
                  value={initialStockForm.notes}
                  onChange={(event) => setInitialStockForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="action-row top-gap">
          <button type="button" className="primary-button" onClick={onSubmitInitialLoad}>
            Guardar carga inicial
          </button>
          <button type="button" className="ghost-button" onClick={resetInitialStockForm}>
            Limpiar
          </button>
        </div>

        <section className="subpanel top-gap">
          <div className="panel-header">
            <div>
              <h2>Crear campo</h2>
              <p>Agrega un establecimiento nuevo para usarlo en todo agro.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className={newEstablishmentErrors.name ? "field-error" : undefined}>
              <span>Nombre</span>
              <input
                type="text"
                value={newEstablishmentForm.name}
                onChange={(event) => {
                  clearNewEstablishmentError("name");
                  setNewEstablishmentForm((current) => ({ ...current, name: event.target.value }));
                }}
              />
            </label>
            <label className={newEstablishmentErrors.hectares ? "field-error" : undefined}>
              <span>Hectareas</span>
              <input
                type="text"
                inputMode="decimal"
                value={newEstablishmentForm.hectares}
                onChange={(event) => {
                  clearNewEstablishmentError("hectares");
                  setNewEstablishmentForm((current) => ({ ...current, hectares: event.target.value }));
                }}
              />
            </label>
            <label className={newEstablishmentErrors.firstFieldName ? "field-error" : undefined}>
              <span>Primer potrero</span>
              <input
                type="text"
                value={newEstablishmentForm.firstFieldName}
                onChange={(event) => {
                  clearNewEstablishmentError("firstFieldName");
                  setNewEstablishmentForm((current) => ({ ...current, firstFieldName: event.target.value }));
                }}
              />
            </label>
            <label className={newEstablishmentErrors.firstFieldHectares ? "field-error" : undefined}>
              <span>Hectareas del potrero</span>
              <input
                type="text"
                inputMode="decimal"
                value={newEstablishmentForm.firstFieldHectares}
                onChange={(event) => {
                  clearNewEstablishmentError("firstFieldHectares");
                  setNewEstablishmentForm((current) => ({ ...current, firstFieldHectares: event.target.value }));
                }}
              />
            </label>
            <div className="action-row span-2">
              <button type="button" className="primary-button" onClick={onAddEstablishment}>
                Crear campo
              </button>
            </div>
          </div>
        </section>

        <section className="subpanel top-gap">
          <div className="panel-header">
            <div>
              <h2>Agregar potrero</h2>
              <p>Sumale potreros nuevos al establecimiento que ya elegiste arriba.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Campo</span>
              <select value={setupEstablishmentId} onChange={(event) => setSetupEstablishmentId(event.target.value)}>
                {establishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={newFieldErrors.name ? "field-error" : undefined}>
              <span>Nombre del potrero</span>
              <input
                type="text"
                value={newFieldForm.name}
                onChange={(event) => {
                  clearNewFieldError("name");
                  setNewFieldForm((current) => ({ ...current, name: event.target.value }));
                }}
              />
            </label>
            <label className={newFieldErrors.hectares ? "field-error" : undefined}>
              <span>Hectareas del potrero</span>
              <input
                type="text"
                inputMode="decimal"
                value={newFieldForm.hectares}
                onChange={(event) => {
                  clearNewFieldError("hectares");
                  setNewFieldForm((current) => ({ ...current, hectares: event.target.value }));
                }}
              />
            </label>
            <div className="action-row span-2">
              <button type="button" className="primary-button" onClick={onAddField}>
                Agregar potrero
              </button>
            </div>
          </div>
        </section>

        <section className="subpanel top-gap">
          <div className="panel-header">
            <div>
              <h2>Potreros del campo</h2>
              <p>Elimina solo potreros vacios creados por error.</p>
            </div>
          </div>
          <div className="list-stack">
            {setupFields.map((field) => (
              <div key={field.id} className="list-row">
                <div>
                  <strong>{field.name}</strong>
                  <span>{field.hectares} ha</span>
                  {field.deleteBlockReason ? <span>{field.deleteBlockReason}</span> : null}
                </div>
                <div className="field-row-actions">
                  {field.canDelete ? (
                    <button type="button" className="ghost-button danger" onClick={() => onDeleteField(field.id)}>
                      Eliminar
                    </button>
                  ) : setupFields.length > 1 ? (
                    <>
                      <select
                        value={mergeTargets[field.id] ?? ""}
                        onChange={(event) =>
                          setMergeTargets((current) => ({
                            ...current,
                            [field.id]: event.target.value
                          }))
                        }
                        aria-label={`Potrero destino para fusionar ${field.name}`}
                      >
                        {setupFields
                          .filter((item) => item.id !== field.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="ghost-button danger"
                        onClick={() => onMergeField(field.id, mergeTargets[field.id] ?? "")}
                      >
                        Fusionar y eliminar
                      </button>
                    </>
                  ) : (
                    <span>Crea primero otro potrero para mover los datos.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </article>
    </section>
  );
}
