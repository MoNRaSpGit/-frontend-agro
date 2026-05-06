export type AgroView = "overview" | "stock" | "accounting" | "reports" | "questions";

export type AgroSpecies = "vacunos" | "ovinos" | "equinos";

export type StockReason = "compra" | "nacimiento" | "venta" | "muerte" | "ajuste";

export type StockDirection = "in" | "out";

export type AccountingEntryType = "income" | "expense";

export type IncomeConcept = "venta_vacunos" | "venta_ovinos" | "venta_lana" | "venta_equinos";

export type ExpenseConcept =
  | "alimentacion"
  | "sanidad"
  | "combustible"
  | "sueldos"
  | "mantenimiento"
  | "impuestos"
  | "otros";

export interface Establishment {
  id: string;
  name: string;
  location: string;
  hectares: number;
}

export interface FieldUnit {
  id: string;
  establishmentId: string;
  name: string;
  notes: string;
}

export interface CategoryDefinition {
  code: string;
  label: string;
  ug: number;
}

export interface StockSnapshot {
  fieldId: string;
  species: AgroSpecies;
  categoryCode: string;
  quantity: number;
}

export interface StockMovement {
  id: string;
  date: string;
  establishmentId: string;
  fieldId: string;
  species: AgroSpecies;
  categoryCode: string;
  direction: StockDirection;
  reason: StockReason;
  quantity: number;
  notes: string;
}

export interface AccountingEntry {
  id: string;
  date: string;
  establishmentId: string;
  type: AccountingEntryType;
  concept: IncomeConcept | ExpenseConcept;
  species?: AgroSpecies;
  kilos?: number;
  pricePerKilo?: number;
  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  netAmount: number;
  notes: string;
}

export interface MultipleChoiceQuestion {
  id: string;
  title: string;
  helper: string;
  options: string[];
}
