import { formatMoney, periodMonthOptions } from "./agro.home.shared";
import { Establishment } from "./agro.types";

interface AgroToolbarProps {
  availableYears: string[];
  establishments: Establishment[];
  selectedEstablishmentId: string;
  selectedMonth: string;
  selectedYear: string;
  onEstablishmentChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
}

interface AgroMetricsGridProps {
  accountingTotals: {
    USD: { income: number; livestockPurchaseExpense: number; operationalExpense: number };
    UYU: { income: number; livestockPurchaseExpense: number; operationalExpense: number };
  };
  stockBySpecies: {
    vacunos: number;
    ovinos: number;
    equinos: number;
  };
}

export function AgroToolbar({
  availableYears,
  establishments,
  selectedEstablishmentId,
  selectedMonth,
  selectedYear,
  onEstablishmentChange,
  onMonthChange,
  onYearChange
}: AgroToolbarProps) {
  return (
    <section className="toolbar">
      <label className="establishment-picker">
        <span>Campo visible</span>
        <select value={selectedEstablishmentId} onChange={(event) => onEstablishmentChange(event.target.value)}>
          {establishments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="period-picker">
        <span>Ano</span>
        <select value={selectedYear} onChange={(event) => onYearChange(event.target.value)}>
          <option value="all">Todos</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="period-picker">
        <span>Mes</span>
        <select value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)}>
          {periodMonthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

export function AgroMetricsGrid({ accountingTotals, stockBySpecies }: AgroMetricsGridProps) {
  return (
    <section className="summary-grid">
      <article className="metric-card">
        <span>Total vacunos</span>
        <strong>{stockBySpecies.vacunos}</strong>
        <small>Existencias actuales por categoria y por establecimiento.</small>
      </article>
      <article className="metric-card">
        <span>Total ovinos</span>
        <strong>{stockBySpecies.ovinos}</strong>
        <small>Incluye compras, ventas, traslados, nacimientos, muertes y faltantes.</small>
      </article>
      <article className="metric-card">
        <span>Ingresos USD</span>
        <strong>{formatMoney(accountingTotals.USD.income, "USD")}</strong>
        <small>Los ingresos se manejan solo en dolares.</small>
      </article>
      <article className="metric-card accent">
        <span>Compra ganado UYU / USD</span>
        <strong>
          {formatMoney(accountingTotals.UYU.livestockPurchaseExpense, "UYU")} |{" "}
          {formatMoney(accountingTotals.USD.livestockPurchaseExpense, "USD")}
        </strong>
        <small>Separada de los gastos operativos para no mezclar rodeo con mantenimiento.</small>
      </article>
      <article className="metric-card">
        <span>Gastos operativos UYU / USD</span>
        <strong>
          {formatMoney(accountingTotals.UYU.operationalExpense, "UYU")} |{" "}
          {formatMoney(accountingTotals.USD.operationalExpense, "USD")}
        </strong>
        <small>Incluye insumos, sanidad, combustible, sueldos, mantenimiento, impuestos y otros.</small>
      </article>
    </section>
  );
}
