import { deriveMovementDirection } from "./agro.domain";
import { categoryCatalog, getEstablishmentIdFromFieldId as getLegacyEstablishmentIdFromFieldId } from "./agro.demo.data";
import {
  AccountingEntry,
  AccountingEntryType,
  AgroSpecies,
  AnimalMovementKind,
  AnimalMovementRecord,
  Establishment,
  ExpenseConcept,
  FieldUnit,
  MoneyCurrency,
  RainfallRecord,
  SanitaryRecord
} from "./agro.types";

export type AgroPeriodRange = {
  startDate: string;
  endDate: string;
  label: string;
};

const AGRO_FISCAL_YEAR_START_MONTH = 7;

export const incomeConceptLabels = {
  venta_vacunos: "Venta de vacunos",
  venta_ovinos: "Venta de ovinos",
  venta_lana: "Venta de lana",
  venta_equinos: "Venta de equinos"
} as const;

export const expenseConceptLabels = {
  compra_animales: "Compra de animales",
  alimentacion: "Alimentacion",
  arrendamiento: "Arrendamiento",
  honorarios_profesionales: "Honorarios profesionales",
  semillas: "Semillas",
  fertilizantes: "Fertilizantes",
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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

export function formatNumber(value?: number, fractionDigits = 2) {
  if (value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
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
    const sourceFieldRecord = fields.find((field) => field.id === sourceMovement.fieldId);
    const destinationFieldRecord = fields.find((field) => field.id === destinationMovement.fieldId);
    const sourceField = sourceFieldRecord?.name ?? "potrero origen";
    const destinationField = destinationFieldRecord?.name ?? "potrero destino";
    const notes = movement.notes.trim();
    const isInternalTransfer = sourceMovement.establishmentId === destinationMovement.establishmentId;

    return notes
      ? isInternalTransfer
        ? `Del potrero ${sourceField} al potrero ${destinationField}. ${notes}`
        : `Del potrero ${sourceField} al potrero ${destinationField}. ${notes}`
      : isInternalTransfer
        ? `Del potrero ${sourceField} al potrero ${destinationField}.`
        : `Del potrero ${sourceField} al potrero ${destinationField}.`;
  }

  return null;
}

export function getMonthDateRange(year: string, month: string) {
  const monthStart = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const monthEnd = new Date(Date.UTC(Number(year), Number(month), 0));

  return {
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: monthEnd.toISOString().slice(0, 10)
  };
}

export function getFiscalYearRange(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const fiscalStartYear = numericMonth >= AGRO_FISCAL_YEAR_START_MONTH ? numericYear : numericYear - 1;
  const fiscalEndYear = fiscalStartYear + 1;
  const label = `${fiscalStartYear}/${String(fiscalEndYear).slice(-2)}`;

  return {
    startDate: `${fiscalStartYear}-07-01`,
    endDate: `${fiscalEndYear}-06-30`,
    label: `Ejercicio ${label}`
  };
}

export function getVisibleMonthRange(year: string, month: string): AgroPeriodRange {
  const monthRange = getMonthDateRange(year, month);
  return {
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    label: formatYearMonth(`${year}-${month}`)
  };
}

export function getFiscalYearToDateRange(year: string, month: string): AgroPeriodRange {
  const fiscalYearRange = getFiscalYearRange(year, month);
  const visibleMonthRange = getMonthDateRange(year, month);

  return {
    startDate: fiscalYearRange.startDate,
    endDate: visibleMonthRange.endDate,
    label: `${fiscalYearRange.label} hasta ${formatYearMonth(`${year}-${month}`)}`
  };
}

export function isDateWithinRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

export function isDateOnOrBefore(date: string, endDate: string) {
  return date <= endDate;
}

export function normalizeFieldUnits(nextFields: FieldUnit[]) {
  // Antes, un potrero sin hectareas propias (dato legado) heredaba el total
  // del establecimiento entero como estimacion. Con la validacion de que la
  // suma de potreros no puede superar el total del campo, ese fallback
  // corrompia el dato (un potrero "vale" todo el campo) y despues bloqueaba
  // cualquier otra edicion. Ahora un potrero sin hectareas queda en 0
  // (superficie sin asignar), que es un valor valido dentro de esa suma.
  return nextFields.map((field) => {
    const numericHectares = typeof field.hectares === "number" ? field.hectares : Number(field.hectares);
    return {
      ...field,
      hectares: Number.isFinite(numericHectares) ? numericHectares : 0
    };
  });
}

export function getFieldIdForEstablishmentFromSource(fieldsSource: FieldUnit[], establishmentId: string) {
  return fieldsSource.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

export function resolveNormalizedFieldId(fieldsSource: FieldUnit[], establishmentId: string, currentFieldId: string) {
  const existingField = fieldsSource.find((field) => field.id === currentFieldId);
  if (existingField) {
    return existingField.id;
  }

  return getFieldIdForEstablishmentFromSource(fieldsSource, establishmentId) || currentFieldId;
}

export function normalizeAnimalMovementRecord(movement: AnimalMovementRecord, fieldsSource: FieldUnit[]): AnimalMovementRecord {
  const establishmentId =
    movement.establishmentId ||
    fieldsSource.find((field) => field.id === movement.fieldId)?.establishmentId ||
    getLegacyEstablishmentIdFromFieldId(movement.fieldId);
  const fieldId = resolveNormalizedFieldId(fieldsSource, establishmentId, movement.fieldId);

  return {
    ...movement,
    establishmentId,
    fieldId
  };
}

export function normalizeAccountingEntry(entry: AccountingEntry, fieldsSource: FieldUnit[]): AccountingEntry {
  const establishmentId =
    entry.establishmentId ||
    fieldsSource.find((field) => field.id === entry.fieldId)?.establishmentId ||
    getLegacyEstablishmentIdFromFieldId(entry.fieldId);
  const fieldId = resolveNormalizedFieldId(fieldsSource, establishmentId, entry.fieldId);
  const expectedAmount = entry.type === "income" ? entry.expectedAmount ?? entry.netAmount : undefined;
  const collectedAmount = entry.type === "income" ? entry.collectedAmount ?? expectedAmount : undefined;

  return {
    ...entry,
    establishmentId,
    fieldId,
    expectedAmount,
    collectedAmount
  };
}

export function normalizeRainfallRecord(record: RainfallRecord, fieldsSource: FieldUnit[]): RainfallRecord {
  const establishmentId =
    fieldsSource.find((field) => field.id === record.fieldId)?.establishmentId || getLegacyEstablishmentIdFromFieldId(record.fieldId);
  const fieldId = resolveNormalizedFieldId(fieldsSource, establishmentId, record.fieldId);

  return {
    ...record,
    fieldId
  };
}

export function normalizeSanitaryRecord(record: SanitaryRecord, fieldsSource: FieldUnit[]): SanitaryRecord {
  const establishmentId =
    record.establishmentId ||
    fieldsSource.find((field) => field.id === record.fieldId)?.establishmentId ||
    getLegacyEstablishmentIdFromFieldId(record.fieldId);
  const fieldId = resolveNormalizedFieldId(fieldsSource, establishmentId, record.fieldId);
  const species = record.species ?? "vacunos";

  return {
    ...record,
    establishmentId,
    fieldId,
    species,
    categoryCode: record.categoryCode || categoryCatalog[species]?.[0]?.code || ""
  };
}

export function getIncomeExpectedAmount(entry: AccountingEntry) {
  return entry.type === "income" ? entry.expectedAmount ?? entry.netAmount : 0;
}

export function getIncomeCollectedAmount(entry: AccountingEntry) {
  if (entry.type !== "income") {
    return 0;
  }

  const expectedAmount = getIncomeExpectedAmount(entry);
  const collectedAmount = entry.collectedAmount ?? expectedAmount;
  return Math.max(0, Math.min(collectedAmount, expectedAmount));
}

export function getIncomePendingAmount(entry: AccountingEntry) {
  if (entry.type !== "income") {
    return 0;
  }

  return Math.max(0, getIncomeExpectedAmount(entry) - getIncomeCollectedAmount(entry));
}

export function getIncomeCollectionStatus(entry: AccountingEntry) {
  if (entry.type !== "income") {
    return null;
  }

  const collectedAmount = getIncomeCollectedAmount(entry);
  const pendingAmount = getIncomePendingAmount(entry);

  if (collectedAmount <= 0) {
    return "Pendiente";
  }

  if (pendingAmount > 0) {
    return "Parcial";
  }

  return "Cobrado";
}

export function isInitialStockLoad(movement: AnimalMovementRecord) {
  return movement.kind === "adjustment" && movement.notes.startsWith("Carga inicial:");
}

export function getMovementDirection(movement: AnimalMovementRecord) {
  return isInitialStockLoad(movement) ? "entry" : deriveMovementDirection(movement.kind);
}

// Un traslado (transfer_in/transfer_out) es interno cuando su movimiento
// pareja pertenece al mismo establecimiento: el animal solo cambio de
// potrero, nunca salio del rodeo del establecimiento.
function isInternalTransferMovement(movement: AnimalMovementRecord, allMovements: AnimalMovementRecord[]) {
  if (movement.kind !== "transfer_in" && movement.kind !== "transfer_out") {
    return false;
  }

  const pairedMovement = allMovements.find((item) => item.id === movement.pairedTransferMovementId);
  return pairedMovement ? pairedMovement.establishmentId === movement.establishmentId : false;
}

// Direccion de flujo a nivel de establecimiento, para los totales de
// entradas/salidas (usado en Resumen). Es distinto de getMovementDirection
// (que se usa para el stock por potrero, donde un traslado interno si
// mueve stock real de un potrero a otro): aca un traslado interno no debe
// sumar ni a entradas ni a salidas, porque el rodeo del establecimiento no
// cambio. Un traslado entre establecimientos distintos si cuenta (salida
// del origen, entrada en el destino).
export function getEstablishmentFlowDirection(
  movement: AnimalMovementRecord,
  allMovements: AnimalMovementRecord[]
): "entry" | "exit" | "none" {
  if (isInternalTransferMovement(movement, allMovements)) {
    return "none";
  }

  return getMovementDirection(movement);
}

export function getFieldIdForEstablishmentFrom(fields: FieldUnit[], establishmentId: string) {
  return fields.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

// Suma las hectareas de los potreros de un establecimiento. Se usa para
// validar que ningun potrero, ni la suma de todos, supere las hectareas
// totales del establecimiento (si puede sobrar superficie sin asignar).
export function sumFieldHectares(fields: FieldUnit[], establishmentId: string, excludeFieldId?: string) {
  return fields
    .filter((field) => field.establishmentId === establishmentId && field.id !== excludeFieldId)
    .reduce((sum, field) => sum + field.hectares, 0);
}

// Stock por especie/categoria de un potrero puntual, leido del mapa de
// saldos (claves "fieldId:species:categoryCode" -> cantidad). Se usa para
// mostrarle al usuario cuantos animales de cada tipo hay en el potrero
// elegido, sin bloquear nada (a diferencia del traslado, acá no se mueve
// stock, solo se informa).
export function computeFieldAvailability(stockBalanceMap: Map<string, number>, fieldId: string) {
  const availability = new Map<AgroSpecies, Array<{ categoryCode: string; quantity: number }>>();

  for (const [key, quantity] of stockBalanceMap.entries()) {
    const [entryFieldId, species, categoryCode] = key.split(":") as [string, AgroSpecies, string];
    if (entryFieldId !== fieldId || quantity <= 0) {
      continue;
    }

    const rows = availability.get(species) ?? [];
    rows.push({ categoryCode, quantity });
    availability.set(species, rows);
  }

  return availability;
}

// Arma el movimiento de correccion que hay que guardar para que el stock de
// un potrero/especie/categoria pase de currentQuantity a targetQuantity.
// Devuelve null cuando no hay diferencia (nada para corregir). No se guarda
// un total: se guarda la diferencia como entrada o salida, igual que
// cualquier otro movimiento, para que el stock se seguir recalculando solo.
export function buildStockCorrectionMovement(params: {
  id: string;
  date: string;
  establishmentId: string;
  fieldId: string;
  species: AgroSpecies;
  categoryCode: string;
  currentQuantity: number;
  targetQuantity: number;
  notes: string;
}): AnimalMovementRecord | null {
  const delta = params.targetQuantity - params.currentQuantity;
  if (delta === 0) {
    return null;
  }

  const autoNote = `Correccion manual: de ${formatNumber(params.currentQuantity, 0)} a ${formatNumber(params.targetQuantity, 0)} animales.`;

  return {
    id: params.id,
    date: params.date,
    establishmentId: params.establishmentId,
    fieldId: params.fieldId,
    species: params.species,
    categoryCode: params.categoryCode,
    kind: delta > 0 ? "correction_in" : "correction_out",
    quantity: Math.abs(delta),
    notes: [autoNote, params.notes.trim()].filter(Boolean).join(" ")
  };
}

export function isTransferMovementKind(kind: AnimalMovementKind) {
  return kind === "transfer" || kind === "transfer_internal" || kind === "transfer_in" || kind === "transfer_out";
}

export function getFirstFieldIdForEstablishment(fields: FieldUnit[], establishmentId: string) {
  return fields.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

export function getAlternativeFieldId(fields: FieldUnit[], establishmentId: string, excludedFieldId: string) {
  return fields.find((field) => field.establishmentId === establishmentId && field.id !== excludedFieldId)?.id ?? "";
}

export function getAlternativeEstablishmentId(establishments: Establishment[], excludedEstablishmentId: string) {
  return establishments.find((item) => item.id !== excludedEstablishmentId)?.id ?? "";
}

export function summarizeExpenses(entries: AccountingEntry[], exchangeRateByMonth: Record<string, number>) {
  return entries.reduce(
    (summary, entry) => {
      if (entry.type !== "expense") {
        return summary;
      }

      const expenseGroup = isLivestockPurchaseEntry(entry) ? "livestockPurchase" : "operational";
      const currencyGroup = entry.currency === "USD" ? "usd" : "uyu";

      if (currencyGroup === "usd") {
        summary[expenseGroup].usd += entry.netAmount;
      } else {
        summary[expenseGroup].uyu += entry.netAmount;
        const exchangeRate = exchangeRateByMonth[getYearMonth(entry.date)];
        if (exchangeRate) {
          summary[expenseGroup].uyuDollarized += entry.netAmount / exchangeRate;
        }
      }

      return summary;
    },
    {
      livestockPurchase: { usd: 0, uyu: 0, uyuDollarized: 0 },
      operational: { usd: 0, uyu: 0, uyuDollarized: 0 }
    }
  );
}

export function summarizeRangeData(
  animalMovements: AnimalMovementRecord[],
  accountingEntries: AccountingEntry[],
  rainfallRecords: RainfallRecord[],
  exchangeRateByMonth: Record<string, number>,
  startDate: string,
  endDate: string,
  fieldIds?: Set<string>
) {
  const matchesField = (fieldId: string) => !fieldIds || fieldIds.has(fieldId);

  const filteredAnimalMovements = animalMovements.filter(
    (movement) => matchesField(movement.fieldId) && isDateWithinRange(movement.date, startDate, endDate)
  );
  const filteredAccountingEntries = accountingEntries.filter(
    (entry) => matchesField(entry.fieldId) && isDateWithinRange(entry.date, startDate, endDate)
  );
  const filteredRainfallRecords = rainfallRecords.filter(
    (record) => matchesField(record.fieldId) && isDateWithinRange(record.date, startDate, endDate)
  );
  const expenseSummary = summarizeExpenses(filteredAccountingEntries, exchangeRateByMonth);

  return {
    entries: filteredAnimalMovements
      .filter((movement) => getEstablishmentFlowDirection(movement, animalMovements) === "entry")
      .reduce((sum, movement) => sum + movement.quantity, 0),
    exits: filteredAnimalMovements
      .filter((movement) => getEstablishmentFlowDirection(movement, animalMovements) === "exit")
      .reduce((sum, movement) => sum + movement.quantity, 0),
    incomeUsd: filteredAccountingEntries
      .filter((entry) => entry.type === "income" && entry.currency === "USD")
      .reduce((sum, entry) => sum + getIncomeCollectedAmount(entry), 0),
    pendingIncomeUsd: filteredAccountingEntries
      .filter((entry) => entry.type === "income" && entry.currency === "USD")
      .reduce((sum, entry) => sum + getIncomePendingAmount(entry), 0),
    livestockPurchaseExpenseUsd: expenseSummary.livestockPurchase.usd,
    livestockPurchaseExpenseUyu: expenseSummary.livestockPurchase.uyu,
    livestockPurchaseExpenseUyuDollarized: expenseSummary.livestockPurchase.uyuDollarized,
    totalLivestockPurchaseExpenseUsdEquivalent:
      expenseSummary.livestockPurchase.usd + expenseSummary.livestockPurchase.uyuDollarized,
    operationalExpenseUsd: expenseSummary.operational.usd,
    operationalExpenseUyu: expenseSummary.operational.uyu,
    operationalExpenseUyuDollarized: expenseSummary.operational.uyuDollarized,
    totalOperationalExpenseUsdEquivalent: expenseSummary.operational.usd + expenseSummary.operational.uyuDollarized,
    rainfallTotal: filteredRainfallRecords.reduce((sum, record) => sum + record.millimeters, 0)
  };
}
