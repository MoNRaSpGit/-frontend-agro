import { categoryCatalog } from "./agro.demo.data";
import { AgroSpecies, Establishment } from "./agro.types";

interface AgroSetupSectionProps {
  establishments: Establishment[];
  setupEstablishmentId: string;
  setupSpecies: AgroSpecies;
  newEstablishmentForm: {
    name: string;
    hectares: string;
  };
  initialStockForm: {
    categoryCode: string;
    quantity: string;
    notes: string;
  };
  setupSummary: {
    stockLoads: number;
  };
  setSetupEstablishmentId: (value: string) => void;
  setSetupSpecies: (value: AgroSpecies) => void;
  setNewEstablishmentForm: React.Dispatch<
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
  onSubmitInitialLoad: () => void;
}

export function AgroSetupSection({
  establishments,
  setupEstablishmentId,
  setupSpecies,
  newEstablishmentForm,
  initialStockForm,
  setupSummary,
  setSetupEstablishmentId,
  setSetupSpecies,
  setNewEstablishmentForm,
  setInitialStockForm,
  resetInitialStockForm,
  onAddEstablishment,
  onSubmitInitialLoad
}: AgroSetupSectionProps) {
  const availableCategories = categoryCatalog[setupSpecies];

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
                  type="number"
                  min="1"
                  step="1"
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
            <label>
              <span>Nombre</span>
              <input
                type="text"
                value={newEstablishmentForm.name}
                onChange={(event) => setNewEstablishmentForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Hectareas</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newEstablishmentForm.hectares}
                onChange={(event) => setNewEstablishmentForm((current) => ({ ...current, hectares: event.target.value }))}
              />
            </label>
            <div className="action-row span-2">
              <button type="button" className="primary-button" onClick={onAddEstablishment}>
                Crear campo
              </button>
            </div>
          </div>
        </section>
      </article>
    </section>
  );
}
