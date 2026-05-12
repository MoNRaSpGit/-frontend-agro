export type AgroView = "overview" | "setup" | "animals" | "accounting" | "sanity" | "rainfall" | "summary";

export type AgroSpecies = "vacunos" | "ovinos" | "equinos";

export type AnimalMovementKind =
  | "purchase"
  | "sale"
  | "birth"
  | "death"
  | "transfer"
  | "transfer_in"
  | "transfer_out"
  | "shortage"
  | "adjustment";

export type AccountingEntryType = "income" | "expense";

export type MoneyCurrency = "USD" | "UYU";

export type IncomeConcept = "venta_vacunos" | "venta_ovinos" | "venta_lana" | "venta_equinos";

export type ExpenseConcept =
  | "compra_animales"
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

export interface AnimalMovementRecord {
  id: string;
  date: string;
  establishmentId: string;
  fieldId: string;
  species: AgroSpecies;
  categoryCode: string;
  kind: AnimalMovementKind;
  quantity: number;
  earTag?: string;
  weightKg?: number;
  unitPrice?: number;
  freightAmount?: number;
  commissionAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: MoneyCurrency;
  linkedAccountingEntryId?: string;
  pairedTransferMovementId?: string;
  notes: string;
}

export interface AccountingEntry {
  id: string;
  date: string;
  establishmentId: string;
  fieldId: string;
  type: AccountingEntryType;
  concept: IncomeConcept | ExpenseConcept;
  currency: MoneyCurrency;
  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  netAmount: number;
  expectedAmount?: number;
  collectedAmount?: number;
  linkedAnimalMovementId?: string;
  notes: string;
}

export interface MonthlyExchangeRate {
  id: string;
  yearMonth: string;
  averageRate: number;
}

export interface RainfallRecord {
  id: string;
  date: string;
  fieldId: string;
  millimeters: number;
  notes: string;
}

export interface SanitaryRecord {
  id: string;
  date: string;
  establishmentId: string;
  fieldId: string;
  quantity: number;
  treatment: string;
  notes: string;
}
