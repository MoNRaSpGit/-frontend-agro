import { categoryCatalog, establishments } from "./agro.demo.data";
import { AgroSpecies, IncomeConcept } from "./agro.types";

interface AgroSetupSectionProps {
  setupCutoffDate: string;
  initialStockForm: {
    establishmentId: string;
    species: AgroSpecies;
    categoryCode: string;
    quantity: string;
    notes: string;
  };
  initialReceivableForm: {
    establishmentId: string;
    concept: IncomeConcept;
    totalAmount: string;
    collectedAmount: string;
    notes: string;
  };
  setupSummary: {
    stockLoads: number;
    receivableLoads: number;
  };
  setSetupCutoffDate: (value: string) => void;
  setInitialStockForm: React.Dispatch<
    React.SetStateAction<{
      establishmentId: string;
      species: AgroSpecies;
      categoryCode: string;
      quantity: string;
      notes: string;
    }>
  >;
  setInitialReceivableForm: React.Dispatch<
    React.SetStateAction<{
      establishmentId: string;
      concept: IncomeConcept;
      totalAmount: string;
      collectedAmount: string;
      notes: string;
    }>
  >;
  resetInitialStockForm: () => void;
  resetInitialReceivableForm: () => void;
  onSubmitInitialStock: (event: React.FormEvent<HTMLFormElement>) => void;
  onSubmitInitialReceivable: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function AgroSetupSection({
  setupCutoffDate,
  initialStockForm,
  initialReceivableForm,
  setupSummary,
  setSetupCutoffDate,
  setInitialStockForm,
  setInitialReceivableForm,
  resetInitialStockForm,
  resetInitialReceivableForm,
  onSubmitInitialStock,
  onSubmitInitialReceivable
}: AgroSetupSectionProps) {
  const availableCategories = categoryCatalog[initialStockForm.species];

  return (
    <section className="content-grid">
      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Carga inicial</h2>
            <p>Sirve para arrancar de cero cargando base vieja sin tener que rehacer toda la historia.</p>
          </div>
        </div>
        <div className="inline-metrics">
          <span className="data-badge accent">Stock inicial cargado {setupSummary.stockLoads}</span>
          <span className="data-badge warning">Saldos a cobrar cargados {setupSummary.receivableLoads}</span>
        </div>
        <form className="form-grid top-gap">
          <label className="span-2">
            <span>Fecha de corte</span>
            <input type="date" value={setupCutoffDate} onChange={(event) => setSetupCutoffDate(event.target.value)} />
          </label>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Stock inicial de animales</h2>
            <p>Genera un ajuste positivo para dejar cargada la base actual del establecimiento.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmitInitialStock}>
          <label>
            <span>Establecimiento</span>
            <select
              value={initialStockForm.establishmentId}
              onChange={(event) => setInitialStockForm((current) => ({ ...current, establishmentId: event.target.value }))}
            >
              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Especie</span>
            <select
              value={initialStockForm.species}
              onChange={(event) => {
                const nextSpecies = event.target.value as AgroSpecies;
                setInitialStockForm((current) => ({
                  ...current,
                  species: nextSpecies,
                  categoryCode: categoryCatalog[nextSpecies][0]?.code ?? ""
                }));
              }}
            >
              <option value="vacunos">Vacunos</option>
              <option value="ovinos">Ovinos</option>
              <option value="equinos">Equinos</option>
            </select>
          </label>
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
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              Guardar stock inicial
            </button>
            <button type="button" className="ghost-button" onClick={resetInitialStockForm}>
              Limpiar
            </button>
          </div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Saldo inicial a cobrar</h2>
            <p>Deja cargadas ventas viejas o cobros pendientes sin tener que inventar caja ya cobrada.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmitInitialReceivable}>
          <label>
            <span>Establecimiento</span>
            <select
              value={initialReceivableForm.establishmentId}
              onChange={(event) =>
                setInitialReceivableForm((current) => ({ ...current, establishmentId: event.target.value }))
              }
            >
              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Concepto</span>
            <select
              value={initialReceivableForm.concept}
              onChange={(event) =>
                setInitialReceivableForm((current) => ({ ...current, concept: event.target.value as IncomeConcept }))
              }
            >
              <option value="venta_vacunos">Venta de vacunos</option>
              <option value="venta_ovinos">Venta de ovinos</option>
              <option value="venta_lana">Venta de lana</option>
              <option value="venta_equinos">Venta de equinos</option>
            </select>
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
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              Guardar saldo inicial
            </button>
            <button type="button" className="ghost-button" onClick={resetInitialReceivableForm}>
              Limpiar
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
