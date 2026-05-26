import { AccountingEntry, AccountingEntryType, AnimalMovementRecord, ExpenseConcept, FieldUnit, MoneyCurrency } from "./agro.types";

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

export function isLivestockPurchaseConcept(concept: ExpenseConcept | string) {
  return concept === "compra_animales";
}

export function isLivestockPurchaseEntry(entry: AccountingEntry) {
  return entry.type === "expense" && isLivestockPurchaseConcept(entry.concept);
}

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

export function parseDecimalInput(value: string) {
  const compactValue = value.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return Number.NaN;
  }

  const lastComma = compactValue.lastIndexOf(",");
  const lastDot = compactValue.lastIndexOf(".");
  let normalized = compactValue;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = compactValue.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = compactValue.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalized = compactValue.replace(",", ".");
  }

  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
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

export function formatCategoryLabel(label: string) {
  return label.replace(/^\d+\)\s*/, "").trim();
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

export function describeAnimalMovementDetail(
  movement: AnimalMovementRecord,
  animalMovements: AnimalMovementRecord[],
  fields: FieldUnit[]
) {
  if (movement.kind === "shortage") {
    return movement.notes.trim() || null;
  }

  if (movement.kind === "transfer_in" || movement.kind === "transfer_out") {
    const sourceMovement =
      movement.kind === "transfer_out"
        ? movement
        : animalMovements.find((item) => item.id === movement.pairedTransferMovementId) ?? movement;
    const destinationMovement =
      movement.kind === "transfer_in"
        ? movement
        : animalMovements.find((item) => item.id === movement.pairedTransferMovementId) ?? movement;
    const sourceField = fields.find((field) => field.id === sourceMovement.fieldId)?.name ?? "campo origen";
    const destinationField = fields.find((field) => field.id === destinationMovement.fieldId)?.name ?? "campo destino";
    const notes = movement.notes.trim();

    return notes
      ? `Del campo ${sourceField} al campo ${destinationField}. ${notes}`
      : `Del campo ${sourceField} al campo ${destinationField}.`;
  }

  return null;
}
