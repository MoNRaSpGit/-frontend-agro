import { ChevronDown } from "lucide-react";
import { categoryCatalog, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatMoney, periodMonthOptions } from "./agro.home.shared";
import { AgroSpecies, Establishment, FieldUnit } from "./agro.types";

interface AgroToolbarProps {
  availableYears: string[];
  establishments: Establishment[];
  visibleFields: FieldUnit[];
  selectedEstablishmentId: string;
  selectedVisibleFieldId: string;
  selectedMonth: string;
  selectedYear: string;
  onEstablishmentChange: (value: string) => void;
  onVisibleFieldChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
}

interface AgroMetricsGridProps {
  accountingTotals: {
    USD: { income: number; livestockPurchaseExpense: number; operationalExpense: number };
    UYU: { income: number; livestockPurchaseExpense: number; operationalExpense: number };
  };
  stockBySpecies: Record<AgroSpecies, number>;
  stockBreakdownBySpecies: Record<
    AgroSpecies,
    Array<{
      categoryCode: string;
      quantity: number;
    }>
  >;
}

interface StockMetricCardProps {
  species: AgroSpecies;
  total: number;
  breakdown: Array<{
    categoryCode: string;
    quantity: number;
  }>;
}

export function AgroToolbar({
  availableYears,
  establishments,
  visibleFields,
  selectedEstablishmentId,
  selectedVisibleFieldId,
  selectedMonth,
  selectedYear,
  onEstablishmentChange,
  onVisibleFieldChange,
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
        <span>Potrero visible</span>
        <select value={selectedVisibleFieldId} onChange={(event) => onVisibleFieldChange(event.target.value)}>
          <option value="">Todos</option>
          {visibleFields.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="period-picker">
        <span>Ano visible</span>
        <select value={selectedYear} onChange={(event) => onYearChange(event.target.value)}>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="period-picker">
        <span>Mes visible</span>
        <select value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)}>
          {periodMonthOptions
            .filter((month) => month.value !== "all")
            .map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
            ))}
        </select>
      </label>
    </section>
  );
}

function StockMetricCard({ species, total, breakdown }: StockMetricCardProps) {
  return (
    <details className="metric-card metric-card-stock">
      <summary className="metric-card-summary">
        <span>Total {speciesLabels[species].toLowerCase()}</span>
        <strong>{total}</strong>
        <small>Click para ver el detalle por categoria actual.</small>
        <ChevronDown className="metric-card-chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="metric-card-breakdown">
        {breakdown.length === 0 ? (
          <small>Sin categorias con stock cargado.</small>
        ) : (
          <ul className="metric-card-breakdown-list">
            {breakdown.map((item) => {
              const category = categoryCatalog[species].find((entry) => entry.code === item.categoryCode);
              const categoryLabel = category ? formatCategoryLabel(category.label) : item.categoryCode;

              return (
                <li key={`${species}-${item.categoryCode}`}>
                  <span>{categoryLabel}</span>
                  <strong>{item.quantity}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

export function AgroMetricsGrid({ accountingTotals, stockBySpecies, stockBreakdownBySpecies }: AgroMetricsGridProps) {
  return (
    <section className="summary-grid">
      <StockMetricCard species="vacunos" total={stockBySpecies.vacunos} breakdown={stockBreakdownBySpecies.vacunos} />
      <StockMetricCard species="ovinos" total={stockBySpecies.ovinos} breakdown={stockBreakdownBySpecies.ovinos} />
      <StockMetricCard species="equinos" total={stockBySpecies.equinos} breakdown={stockBreakdownBySpecies.equinos} />
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
