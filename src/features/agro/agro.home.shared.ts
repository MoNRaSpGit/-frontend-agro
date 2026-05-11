import { AccountingEntryType, MoneyCurrency } from "./agro.types";

export const incomeConceptLabels = {
  venta_vacunos: "Venta de vacunos",
  venta_ovinos: "Venta de ovinos",
  venta_lana: "Venta de lana",
  venta_equinos: "Venta de equinos"
} as const;

export const expenseConceptLabels = {
  compra_animales: "Compra de animales",
  alimentacion: "Alimentacion",
  sanidad: "Sanidad",
  combustible: "Combustible",
  sueldos: "Sueldos",
  mantenimiento: "Mantenimiento",
  impuestos: "Impuestos",
  otros: "Otros"
} as const;

export function getTodayDate() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export const periodMonthOptions = [
  { value: "all", label: "Todos los meses" },
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
] as const;

export function formatMoney(value: number, currency: MoneyCurrency) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value?: number) {
  if (value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(value);
}

export function formatShortDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${Number(day)}/${Number(month)}/${year.slice(-2)}`;
}

export function getYearMonth(value: string) {
  if (!value || value.length < 7) {
    return "";
  }

  return value.slice(0, 7);
}

export function formatYearMonth(value: string) {
  const [year, month] = value.split("-");
  const monthLabel = periodMonthOptions.find((item) => item.value === month)?.label;

  if (!year || !monthLabel) {
    return value;
  }

  return `${monthLabel} ${year}`;
}

export function getNetAmount(
  type: AccountingEntryType,
  grossAmount: number,
  commissionAmount: number,
  taxAmount: number
) {
  if (type === "income") {
    return grossAmount - commissionAmount - taxAmount;
  }

  return grossAmount + commissionAmount + taxAmount;
}
