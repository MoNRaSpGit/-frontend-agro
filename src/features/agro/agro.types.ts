export type AgroView = "overview" | "setup" | "animals" | "accounting" | "sanity" | "rainfall" | "summary";

export type AgroSpecies = "vacunos" | "ovinos" | "equinos";

export type AnimalMovementKind =
  | "purchase"
  | "sale"
  | "birth"
  | "death"
  | "transfer"
  | "transfer_internal"
  | "transfer_in"
  | "transfer_out"
  | "shortage"
  | "adjustment"
  | "correction"
  | "correction_in"
  | "correction_out";

// "kilo": el total sale de peso individual x cantidad x precio (precio por
// kilo). "unidad": el total sale de cantidad x precio (precio por cabeza),
// sin pedir peso.
export type AnimalPricingMode = "kilo" | "unidad";

export type AccountingEntryType = "income" | "expense";

export type MoneyCurrency = "USD" | "UYU";

export type IncomeConcept = "venta_vacunos" | "venta_ovinos" | "venta_lana" | "venta_equinos";

export type ExpenseConcept =
  | "compra_animales"
  | "alimentacion"
  | "arrendamiento"
  | "honorarios_profesionales"
  | "semillas"
  | "fertilizantes"
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
  hectares: number;
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
  pricingMode?: AnimalPricingMode;
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

// Rastro de cada edicion/borrado sobre un movimiento de animales -- antes
// editar/eliminar sobreescribia o sacaba el registro sin dejar nada, asi
// que no habia forma de saber que decia antes ni quien/cuando lo cambio.
// "before" es siempre el registro tal cual estaba; "after" es el registro
// nuevo (edicion) o null (borrado). Se guarda uno por cada movimiento
// fisico tocado -- un traslado editado o borrado deja dos entradas (una
// por cada mitad), no una.
export interface AgroAuditEntry {
  id: string;
  action: "edit" | "delete";
  movementId: string;
  before: AnimalMovementRecord;
  after: AnimalMovementRecord | null;
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
  species: AgroSpecies;
  categoryCode: string;
  quantity: number;
  treatment: string;
  notes: string;
}
