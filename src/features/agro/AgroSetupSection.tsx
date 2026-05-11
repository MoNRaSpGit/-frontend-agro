import { categoryCatalog } from "./agro.demo.data";
import { AgroSpecies, Establishment } from "./agro.types";

interface AgroSetupSectionProps {
  establishments: Establishment[];
  setupCutoffDate: string;
  setupEstablishmentId: string;
  setupSpecies: AgroSpecies;
  newEstablishmentForm: {
    name: string;
  };
  initialStockForm: {
    categoryCode: string;
    quantity: string;
    notes: string;
  };
  initialReceivableForm: {
    totalAmount: string;
    collectedAmount: string;
    notes: string;
  };
  setupSummary: {
    stockLoads: number;
    receivableLoads: number;
  };
  setSetupCutoffDate: (value: string) => void;
  setSetupEstablishmentId: (value: string) => void;
  setSetupSpecies: (value: AgroSpecies) => void;
  setNewEstablishmentForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
    }>
  >;
  setInitialStockForm: React.Dispatch<
    React.SetStateAction<{
      categoryCode: string;
      quantity: string;
      notes: string;
    }>
  >;
  setInitialReceivableForm: React.Dispatch<
    React.SetStateAction<{
      totalAmount: string;
      collectedAmount: string;
      notes: string;
    }>
  >;
  resetInitialStockForm: () => void;
  resetInitialReceivableForm: () => void;
  onAddEstablishment: () => void;
  onSubmitInitialLoad: () => void;
}

export function AgroSetupSection({
  establishments,
  setupCutoffDate,
  setupEstablishmentId,
  setupSpecies,
  newEstablishmentForm,
  initialStockForm,
  initialReceivableForm,
  setupSummary,
  setSetupCutoffDate,
  setSetupEstablishmentId,
  setSetupSpecies,
  setNewEstablishmentForm,
  setInitialStockForm,
  setInitialReceivableForm,
  resetInitialStockForm,
  resetInitialReceivableForm,
  onAddEstablishment,
  onSubmitInitialLoad
}: AgroSetupSectionProps) {
  const availableCategories = categoryCatalog[setupSpecies];
  const conceptLabelBySpecies: Record<AgroSpecies, string> = {
    vacunos: "Venta de vacunos",
    ovinos: "Venta de ovinos",
    equinos: "Venta de equinos"
  };

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
          <span className="data-badge warning">Saldos a cobrar cargados {setupSummary.receivableLoads}</span>
        </div>
        <form className="form-grid top-gap">
          <label>
            <span>Fecha de corte</span>
            <input type="date" value={setupCutoffDate} onChange={(event) => setSetupCutoffDate(event.target.value)} />
          </label>
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

          <section className="subpanel">
            <div className="panel-header">
              <div>
                <h2>Saldo inicial a cobrar</h2>
                <p>Cuenta base a cobrar para el mismo establecimiento y especie.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="span-2">
                <span>Concepto</span>
                <input type="text" value={conceptLabelBySpecies[setupSpecies]} readOnly />
              </label>
              <label>
                <span>Total a cobrar</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialReceivableForm.totalAmount}
                  onChange={(event) => setInitialReceivableForm((current) => ({ ...current, totalAmount: event.target.value }))}
                />
              </label>
              <label>
                <span>Ya cobrado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialReceivableForm.collectedAmount}
                  onChange={(event) =>
                    setInitialReceivableForm((current) => ({ ...current, collectedAmount: event.target.value }))
                  }
                />
              </label>
              <label className="span-2">
                <span>Observaciones</span>
                <textarea
                  rows={3}
                  value={initialReceivableForm.notes}
                  onChange={(event) => setInitialReceivableForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="action-row top-gap">
          <button type="button" className="primary-button" onClick={onSubmitInitialLoad}>
            Guardar carga inicial
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              resetInitialStockForm();
              resetInitialReceivableForm();
            }}
          >
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
