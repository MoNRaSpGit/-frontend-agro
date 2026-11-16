export type AgroView = "overview" | "setup" | "animals" | "accounting" | "sanity" | "rainfall" | "summary" | "voz";

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
  | "correction_out"
  // Cambio de categoria (05/11/2026, pedido explicito del cliente
  // Rosendo): un animal que crece y pasa a otra categoria, dentro del
  // mismo potrero. "category_change" es el valor que se elige en el
  // formulario (igual que "transfer"); se guarda como el par
  // category_change_out/category_change_in.
  | "category_change"
  | "category_change_out"
  | "category_change_in";

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
  // Cuenta que lo cargo (17/11/2026): "rosendo" | "administrador" (contador).
  // Lo viejo no lo tiene y se toma como Rosendo.
  createdBy?: string;
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
  // Quien y cuando (17/11/2026); los registros viejos no lo tienen.
  by?: string;
  at?: string;
}

// Mismo criterio que AgroAuditEntry pero para Contabilidad (ventas/gastos):
// antes no quedaba ningun rastro de que decia un movimiento contable editado
// o eliminado -- pedido explicito del cliente (11/09/2026), porque a
// diferencia de los movimientos de animales, aca se maneja plata real y
// quiere poder ver todo lo que se hizo. Se guarda en su propio arreglo
// (accountingAuditLog), separado del de animales, porque el formato de
// registro es distinto (AccountingEntry, no AnimalMovementRecord).
//
// Refuerzo (16/11/2026, pedido explicito: "si manana nos preguntan que paso,
// que quede el porque de cada monto"): ahora tambien se registran las ALTAS
// ("create"), y cada registro nuevo trae cuando paso ("at"), por que camino
// ("source") y una explicacion en texto con la cuenta que dio ese monto
// ("explanation"). Los tres campos son opcionales: los registros viejos no
// los tienen y siguen siendo validos (before/after no cambian). "before" es
// null solo en un alta.
export type AccountingAuditAction = "create" | "edit" | "delete";

export type AccountingAuditSource =
  | "contabilidad" // cargado/editado/borrado desde la pantalla de Contabilidad
  | "animales" // se genero o cambio por una venta/compra de la pantalla Animales
  | "borrado-animales" // se borro el movimiento de animales y arrastro a este asiento
  | "deshacer-borrado" // volvio por "Deshacer" tras borrar un movimiento de animales
  | "cobro" // boton "Pago" de Clientes
  | "vencimiento" // boton "Sigue en deuda" (cambio de fecha de vencimiento)
  | "fusion-potreros"; // cambio de campo/potrero por fusion de potreros

export interface AgroAccountingAuditEntry {
  id: string;
  action: AccountingAuditAction;
  entryId: string;
  // Solo un alta no tiene "antes". Los registros viejos siempre lo traen.
  before: AccountingEntry | null;
  after: AccountingEntry | null;
  at?: string;
  source?: AccountingAuditSource;
  explanation?: string;
  // Cuenta que lo hizo: "rosendo" | "administrador" (contador).
  by?: string;
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
  // Fecha en la que se espera cobrar el saldo pendiente (ventas a plazo).
  // Solo aplica a ingresos con algo pendiente -- ver isIncomeEntryDue en
  // agro.home.shared.ts. Al llegar (o pasar) esta fecha, la venta se
  // marca como "vencida" en la planilla y pide confirmar si se cobro o
  // si hay que posponerla a una fecha nueva.
  dueDate?: string;
  // Nombre del cliente al que se le vendio (texto libre, sin lista de
  // clientes ni historial por cliente -- a proposito, version simple
  // pedida por el cliente 12/09/2026). Solo tiene sentido en ingresos con
  // vencimiento; es lo que permite armar la planilla de "Cuentas por
  // cobrar" (ver AgroReceivablesSection).
  clientName?: string;
  linkedAnimalMovementId?: string;
  // Cuenta que lo cargo (17/11/2026), igual que en AnimalMovementRecord.
  createdBy?: string;
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
