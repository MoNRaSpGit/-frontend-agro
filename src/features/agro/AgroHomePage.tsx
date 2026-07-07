import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ProductShell } from "../../shared/components/ProductShell";
import { AgroAccountingSection } from "./AgroAccountingSection";
import { AgroAnimalsSection } from "./AgroAnimalsSection";
import { AgroDeleteConfirmModal } from "./AgroDeleteConfirmModal";
import { AgroMetricsGrid, AgroToolbar } from "./AgroHomeChrome";
import { AgroOverviewSection } from "./AgroOverviewSection";
import { AgroRainfallSection } from "./AgroRainfallSection";
import { AgroSanitySection } from "./AgroSanitySection";
import { AgroSetupSection } from "./AgroSetupSection";
import { AgroPersistenceMode, fetchAgroWorkspace, saveAgroWorkspace } from "./agro.client";
import { calculateAnimalTotal, deriveMovementDirection, getIncomeConceptForSpecies, requiresEarTag } from "./agro.domain";
import {
  describeAnimalMovementDetail,
  formatCategoryLabel,
  formatYearMonth,
  expenseConceptLabels,
  formatMoney,
  formatNumber,
  parseDecimalInput,
  formatShortDate,
  getNetAmount,
  getTodayDate,
  getYearMonth,
  isLivestockPurchaseEntry,
  incomeConceptLabels
} from "./agro.home.shared";
import { agroWorkspaceSections } from "./agro.workspace.config";
import {
  categoryCatalog,
  establishments as initialEstablishments,
  fields as initialFields,
  getEstablishmentIdFromFieldId as getLegacyEstablishmentIdFromFieldId,
  initialStock,
  movementKindLabels,
  speciesLabels
} from "./agro.demo.data";
import {
  AccountingEntry,
  AccountingEntryType,
  AgroSpecies,
  AgroView,
  AnimalMovementKind,
  AnimalMovementRecord,
  Establishment,
  ExpenseConcept,
  FieldUnit,
  IncomeConcept,
  MonthlyExchangeRate,
  MoneyCurrency,
  RainfallRecord,
  SanitaryRecord
} from "./agro.types";

type AgroPeriodRange = {
  startDate: string;
  endDate: string;
  label: string;
};

const AGRO_FISCAL_YEAR_START_MONTH = 7;

function getMonthDateRange(year: string, month: string) {
  const monthStart = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const monthEnd = new Date(Date.UTC(Number(year), Number(month), 0));

  return {
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: monthEnd.toISOString().slice(0, 10)
  };
}

function getFiscalYearRange(year: string, month: string) {
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

function getVisibleMonthRange(year: string, month: string): AgroPeriodRange {
  const monthRange = getMonthDateRange(year, month);
  return {
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    label: formatYearMonth(`${year}-${month}`)
  };
}

function getFiscalYearToDateRange(year: string, month: string): AgroPeriodRange {
  const fiscalYearRange = getFiscalYearRange(year, month);
  const visibleMonthRange = getMonthDateRange(year, month);

  return {
    startDate: fiscalYearRange.startDate,
    endDate: visibleMonthRange.endDate,
    label: `${fiscalYearRange.label} hasta ${formatYearMonth(`${year}-${month}`)}`
  };
}

function isDateWithinRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function isDateOnOrBefore(date: string, endDate: string) {
  return date <= endDate;
}

function normalizeFieldUnits(nextFields: FieldUnit[], nextEstablishments: Establishment[]) {
  return nextFields.map((field) => ({
    ...field,
    hectares:
      typeof field.hectares === "number"
        ? field.hectares
        : nextEstablishments.find((item) => item.id === field.establishmentId)?.hectares ?? 0
  }));
}

function getFieldIdForEstablishmentFromSource(fieldsSource: FieldUnit[], establishmentId: string) {
  return fieldsSource.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

function resolveNormalizedFieldId(fieldsSource: FieldUnit[], establishmentId: string, currentFieldId: string) {
  const existingField = fieldsSource.find((field) => field.id === currentFieldId);
  if (existingField) {
    return existingField.id;
  }

  return getFieldIdForEstablishmentFromSource(fieldsSource, establishmentId) || currentFieldId;
}

function normalizeAnimalMovementRecord(movement: AnimalMovementRecord, fieldsSource: FieldUnit[]): AnimalMovementRecord {
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

function normalizeAccountingEntry(entry: AccountingEntry, fieldsSource: FieldUnit[]): AccountingEntry {
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

function normalizeRainfallRecord(record: RainfallRecord, fieldsSource: FieldUnit[]): RainfallRecord {
  const establishmentId =
    fieldsSource.find((field) => field.id === record.fieldId)?.establishmentId || getLegacyEstablishmentIdFromFieldId(record.fieldId);
  const fieldId = resolveNormalizedFieldId(fieldsSource, establishmentId, record.fieldId);

  return {
    ...record,
    fieldId
  };
}

function normalizeSanitaryRecord(record: SanitaryRecord, fieldsSource: FieldUnit[]): SanitaryRecord {
  const establishmentId =
    record.establishmentId ||
    fieldsSource.find((field) => field.id === record.fieldId)?.establishmentId ||
    getLegacyEstablishmentIdFromFieldId(record.fieldId);
  const fieldId = resolveNormalizedFieldId(fieldsSource, establishmentId, record.fieldId);

  return {
    ...record,
    establishmentId,
    fieldId,
    species: record.species ?? "vacunos"
  };
}

function getIncomeExpectedAmount(entry: AccountingEntry) {
  return entry.type === "income" ? entry.expectedAmount ?? entry.netAmount : 0;
}

function getIncomeCollectedAmount(entry: AccountingEntry) {
  if (entry.type !== "income") {
    return 0;
  }

  const expectedAmount = getIncomeExpectedAmount(entry);
  const collectedAmount = entry.collectedAmount ?? expectedAmount;
  return Math.max(0, Math.min(collectedAmount, expectedAmount));
}

function getIncomePendingAmount(entry: AccountingEntry) {
  if (entry.type !== "income") {
    return 0;
  }

  return Math.max(0, getIncomeExpectedAmount(entry) - getIncomeCollectedAmount(entry));
}

function getIncomeCollectionStatus(entry: AccountingEntry) {
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

function isInitialStockLoad(movement: AnimalMovementRecord) {
  return movement.kind === "adjustment" && movement.notes.startsWith("Carga inicial:");
}

function getMovementDirection(movement: AnimalMovementRecord) {
  return isInitialStockLoad(movement) ? "entry" : deriveMovementDirection(movement.kind);
}

function getFieldIdForEstablishmentFrom(fields: FieldUnit[], establishmentId: string) {
  return fields.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

function isTransferMovementKind(kind: AnimalMovementKind) {
  return kind === "transfer" || kind === "transfer_internal" || kind === "transfer_in" || kind === "transfer_out";
}

function getFirstFieldIdForEstablishment(fields: FieldUnit[], establishmentId: string) {
  return fields.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

function getAlternativeFieldId(fields: FieldUnit[], establishmentId: string, excludedFieldId: string) {
  return fields.find((field) => field.establishmentId === establishmentId && field.id !== excludedFieldId)?.id ?? "";
}

function getAlternativeEstablishmentId(establishments: Establishment[], excludedEstablishmentId: string) {
  return establishments.find((item) => item.id !== excludedEstablishmentId)?.id ?? "";
}

function summarizeExpenses(entries: AccountingEntry[], exchangeRateByMonth: Record<string, number>) {
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

function summarizeRangeData(
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
      .filter((movement) => getMovementDirection(movement) === "entry")
      .reduce((sum, movement) => sum + movement.quantity, 0),
    exits: filteredAnimalMovements
      .filter((movement) => getMovementDirection(movement) === "exit")
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

interface AgroHomePageProps {
  persistenceMode: AgroPersistenceMode;
  onSignOut: () => void;
}

export function AgroHomePage({ persistenceMode, onSignOut }: AgroHomePageProps) {
  const today = getTodayDate();
  const animalFormPanelRef = useRef<HTMLElement | null>(null);
  const accountingFormPanelRef = useRef<HTMLElement | null>(null);
  const animalTableWrapRef = useRef<HTMLDivElement | null>(null);
  const animalTableRef = useRef<HTMLTableElement | null>(null);
  const animalTableScrollbarRef = useRef<HTMLDivElement | null>(null);
  const animalTableScrollbarInnerRef = useRef<HTMLDivElement | null>(null);
  const animalFieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const syncingAnimalScrollRef = useRef<"table" | "bottom-bar" | null>(null);
  const [activeView, setActiveView] = useState<AgroView | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [fields, setFields] = useState<FieldUnit[]>([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState("");
  const [selectedVisibleFieldId, setSelectedVisibleFieldId] = useState("");
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(today.slice(5, 7));
  const [animalSearchTerm, setAnimalSearchTerm] = useState("");
  const [accountingSearchTerm, setAccountingSearchTerm] = useState("");
  const [accountingStatusFilter, setAccountingStatusFilter] = useState<"all" | "pending" | "partial" | "collected">("all");
  const [linkedOperationsStatusFilter, setLinkedOperationsStatusFilter] = useState<"all" | "pending" | "partial" | "collected">("all");
  const [rainfallSearchTerm, setRainfallSearchTerm] = useState("");
  const [sanitarySearchTerm, setSanitarySearchTerm] = useState("");
  const [editingAnimalMovementId, setEditingAnimalMovementId] = useState<string | null>(null);
  const [editingAccountingEntryId, setEditingAccountingEntryId] = useState<string | null>(null);
  const [editingRainfallRecordId, setEditingRainfallRecordId] = useState<string | null>(null);
  const [editingSanitaryRecordId, setEditingSanitaryRecordId] = useState<string | null>(null);
  const [animalFormErrors, setAnimalFormErrors] = useState<Record<string, string>>({});
  const [showAnimalFloatingScrollbar, setShowAnimalFloatingScrollbar] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "animal" | "accounting" | "rainfall" | "sanitary";
    id: string;
    title: string;
    message: string;
  } | null>(null);
  const [animalMovements, setAnimalMovements] = useState<AnimalMovementRecord[]>([]);
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([]);
  const [rainfallRecords, setRainfallRecords] = useState<RainfallRecord[]>([]);
  const [sanitaryRecords, setSanitaryRecords] = useState<SanitaryRecord[]>([]);
  const [monthlyExchangeRates, setMonthlyExchangeRates] = useState<MonthlyExchangeRate[]>([]);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);

  const [animalForm, setAnimalForm] = useState({
    date: today,
    establishmentId: "",
    fieldId: "",
    transferDestinationEstablishmentId: "",
    transferDestinationFieldId: "",
    species: "vacunos" as AgroSpecies,
    categoryCode: categoryCatalog.vacunos[0]?.code ?? "",
    kind: "purchase" as AnimalMovementKind,
    quantity: "10",
    earTag: "",
    weightKg: "",
    unitPrice: "",
    freightAmount: "",
    commissionAmount: "",
    taxAmount: "",
    collectedAmount: "",
    currency: "USD" as MoneyCurrency,
    notes: ""
  });

  const [accountingForm, setAccountingForm] = useState({
    date: today,
    establishmentId: "",
    fieldId: "",
    type: "income" as AccountingEntryType,
    concept: "venta_vacunos" as IncomeConcept | ExpenseConcept,
    currency: "USD" as MoneyCurrency,
    grossAmount: "",
    commissionAmount: "",
    taxAmount: "",
    collectedAmount: "",
    notes: ""
  });

  const [rainfallForm, setRainfallForm] = useState({
    date: today,
    establishmentId: "",
    fieldId: "",
    millimeters: "",
    notes: ""
  });
  const [sanitaryForm, setSanitaryForm] = useState({
    date: today,
    establishmentId: "",
    fieldId: "",
    species: "vacunos" as AgroSpecies,
    quantity: "",
    treatment: "",
    notes: ""
  });
  const [editingExchangeRateId, setEditingExchangeRateId] = useState<string | null>(null);
  const [exchangeRateForm, setExchangeRateForm] = useState({
    yearMonth: getYearMonth(today),
    averageRate: ""
  });
  const [setupCutoffDate] = useState(today);
  const [setupEstablishmentId, setSetupEstablishmentId] = useState("");
  const [setupFieldId, setSetupFieldId] = useState("");
  const [setupSpecies, setSetupSpecies] = useState<AgroSpecies>("vacunos");
  const [newEstablishmentForm, setNewEstablishmentForm] = useState({
    name: "",
    hectares: "",
    firstFieldName: "",
    firstFieldHectares: ""
  });
  const [newFieldForm, setNewFieldForm] = useState({
    name: "",
    hectares: ""
  });
  const [newEstablishmentErrors, setNewEstablishmentErrors] = useState<Record<string, string>>({});
  const [newFieldErrors, setNewFieldErrors] = useState<Record<string, string>>({});
  const [initialStockForm, setInitialStockForm] = useState({
    categoryCode: categoryCatalog.vacunos[0]?.code ?? "",
    quantity: "",
    notes: ""
  });

  const activeEstablishmentId = selectedEstablishmentId || establishments[0]?.id || "";
  const activeFieldId = getFieldIdForEstablishmentFrom(fields, activeEstablishmentId);
  const activeTransferDestinationId = activeEstablishmentId;
  const setupFields = useMemo(
    () => fields.filter((field) => field.establishmentId === setupEstablishmentId),
    [fields, setupEstablishmentId]
  );

  function resetAnimalForm(preserveContext = false) {
    setAnimalForm((current) => ({
      date: preserveContext ? current.date : today,
      establishmentId: preserveContext ? current.establishmentId : activeEstablishmentId,
      fieldId: preserveContext ? current.fieldId : activeFieldId,
      transferDestinationEstablishmentId: preserveContext
        ? current.kind === "transfer"
          ? current.transferDestinationEstablishmentId || activeTransferDestinationId
          : ""
        : activeTransferDestinationId,
      transferDestinationFieldId: preserveContext
        ? current.kind === "transfer"
          ? (() => {
              const destinationEstablishmentId =
                current.transferDestinationEstablishmentId || activeTransferDestinationId;
              const isInternalTransfer = destinationEstablishmentId === (current.establishmentId || activeEstablishmentId);

              if (
                fields.some(
                  (field) =>
                    field.id === current.transferDestinationFieldId &&
                    field.establishmentId === destinationEstablishmentId &&
                    (!isInternalTransfer || field.id !== current.fieldId)
                )
              ) {
                return current.transferDestinationFieldId;
              }

              return isInternalTransfer
                ? getAlternativeFieldId(fields, destinationEstablishmentId, current.fieldId) ||
                    getFieldIdForEstablishmentFrom(fields, destinationEstablishmentId)
                : getFieldIdForEstablishmentFrom(fields, destinationEstablishmentId);
            })()
          : ""
        : getAlternativeFieldId(fields, activeTransferDestinationId, preserveContext ? current.fieldId : activeFieldId) ||
          getFieldIdForEstablishmentFrom(fields, activeTransferDestinationId),
      species: preserveContext ? current.species : ("vacunos" as AgroSpecies),
      categoryCode: preserveContext
        ? current.categoryCode
        : categoryCatalog.vacunos[0]?.code ?? "",
      kind: preserveContext ? current.kind : ("purchase" as AnimalMovementKind),
      quantity: preserveContext ? "" : "10",
      earTag: "",
      weightKg: "",
      unitPrice: "",
      freightAmount: "",
      commissionAmount: "",
      taxAmount: "",
      collectedAmount: "",
      currency: preserveContext ? current.currency : ("USD" as MoneyCurrency),
      notes: ""
    }));
    setAnimalFormErrors({});
    setEditingAnimalMovementId(null);
  }

  function registerAnimalFieldRef(fieldName: string) {
    return (element: HTMLInputElement | HTMLSelectElement | null) => {
      animalFieldRefs.current[fieldName] = element;
    };
  }

  function clearAnimalFieldError(fieldName: string) {
    setAnimalFormErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  }

  function focusAnimalField(fieldName: string) {
    const element = animalFieldRefs.current[fieldName];
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => element.focus(), 180);
  }

  function handleAnimalKindChange(kind: AnimalMovementKind) {
    setAnimalFormErrors({});
    setAnimalForm((current) => {
      if (kind === "purchase") {
        return {
          ...current,
          kind,
          earTag: "",
          transferDestinationEstablishmentId: "",
          transferDestinationFieldId: "",
          collectedAmount: ""
        };
      }

      if (kind === "sale") {
        return {
          ...current,
          kind,
          earTag: "",
          transferDestinationEstablishmentId: "",
          transferDestinationFieldId: "",
          freightAmount: "",
          collectedAmount: current.collectedAmount || "0"
        };
      }

      return {
        ...current,
        kind,
        earTag: kind === "death" && current.species === "vacunos" ? current.earTag : "",
        transferDestinationEstablishmentId:
          kind === "transfer"
            ? current.transferDestinationEstablishmentId || current.establishmentId
            : "",
        transferDestinationFieldId:
          kind === "transfer"
            ? (() => {
                const destinationEstablishmentId = current.transferDestinationEstablishmentId || current.establishmentId;
                const isInternalTransfer = destinationEstablishmentId === current.establishmentId;

                if (
                  fields.some(
                    (field) =>
                      field.id === current.transferDestinationFieldId &&
                      field.establishmentId === destinationEstablishmentId &&
                      (!isInternalTransfer || field.id !== current.fieldId)
                  )
                ) {
                  return current.transferDestinationFieldId;
                }

                return isInternalTransfer
                  ? getAlternativeFieldId(fields, destinationEstablishmentId, current.fieldId) ||
                      getFirstFieldIdForEstablishment(fields, destinationEstablishmentId)
                  : getFirstFieldIdForEstablishment(fields, destinationEstablishmentId);
              })()
            : "",
        weightKg: "",
        unitPrice: "",
        freightAmount: "",
        commissionAmount: "",
        taxAmount: "",
        collectedAmount: "",
        currency: "USD"
      };
    });
  }

  function resetAccountingForm(preserveContext = false) {
    setAccountingForm((current) => ({
      date: preserveContext ? current.date : today,
      establishmentId: preserveContext ? current.establishmentId : activeEstablishmentId,
      fieldId: preserveContext ? current.fieldId : activeFieldId,
      type: preserveContext ? current.type : ("income" as AccountingEntryType),
      concept: preserveContext ? current.concept : ("venta_vacunos" as IncomeConcept | ExpenseConcept),
      currency: preserveContext ? current.currency : ("USD" as MoneyCurrency),
      grossAmount: "",
      commissionAmount: "",
      taxAmount: "",
      collectedAmount: "",
      notes: ""
    }));
    setEditingAccountingEntryId(null);
  }

  function resetRainfallForm(preserveContext = false) {
    setRainfallForm((current) => ({
      date: preserveContext ? current.date : today,
      establishmentId: preserveContext ? current.establishmentId : activeEstablishmentId,
      fieldId: preserveContext ? current.fieldId : activeFieldId,
      millimeters: "",
      notes: ""
    }));
    setEditingRainfallRecordId(null);
  }

  function resetSanitaryForm(preserveContext = false) {
    setSanitaryForm((current) => ({
      date: preserveContext ? current.date : today,
      establishmentId: preserveContext ? current.establishmentId : activeEstablishmentId,
      fieldId: preserveContext ? current.fieldId : activeFieldId,
      species: preserveContext ? current.species : ("vacunos" as AgroSpecies),
      quantity: "",
      treatment: "",
      notes: ""
    }));
    setEditingSanitaryRecordId(null);
  }

  function resetExchangeRateForm(preserveContext = false) {
    setExchangeRateForm((current) => ({
      yearMonth: preserveContext ? current.yearMonth : getYearMonth(today),
      averageRate: ""
    }));
    setEditingExchangeRateId(null);
  }

  function resetInitialStockForm(preserveContext = false) {
    setInitialStockForm((current) => ({
      categoryCode: preserveContext ? current.categoryCode : categoryCatalog[setupSpecies][0]?.code ?? "",
      quantity: "",
      notes: ""
    }));
  }

  function resetNewEstablishmentForm() {
    setNewEstablishmentForm({
      name: "",
      hectares: "",
      firstFieldName: "",
      firstFieldHectares: ""
    });
    setNewEstablishmentErrors({});
  }

  function resetNewFieldForm() {
    setNewFieldForm({
      name: "",
      hectares: ""
    });
    setNewFieldErrors({});
  }

  const establishmentFields = useMemo(
    () => fields.filter((field) => field.establishmentId === selectedEstablishmentId),
    [fields, selectedEstablishmentId]
  );
  const visibleFields = useMemo(
    () =>
      selectedVisibleFieldId
        ? establishmentFields.filter((field) => field.id === selectedVisibleFieldId)
        : establishmentFields,
    [establishmentFields, selectedVisibleFieldId]
  );

  useEffect(() => {
    const fallbackEstablishmentId = establishments[0]?.id ?? "";

    if (selectedEstablishmentId && establishments.some((item) => item.id === selectedEstablishmentId)) {
      return;
    }

    setSelectedEstablishmentId(fallbackEstablishmentId);
    setSelectedVisibleFieldId("");
    setSetupEstablishmentId(fallbackEstablishmentId);
    setAnimalForm((current) => ({
      ...current,
      establishmentId: fallbackEstablishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, fallbackEstablishmentId)
    }));
    setAccountingForm((current) => ({
      ...current,
      establishmentId: fallbackEstablishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, fallbackEstablishmentId)
    }));
    setRainfallForm((current) => ({
      ...current,
      establishmentId: fallbackEstablishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, fallbackEstablishmentId)
    }));
    setSanitaryForm((current) => ({
      ...current,
      establishmentId: fallbackEstablishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, fallbackEstablishmentId)
    }));
  }, [establishments, fields, selectedEstablishmentId]);

  useEffect(() => {
    if (!selectedVisibleFieldId) {
      return;
    }

    if (establishmentFields.some((field) => field.id === selectedVisibleFieldId)) {
      return;
    }

    setSelectedVisibleFieldId("");
  }, [establishmentFields, selectedVisibleFieldId]);

  useEffect(() => {
    if (!selectedEstablishmentId) {
      return;
    }

    const selectedFieldId = getFieldIdForEstablishmentFrom(fields, selectedEstablishmentId);
    const resolveSourceFieldId = (currentFieldId: string, currentEstablishmentId: string) =>
      currentEstablishmentId === selectedEstablishmentId &&
      fields.some((field) => field.id === currentFieldId && field.establishmentId === selectedEstablishmentId)
        ? currentFieldId
        : selectedFieldId;

    setSetupEstablishmentId((current) => (current === selectedEstablishmentId ? current : selectedEstablishmentId));
    setAnimalForm((current) => {
      const nextSourceFieldId = resolveSourceFieldId(current.fieldId, current.establishmentId);
      const nextTransferDestinationEstablishmentId =
        current.kind === "transfer" &&
        current.transferDestinationEstablishmentId &&
        establishments.some((item) => item.id === current.transferDestinationEstablishmentId)
          ? current.transferDestinationEstablishmentId
          : selectedEstablishmentId;
      const isInternalTransfer = nextTransferDestinationEstablishmentId === selectedEstablishmentId;
      const nextTransferDestinationFieldId = fields.some(
        (field) =>
          field.id === current.transferDestinationFieldId &&
          field.establishmentId === nextTransferDestinationEstablishmentId &&
          (!isInternalTransfer || field.id !== nextSourceFieldId)
      )
        ? current.transferDestinationFieldId
        : isInternalTransfer
          ? getAlternativeFieldId(fields, nextTransferDestinationEstablishmentId, nextSourceFieldId) ||
            getFieldIdForEstablishmentFrom(fields, nextTransferDestinationEstablishmentId)
          : getFieldIdForEstablishmentFrom(fields, nextTransferDestinationEstablishmentId);

      return {
        ...current,
        establishmentId: selectedEstablishmentId,
        fieldId: nextSourceFieldId,
        transferDestinationEstablishmentId:
          current.kind === "transfer"
            ? nextTransferDestinationEstablishmentId
            : current.transferDestinationEstablishmentId,
        transferDestinationFieldId:
          current.kind === "transfer"
            ? nextTransferDestinationFieldId
              : current.transferDestinationFieldId
      };
    });
    setAccountingForm((current) => ({
      ...current,
      establishmentId: selectedEstablishmentId,
      fieldId:
        current.establishmentId === selectedEstablishmentId && fields.some((field) => field.id === current.fieldId && field.establishmentId === selectedEstablishmentId)
          ? current.fieldId
          : selectedFieldId
    }));
    setRainfallForm((current) => ({
      ...current,
      establishmentId: selectedEstablishmentId,
      fieldId:
        current.establishmentId === selectedEstablishmentId && fields.some((field) => field.id === current.fieldId && field.establishmentId === selectedEstablishmentId)
          ? current.fieldId
          : selectedFieldId
    }));
    setSanitaryForm((current) => ({
      ...current,
      establishmentId: selectedEstablishmentId,
      fieldId:
        current.establishmentId === selectedEstablishmentId && fields.some((field) => field.id === current.fieldId && field.establishmentId === selectedEstablishmentId)
          ? current.fieldId
          : selectedFieldId
    }));
  }, [establishments, fields, selectedEstablishmentId]);

  useEffect(() => {
    if (setupFields.length === 0) {
      setSetupFieldId("");
      return;
    }

    setSetupFieldId((current) => (setupFields.some((field) => field.id === current) ? current : setupFields[0].id));
  }, [setupFields]);

  const selectedFieldIds = useMemo(() => visibleFields.map((field) => field.id), [visibleFields]);
  const selectedFieldIdSet = useMemo(() => new Set(selectedFieldIds), [selectedFieldIds]);
  const establishmentFieldIds = useMemo(() => establishmentFields.map((field) => field.id), [establishmentFields]);
  const establishmentFieldIdSet = useMemo(() => new Set(establishmentFieldIds), [establishmentFieldIds]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    animalMovements.forEach((movement) => years.add(movement.date.slice(0, 4)));
    accountingEntries.forEach((entry) => years.add(entry.date.slice(0, 4)));
    rainfallRecords.forEach((record) => years.add(record.date.slice(0, 4)));
    years.add(today.slice(0, 4));
    return [...years].sort((left, right) => right.localeCompare(left));
  }, [accountingEntries, animalMovements, rainfallRecords, today]);

  const visibleMonthRange = useMemo(() => getVisibleMonthRange(selectedYear, selectedMonth), [selectedMonth, selectedYear]);
  const accumulatedFiscalRange = useMemo(
    () => getFiscalYearToDateRange(selectedYear, selectedMonth),
    [selectedMonth, selectedYear]
  );

  const stockBalanceMap = useMemo(() => {
    const balanceMap = new Map<string, number>();

    for (const item of initialStock) {
      const key = `${item.fieldId}:${item.species}:${item.categoryCode}`;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + item.quantity);
    }

    for (const movement of animalMovements) {
      const key = `${movement.fieldId}:${movement.species}:${movement.categoryCode}`;
      const signedQuantity = getMovementDirection(movement) === "entry" ? movement.quantity : movement.quantity * -1;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + signedQuantity);
    }

    return balanceMap;
  }, [animalMovements]);

  const summaryStockBalanceMap = useMemo(() => {
    const balanceMap = new Map<string, number>();

    for (const item of initialStock) {
      const key = `${item.fieldId}:${item.species}:${item.categoryCode}`;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + item.quantity);
    }

    for (const movement of animalMovements) {
      if (!isDateOnOrBefore(movement.date, visibleMonthRange.endDate)) {
        continue;
      }

      const key = `${movement.fieldId}:${movement.species}:${movement.categoryCode}`;
      const signedQuantity = getMovementDirection(movement) === "entry" ? movement.quantity : movement.quantity * -1;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + signedQuantity);
    }

    return balanceMap;
  }, [animalMovements, visibleMonthRange.endDate]);

  const globalStockBySpecies = useMemo(() => {
    const speciesTotals: Record<AgroSpecies, number> = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0
    };

    for (const [key, quantity] of summaryStockBalanceMap.entries()) {
      const [, species] = key.split(":") as [string, AgroSpecies, string];
      speciesTotals[species] += quantity;
    }

    return speciesTotals;
  }, [summaryStockBalanceMap]);

  const stockBySpecies = useMemo(() => {
    const speciesTotals: Record<AgroSpecies, number> = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0
    };

    for (const [key, quantity] of stockBalanceMap.entries()) {
      const [fieldId, species] = key.split(":") as [string, AgroSpecies, string];
      if (!selectedFieldIdSet.has(fieldId)) {
        continue;
      }
      speciesTotals[species] += quantity;
    }

    return speciesTotals;
  }, [selectedFieldIdSet, stockBalanceMap]);

  const stockBreakdownBySpecies = useMemo(() => {
    const breakdown: Record<
      AgroSpecies,
      Array<{
        categoryCode: string;
        quantity: number;
      }>
    > = {
      vacunos: [],
      ovinos: [],
      equinos: []
    };

    const categoryTotals = new Map<string, number>();

    for (const [key, quantity] of stockBalanceMap.entries()) {
      const [fieldId, species, categoryCode] = key.split(":") as [string, AgroSpecies, string];
      if (!selectedFieldIdSet.has(fieldId)) {
        continue;
      }

      const breakdownKey = `${species}:${categoryCode}`;
      categoryTotals.set(breakdownKey, (categoryTotals.get(breakdownKey) ?? 0) + quantity);
    }

    for (const species of Object.keys(speciesLabels) as AgroSpecies[]) {
      breakdown[species] = categoryCatalog[species]
        .map((category) => ({
          categoryCode: category.code,
          quantity: categoryTotals.get(`${species}:${category.code}`) ?? 0
        }))
        .filter((item) => item.quantity !== 0);
    }

    return breakdown;
  }, [selectedFieldIdSet, stockBalanceMap]);

  const currentEditingTransferMovement = useMemo(() => {
    if (!editingAnimalMovementId) {
      return null;
    }

    const movement = animalMovements.find((item) => item.id === editingAnimalMovementId);
    if (!movement || !isTransferMovementKind(movement.kind)) {
      return null;
    }

    const pairedMovement = movement.pairedTransferMovementId
      ? animalMovements.find((item) => item.id === movement.pairedTransferMovementId)
      : undefined;
    if (!pairedMovement) {
      return null;
    }

    return movement.kind === "transfer_out"
      ? { sourceMovement: movement, destinationMovement: pairedMovement }
      : { sourceMovement: pairedMovement, destinationMovement: movement };
  }, [animalMovements, editingAnimalMovementId]);

  const transferOriginAvailability = useMemo(() => {
    const availability = new Map<AgroSpecies, Array<{ categoryCode: string; quantity: number }>>();

    for (const [key, rawQuantity] of stockBalanceMap.entries()) {
      const [fieldId, species, categoryCode] = key.split(":") as [string, AgroSpecies, string];
      if (fieldId !== animalForm.fieldId) {
        continue;
      }

      let quantity = rawQuantity;
      if (
        currentEditingTransferMovement &&
        currentEditingTransferMovement.sourceMovement.fieldId === fieldId &&
        currentEditingTransferMovement.sourceMovement.species === species &&
        currentEditingTransferMovement.sourceMovement.categoryCode === categoryCode
      ) {
        quantity += currentEditingTransferMovement.sourceMovement.quantity;
      }

      if (quantity <= 0) {
        continue;
      }

      const rows = availability.get(species) ?? [];
      rows.push({ categoryCode, quantity });
      availability.set(species, rows);
    }

    return availability;
  }, [animalForm.fieldId, currentEditingTransferMovement, stockBalanceMap]);

  const transferAvailableSpecies = useMemo(
    () => Array.from(transferOriginAvailability.keys()),
    [transferOriginAvailability]
  );

  const transferAvailableCategories = useMemo(
    () => transferOriginAvailability.get(animalForm.species) ?? [],
    [animalForm.species, transferOriginAvailability]
  );

  const transferAvailableQuantity = useMemo(
    () =>
      transferAvailableCategories.find((item) => item.categoryCode === animalForm.categoryCode)?.quantity ?? 0,
    [animalForm.categoryCode, transferAvailableCategories]
  );

  const accountingTotals = useMemo(() => {
    return accountingEntries
      .filter(
        (entry) =>
          establishmentFieldIdSet.has(entry.fieldId) &&
          isDateWithinRange(entry.date, visibleMonthRange.startDate, visibleMonthRange.endDate)
      )
      .reduce(
        (summary, entry) => {
          if (entry.type === "income") {
            summary[entry.currency].income += entry.netAmount;
            return summary;
          }

          if (isLivestockPurchaseEntry(entry)) {
            summary[entry.currency].livestockPurchaseExpense += entry.netAmount;
          } else {
            summary[entry.currency].operationalExpense += entry.netAmount;
          }

          return summary;
        },
        {
          USD: { income: 0, livestockPurchaseExpense: 0, operationalExpense: 0 },
          UYU: { income: 0, livestockPurchaseExpense: 0, operationalExpense: 0 }
        }
      );
  }, [accountingEntries, establishmentFieldIdSet, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  const exchangeRateByMonth = useMemo(() => {
    return monthlyExchangeRates.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.yearMonth] = item.averageRate;
      return accumulator;
    }, {});
  }, [monthlyExchangeRates]);

  const latestAnimalMovements = useMemo(() => {
    return [...animalMovements]
      .filter((movement) => selectedFieldIdSet.has(movement.fieldId))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6);
  }, [animalMovements, selectedFieldIdSet]);

  const latestAccountingEntries = useMemo(() => {
    return [...accountingEntries]
      .filter((entry) => establishmentFieldIdSet.has(entry.fieldId))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6);
  }, [accountingEntries, establishmentFieldIdSet]);

  const animalLedgerRows = useMemo(() => {
    return [...animalMovements]
      .filter((movement) => {
        if (!selectedFieldIdSet.has(movement.fieldId)) {
          return false;
        }

        if (!isDateWithinRange(movement.date, visibleMonthRange.startDate, visibleMonthRange.endDate)) {
          return false;
        }

        if (!animalSearchTerm.trim()) {
          return true;
        }

        const field = fields.find((item) => item.id === movement.fieldId);
        const establishment = field ? establishments.find((item) => item.id === field.establishmentId) : undefined;
        const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
        const searchBase = [
          movement.date,
          establishment?.name ?? "",
          field?.name ?? "",
          movementKindLabels[movement.kind],
          speciesLabels[movement.species],
          category?.label ?? "",
          movement.earTag ?? "",
          movement.notes
        ]
          .join(" ")
          .toLowerCase();

        return searchBase.includes(animalSearchTerm.trim().toLowerCase());
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [animalMovements, animalSearchTerm, establishments, fields, selectedFieldIdSet, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  const transferRows = useMemo(() => {
    const seenIds = new Set<string>();

    return animalMovements
      .filter((movement) => isTransferMovementKind(movement.kind))
      .sort((left, right) => right.date.localeCompare(left.date))
      .reduce<
        Array<{
          id: string;
          editMovementId: string;
          date: string;
          sourceEstablishmentId: string;
          sourceFieldId: string;
          destinationEstablishmentId: string;
          destinationFieldId: string;
          species: AgroSpecies;
          categoryCode: string;
          quantity: number;
          notes: string;
        }>
      >((rows, movement) => {
        if (seenIds.has(movement.id)) {
          return rows;
        }

        const pairedMovement = movement.pairedTransferMovementId
          ? animalMovements.find((item) => item.id === movement.pairedTransferMovementId)
          : undefined;
        const sourceMovement = movement.kind === "transfer_out" ? movement : pairedMovement;
        const destinationMovement = movement.kind === "transfer_in" ? movement : pairedMovement;

        if (!sourceMovement || !destinationMovement) {
          return rows;
        }

        if (!isDateWithinRange(sourceMovement.date, visibleMonthRange.startDate, visibleMonthRange.endDate)) {
          return rows;
        }

        if (!selectedFieldIdSet.has(sourceMovement.fieldId) && !selectedFieldIdSet.has(destinationMovement.fieldId)) {
          return rows;
        }

        seenIds.add(sourceMovement.id);
        seenIds.add(destinationMovement.id);

        rows.push({
          id: sourceMovement.id,
          editMovementId: sourceMovement.id,
          date: sourceMovement.date,
          sourceEstablishmentId: sourceMovement.establishmentId,
          sourceFieldId: sourceMovement.fieldId,
          destinationEstablishmentId: destinationMovement.establishmentId,
          destinationFieldId: destinationMovement.fieldId,
          species: sourceMovement.species,
          categoryCode: sourceMovement.categoryCode,
          quantity: sourceMovement.quantity,
          notes: sourceMovement.notes
        });

        return rows;
      }, []);
  }, [animalMovements, selectedFieldIdSet, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  useEffect(() => {
    function syncAnimalScrollbarMetrics() {
      const tableWrap = animalTableWrapRef.current;
      const table = animalTableRef.current;
      const scrollbar = animalTableScrollbarRef.current;
      const scrollbarInner = animalTableScrollbarInnerRef.current;

      if (!tableWrap || !table || !scrollbar || !scrollbarInner) {
        return;
      }

      const hasOverflow = table.scrollWidth > tableWrap.clientWidth + 4;
      setShowAnimalFloatingScrollbar(hasOverflow);
      scrollbarInner.style.width = `${table.scrollWidth}px`;
      scrollbar.scrollLeft = tableWrap.scrollLeft;
    }

    syncAnimalScrollbarMetrics();
    window.addEventListener("resize", syncAnimalScrollbarMetrics);
    return () => window.removeEventListener("resize", syncAnimalScrollbarMetrics);
  }, [animalLedgerRows, activeView]);

  useEffect(() => {
    const tableWrap = animalTableWrapRef.current;
    const scrollbar = animalTableScrollbarRef.current;

    if (!tableWrap || !scrollbar) {
      return;
    }

    const nextTableWrap = tableWrap;
    const nextScrollbar = scrollbar;

    function handleTableScroll() {
      if (syncingAnimalScrollRef.current === "bottom-bar") {
        syncingAnimalScrollRef.current = null;
        return;
      }

      syncingAnimalScrollRef.current = "table";
      nextScrollbar.scrollLeft = nextTableWrap.scrollLeft;
    }

    function handleBottomBarScroll() {
      if (syncingAnimalScrollRef.current === "table") {
        syncingAnimalScrollRef.current = null;
        return;
      }

      syncingAnimalScrollRef.current = "bottom-bar";
      nextTableWrap.scrollLeft = nextScrollbar.scrollLeft;
    }

    nextTableWrap.addEventListener("scroll", handleTableScroll);
    nextScrollbar.addEventListener("scroll", handleBottomBarScroll);

    return () => {
      nextTableWrap.removeEventListener("scroll", handleTableScroll);
      nextScrollbar.removeEventListener("scroll", handleBottomBarScroll);
    };
  }, [animalLedgerRows, activeView]);

  const accountingLedgerRows = useMemo(() => {
    return [...accountingEntries]
      .filter((entry) => {
        if (!establishmentFieldIdSet.has(entry.fieldId)) {
          return false;
        }

        if (!isDateWithinRange(entry.date, visibleMonthRange.startDate, visibleMonthRange.endDate)) {
          return false;
        }

        if (!accountingSearchTerm.trim()) {
          return true;
        }

        const establishment = establishments.find((item) => item.id === entry.establishmentId);
        const conceptLabel =
          entry.type === "income"
            ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
            : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels];
        const searchBase = [entry.date, establishment?.name ?? "", conceptLabel, entry.currency, entry.notes]
          .join(" ")
          .toLowerCase();

        return searchBase.includes(accountingSearchTerm.trim().toLowerCase());
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [accountingEntries, accountingSearchTerm, establishmentFieldIdSet, establishments, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  const accountingLedgerWithConversions = useMemo(() => {
    return accountingLedgerRows.map((entry) => {
      const expectedAmount = getIncomeExpectedAmount(entry);
      const collectedAmount = getIncomeCollectedAmount(entry);
      const pendingAmount = getIncomePendingAmount(entry);
      const collectionStatus = getIncomeCollectionStatus(entry);

      if (entry.type !== "expense" || entry.currency !== "UYU") {
        return {
          ...entry,
          expectedAmount,
          collectedAmount,
          pendingAmount,
          collectionStatus,
          exchangeRateAverage: null,
          usdEquivalent: null
        };
      }

      const exchangeRateAverage = exchangeRateByMonth[getYearMonth(entry.date)] ?? null;

      return {
        ...entry,
        expectedAmount,
        collectedAmount,
        pendingAmount,
        collectionStatus,
        exchangeRateAverage,
        usdEquivalent: exchangeRateAverage ? entry.netAmount / exchangeRateAverage : null
      };
    });
  }, [accountingLedgerRows, exchangeRateByMonth]);

  const visibleAccountingLedgerWithConversions = useMemo(() => {
    if (accountingStatusFilter === "all") {
      return accountingLedgerWithConversions;
    }

    return accountingLedgerWithConversions.filter((entry) => {
      if (entry.type !== "income") {
        return false;
      }

      if (accountingStatusFilter === "pending") {
        return entry.collectionStatus === "Pendiente";
      }

      if (accountingStatusFilter === "partial") {
        return entry.collectionStatus === "Parcial";
      }

      return entry.collectionStatus === "Cobrado";
    });
  }, [accountingLedgerWithConversions, accountingStatusFilter]);

  const summaryByField = useMemo(() => {
    return visibleFields.map((field) => {
      const stockRows = Array.from(summaryStockBalanceMap.entries())
        .filter(([key]) => key.startsWith(`${field.id}:`))
        .map(([key, quantity]) => {
          const [, species, categoryCode] = key.split(":") as [string, AgroSpecies, string];
          const category = categoryCatalog[species].find((item) => item.code === categoryCode);
          return {
            species,
            categoryCode,
            categoryLabel: category ? formatCategoryLabel(category.label) : categoryCode,
            quantity
          };
        })
        .filter((row) => row.quantity !== 0);

      const movementRows = animalMovements.filter((movement) => {
        if (movement.fieldId !== field.id) {
          return false;
        }

        return isDateWithinRange(movement.date, visibleMonthRange.startDate, visibleMonthRange.endDate);
      });
      const accountingRows = accountingEntries.filter((entry) => {
        if (entry.fieldId !== field.id) {
          return false;
        }

        return isDateWithinRange(entry.date, visibleMonthRange.startDate, visibleMonthRange.endDate);
      });
      const expenseSummary = summarizeExpenses(accountingRows, exchangeRateByMonth);
      const rainfallTotal = rainfallRecords
        .filter((record) => {
          if (record.fieldId !== field.id) {
            return false;
          }

          return isDateWithinRange(record.date, visibleMonthRange.startDate, visibleMonthRange.endDate);
        })
        .reduce((sum, record) => sum + record.millimeters, 0);

      const speciesTotals = (Object.keys(speciesLabels) as AgroSpecies[]).reduce(
        (totals, species) => {
          totals[species] = stockRows
            .filter((row) => row.species === species)
            .reduce((sum, row) => sum + row.quantity, 0);
          return totals;
        },
        { vacunos: 0, ovinos: 0, equinos: 0 } as Record<AgroSpecies, number>
      );
      const specialMovementRows = movementRows
        .filter((movement) => movement.kind === "shortage" || movement.kind === "transfer_in" || movement.kind === "transfer_out")
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 3)
        .map((movement) => {
          const categoryLabel =
            (() => {
              const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
              return category ? formatCategoryLabel(category.label) : speciesLabels[movement.species];
            })();

          return {
            id: movement.id,
            date: movement.date,
            kind: movement.kind,
            quantity: movement.quantity,
            categoryLabel,
            detail: describeAnimalMovementDetail(movement, animalMovements, fields)
          };
        });

      return {
        field,
        stockRows,
        speciesTotals,
        specialMovementRows,
        purchases: movementRows
          .filter((movement) => movement.kind === "purchase")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        sales: movementRows
          .filter((movement) => movement.kind === "sale")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        incomeUsd: accountingRows
          .filter((entry) => entry.type === "income" && entry.currency === "USD")
          .reduce((sum, entry) => sum + getIncomeCollectedAmount(entry), 0),
        pendingIncomeUsd: accountingRows
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
        rainfallTotal,
        adjustments: movementRows
          .filter((movement) => movement.kind === "adjustment")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        transfersIn: movementRows
          .filter((movement) => movement.kind === "transfer_in")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        transfersOut: movementRows
          .filter((movement) => movement.kind === "transfer_out")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        deaths: movementRows
          .filter((movement) => movement.kind === "death")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        shortages: movementRows
          .filter((movement) => movement.kind === "shortage")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        lastRainfallDate: rainfallRecords
          .filter((record) => {
            if (record.fieldId !== field.id) {
              return false;
            }

            return isDateWithinRange(record.date, visibleMonthRange.startDate, visibleMonthRange.endDate);
          })
          .sort((left, right) => right.date.localeCompare(left.date))[0]?.date
      };
    });
  }, [
    accountingEntries,
    animalMovements,
    exchangeRateByMonth,
    fields,
    rainfallRecords,
    visibleMonthRange.endDate,
    visibleMonthRange.startDate,
    summaryStockBalanceMap,
    visibleFields
  ]);

  const periodSummary = useMemo(() => {
    return summarizeRangeData(
      animalMovements,
      accountingEntries,
      rainfallRecords,
      exchangeRateByMonth,
      visibleMonthRange.startDate,
      visibleMonthRange.endDate,
      selectedFieldIdSet
    );
  }, [
    accountingEntries,
    animalMovements,
    exchangeRateByMonth,
    rainfallRecords,
    selectedFieldIdSet,
    visibleMonthRange.endDate,
    visibleMonthRange.startDate
  ]);

  const globalPeriodSummary = useMemo(() => {
    const rangeSummary = summarizeRangeData(
      animalMovements,
      accountingEntries,
      rainfallRecords,
      exchangeRateByMonth,
      visibleMonthRange.startDate,
      visibleMonthRange.endDate
    );

    return {
      establishmentCount: establishments.length,
      fieldCount: fields.length,
      ...rangeSummary
    };
  }, [
    accountingEntries,
    animalMovements,
    establishments.length,
    exchangeRateByMonth,
    fields.length,
    rainfallRecords,
    visibleMonthRange.endDate,
    visibleMonthRange.startDate
  ]);

  const accumulatedSummary = useMemo(() => {
    return summarizeRangeData(
      animalMovements,
      accountingEntries,
      rainfallRecords,
      exchangeRateByMonth,
      accumulatedFiscalRange.startDate,
      accumulatedFiscalRange.endDate,
      selectedFieldIdSet
    );
  }, [
    accountingEntries,
    accumulatedFiscalRange.endDate,
    accumulatedFiscalRange.startDate,
    animalMovements,
    exchangeRateByMonth,
    rainfallRecords,
    selectedFieldIdSet
  ]);

  const animalLedgerSummary = useMemo(() => {
    return {
      purchases: animalLedgerRows.filter((movement) => movement.kind === "purchase").length,
      sales: animalLedgerRows.filter((movement) => movement.kind === "sale").length,
      stockInternalMoves: transferRows.length,
      stockIncidents: animalLedgerRows.filter(
        (movement) => movement.kind === "birth" || movement.kind === "death" || movement.kind === "shortage"
      ).length,
      linkedCommercialRows: animalLedgerRows.filter((movement) => Boolean(movement.linkedAccountingEntryId)).length
    };
  }, [animalLedgerRows, transferRows]);

  const rainfallRows = useMemo(() => {
    return [...rainfallRecords]
      .filter(
        (record) => {
          if (!establishmentFieldIds.includes(record.fieldId)) {
            return false;
          }

          if (!isDateWithinRange(record.date, visibleMonthRange.startDate, visibleMonthRange.endDate)) {
            return false;
          }

          if (!rainfallSearchTerm.trim()) {
            return true;
          }

          const field = fields.find((item) => item.id === record.fieldId);
          const establishment = field ? establishments.find((item) => item.id === field.establishmentId) : undefined;
          const searchBase = [record.date, establishment?.name ?? "", record.notes, `${record.millimeters}`]
            .join(" ")
            .toLowerCase();

          return searchBase.includes(rainfallSearchTerm.trim().toLowerCase());
        }
      )
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [establishmentFieldIds, establishments, rainfallRecords, rainfallSearchTerm, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  const sanitaryRows = useMemo(() => {
    return [...sanitaryRecords]
      .filter((record) => {
        if (!selectedFieldIds.includes(record.fieldId)) {
          return false;
        }

        if (!isDateWithinRange(record.date, visibleMonthRange.startDate, visibleMonthRange.endDate)) {
          return false;
        }

        if (!sanitarySearchTerm.trim()) {
          return true;
        }

        const field = fields.find((item) => item.id === record.fieldId);
        const establishment = establishments.find((item) => item.id === record.establishmentId);
        const searchBase = [record.date, establishment?.name ?? "", field?.name ?? "", speciesLabels[record.species], record.treatment, record.notes, `${record.quantity}`]
          .join(" ")
          .toLowerCase();

        return searchBase.includes(sanitarySearchTerm.trim().toLowerCase());
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [establishments, fields, sanitaryRecords, sanitarySearchTerm, selectedFieldIds, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  const visibleExchangeRates = useMemo(() => {
    return [...monthlyExchangeRates].sort((left, right) => right.yearMonth.localeCompare(left.yearMonth));
  }, [monthlyExchangeRates]);

  const accountingCollectionSummary = useMemo(() => {
    const incomeUsd = accountingLedgerRows
      .filter((entry) => entry.type === "income" && entry.currency === "USD")
      .reduce((sum, entry) => sum + getIncomeCollectedAmount(entry), 0);
    const pendingIncomeUsd = accountingLedgerRows
      .filter((entry) => entry.type === "income" && entry.currency === "USD")
      .reduce((sum, entry) => sum + getIncomePendingAmount(entry), 0);
    const expenseSummary = summarizeExpenses(accountingLedgerRows, exchangeRateByMonth);

    return {
      incomeUsd,
      pendingIncomeUsd,
      livestockPurchaseExpenseUsdDirect: expenseSummary.livestockPurchase.usd,
      livestockPurchaseExpenseUyu: expenseSummary.livestockPurchase.uyu,
      livestockPurchaseExpenseUyuDollarized: expenseSummary.livestockPurchase.uyuDollarized,
      totalLivestockPurchaseExpenseUsdEquivalent:
        expenseSummary.livestockPurchase.usd + expenseSummary.livestockPurchase.uyuDollarized,
      operationalExpenseUsdDirect: expenseSummary.operational.usd,
      operationalExpenseUyu: expenseSummary.operational.uyu,
      operationalExpenseUyuDollarized: expenseSummary.operational.uyuDollarized,
      totalOperationalExpenseUsdEquivalent: expenseSummary.operational.usd + expenseSummary.operational.uyuDollarized
    };
  }, [accountingLedgerRows, exchangeRateByMonth]);

  const categoryControlRows = useMemo(() => {
    return summaryByField.flatMap((item) =>
      item.stockRows.map((row) => ({
        fieldName: item.field.name,
        speciesLabel: speciesLabels[row.species],
        categoryLabel: row.categoryLabel,
        quantity: row.quantity
      }))
    );
  }, [summaryByField]);

  const accountStatementRows = useMemo(() => {
    return accountingEntries
      .filter((entry) => entry.type === "income")
      .filter((entry) => {
        if (!establishmentFieldIdSet.has(entry.fieldId)) {
          return false;
        }

        return isDateWithinRange(entry.date, visibleMonthRange.startDate, visibleMonthRange.endDate);
      })
      .map((entry) => {
        const field = fields.find((item) => item.id === entry.fieldId);
        const linkedMovement = entry.linkedAnimalMovementId
          ? animalMovements.find((movement) => movement.id === entry.linkedAnimalMovementId)
          : undefined;

        return {
          id: entry.id,
          date: entry.date,
          fieldName: establishments.find((item) => item.id === entry.establishmentId)?.name ?? "-",
          conceptLabel: incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels],
          totalAmount: getIncomeExpectedAmount(entry),
          collectedAmount: getIncomeCollectedAmount(entry),
          pendingAmount: getIncomePendingAmount(entry),
          collectionStatus: getIncomeCollectionStatus(entry) ?? "Pendiente",
          currency: entry.currency,
          originLabel: linkedMovement ? "Animales" : "Contabilidad",
          notes: entry.notes
        };
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [accountingEntries, animalMovements, establishmentFieldIdSet, establishments, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  const accountStatementSummary = useMemo(() => {
    return accountStatementRows.reduce(
      (summary, row) => {
        if (row.collectionStatus === "Pendiente") {
          summary.pending += 1;
        } else if (row.collectionStatus === "Parcial") {
          summary.partial += 1;
        } else {
          summary.collected += 1;
        }

        summary.pendingValue += row.pendingAmount;
        return summary;
      },
      {
        pending: 0,
        partial: 0,
        collected: 0,
        pendingValue: 0
      }
    );
  }, [accountStatementRows]);

  const visibleAccountStatementRows = useMemo(() => {
    if (linkedOperationsStatusFilter === "all") {
      return accountStatementRows;
    }

    return accountStatementRows.filter((row) => {
      if (linkedOperationsStatusFilter === "pending") {
        return row.collectionStatus === "Pendiente";
      }

      if (linkedOperationsStatusFilter === "partial") {
        return row.collectionStatus === "Parcial";
      }

      return row.collectionStatus === "Cobrado";
    });
  }, [accountStatementRows, linkedOperationsStatusFilter]);

  const setupSummary = useMemo(() => {
    return {
      stockLoads: animalMovements.filter(
        (movement) => movement.kind === "adjustment" && movement.notes.startsWith("Carga inicial:")
      ).length
    };
  }, [animalMovements]);

  function getFieldDeleteBlockReason(fieldId: string) {
    if (setupFields.length <= 1) {
      return "No se puede eliminar el unico potrero del campo.";
    }

    if (animalMovements.some((movement) => movement.fieldId === fieldId)) {
      return "Tiene animales o movimientos cargados.";
    }

    if (accountingEntries.some((entry) => entry.fieldId === fieldId)) {
      return "Tiene movimientos contables asociados.";
    }

    if (rainfallRecords.some((record) => record.fieldId === fieldId)) {
      return "Tiene registros de lluvia asociados.";
    }

    if (sanitaryRecords.some((record) => record.fieldId === fieldId)) {
      return "Tiene sanidad asociada.";
    }

    return null;
  }

  const setupFieldRows = useMemo(
    () =>
      setupFields.map((field) => {
        const deleteBlockReason = getFieldDeleteBlockReason(field.id);

        return {
          id: field.id,
          name: field.name,
          hectares: field.hectares,
          canDelete: deleteBlockReason === null,
          deleteBlockReason
        };
      }),
    [accountingEntries, animalMovements, rainfallRecords, sanitaryRecords, setupFields]
  );

  const initialLoadRows = useMemo(() => {
    return animalMovements
      .filter(
        (movement) =>
          selectedFieldIdSet.has(movement.fieldId) &&
          movement.kind === "adjustment" &&
          movement.notes.startsWith("Carga inicial:") &&
          isDateOnOrBefore(movement.date, visibleMonthRange.endDate)
      )
      .map((movement) => {
        const establishment = establishments.find((item) => item.id === movement.establishmentId);
        const field = fields.find((item) => item.id === movement.fieldId);
        const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);

        return {
          id: movement.id,
          date: movement.date,
          establishmentName: establishment?.name ?? "-",
          fieldName: field?.name ?? "-",
          speciesLabel: speciesLabels[movement.species],
          categoryLabel: category ? formatCategoryLabel(category.label) : movement.categoryCode,
          quantity: movement.quantity,
          notes: movement.notes.replace(/^Carga inicial:\s*/, "").trim() || "-"
        };
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [animalMovements, establishments, fields, selectedFieldIdSet, visibleMonthRange.endDate]);

  useEffect(() => {
    let isCancelled = false;

    async function loadWorkspace() {
      try {
        const snapshot = await fetchAgroWorkspace(persistenceMode);
        if (isCancelled) {
          return;
        }

        const nextEstablishments = Array.isArray(snapshot.data.establishments)
          ? snapshot.data.establishments
          : initialEstablishments;
        const nextFields = normalizeFieldUnits(
          Array.isArray(snapshot.data.fields) ? snapshot.data.fields : initialFields,
          nextEstablishments
        );

        setEstablishments(nextEstablishments);
        setFields(nextFields);
        setAnimalMovements(snapshot.data.animalMovements.map((movement) => normalizeAnimalMovementRecord(movement, nextFields)));
        setAccountingEntries(snapshot.data.accountingEntries.map((entry) => normalizeAccountingEntry(entry, nextFields)));
        setRainfallRecords(snapshot.data.rainfallRecords.map((record) => normalizeRainfallRecord(record, nextFields)));
        setSanitaryRecords(snapshot.data.sanitaryRecords.map((record) => normalizeSanitaryRecord(record, nextFields)));
        setMonthlyExchangeRates(snapshot.data.monthlyExchangeRates);
        setWorkspaceLoadError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "No se pudo cargar el workspace de agro.";
        setEstablishments([]);
        setFields([]);
        setAnimalMovements([]);
        setAccountingEntries([]);
        setRainfallRecords([]);
        setSanitaryRecords([]);
        setMonthlyExchangeRates([]);
        setWorkspaceLoadError(message);
        showError(message);
      } finally {
        if (!isCancelled) {
          setWorkspaceLoaded(true);
        }
      }
    }

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [persistenceMode]);

  useEffect(() => {
    if (!workspaceLoaded || workspaceLoadError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveAgroWorkspace(persistenceMode, {
        establishments,
        fields,
        animalMovements,
        accountingEntries,
        rainfallRecords,
        sanitaryRecords,
        monthlyExchangeRates
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "No se pudo guardar el workspace de agro.";
        showError(message);
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [
    accountingEntries,
    animalMovements,
    establishments,
    fields,
    monthlyExchangeRates,
    rainfallRecords,
    sanitaryRecords,
    workspaceLoaded,
    workspaceLoadError,
    persistenceMode
  ]);

  const isCommercialAnimalMovement = animalForm.kind === "purchase" || animalForm.kind === "sale";
  const isBirthOrDeathAnimalMovement =
    animalForm.kind === "birth" ||
    animalForm.kind === "death" ||
    animalForm.kind === "transfer" ||
    animalForm.kind === "shortage";
  const isAdjustmentAnimalMovement = animalForm.kind === "adjustment";
  const isCattleDeathWithEarTag = requiresEarTag(animalForm.kind, animalForm.species);

  const establishmentSummary = establishments
    .filter((item) => item.id === selectedEstablishmentId)
    .map((item) => ({
      ...item,
      fieldCount: fields.filter((field) => field.establishmentId === item.id).length
    }))[0];

  useEffect(() => {
    setInitialStockForm((current) => ({
      ...current,
      categoryCode: categoryCatalog[setupSpecies].some((item) => item.code === current.categoryCode)
        ? current.categoryCode
        : categoryCatalog[setupSpecies][0]?.code ?? ""
    }));
  }, [setupSpecies]);

  useEffect(() => {
    if (animalForm.kind !== "transfer") {
      return;
    }

    setAnimalForm((current) => {
      const nextSpecies =
        transferAvailableSpecies.includes(current.species) ? current.species : transferAvailableSpecies[0] ?? current.species;
      const nextCategories = transferOriginAvailability.get(nextSpecies) ?? [];
      const nextCategoryCode =
        nextCategories.some((item) => item.categoryCode === current.categoryCode)
          ? current.categoryCode
          : nextCategories[0]?.categoryCode ?? current.categoryCode;

      if (nextSpecies === current.species && nextCategoryCode === current.categoryCode) {
        return current;
      }

      return {
        ...current,
        species: nextSpecies,
        categoryCode: nextCategoryCode
      };
    });
  }, [animalForm.kind, transferAvailableSpecies, transferOriginAvailability]);

  function showSuccess(message: string) {
    toast.success(message, { autoClose: 2400 });
  }

  function showError(message: string) {
    toast.error(message, { autoClose: false });
  }

  function buildAgroSlug(value: string) {
    return (
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `item-${Date.now()}`
    );
  }

  function clearNewEstablishmentError(fieldName: "name" | "hectares" | "firstFieldName" | "firstFieldHectares") {
    setNewEstablishmentErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  }

  function clearNewFieldError(fieldName: "name" | "hectares") {
    setNewFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  }

  function handleAddEstablishment() {
    const name = newEstablishmentForm.name.trim();
    const hectares = parseDecimalInput(newEstablishmentForm.hectares);
    const firstFieldName = newEstablishmentForm.firstFieldName.trim();
    const firstFieldHectares = parseDecimalInput(newEstablishmentForm.firstFieldHectares);
    const nextErrors: Record<string, string> = {};

    if (!name) {
      nextErrors.name = "Falta el nombre del establecimiento.";
    }

    if (!Number.isFinite(hectares) || hectares <= 0) {
      nextErrors.hectares = "Faltan las hectareas del campo.";
    }

    if (!firstFieldName) {
      nextErrors.firstFieldName = "Falta el nombre del primer potrero.";
    }

    if (!Number.isFinite(firstFieldHectares) || firstFieldHectares <= 0) {
      nextErrors.firstFieldHectares = "Faltan las hectareas del potrero.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setNewEstablishmentErrors(nextErrors);
      showError(
        nextErrors.hectares ??
          nextErrors.name ??
          nextErrors.firstFieldName ??
          nextErrors.firstFieldHectares ??
          "Faltan datos del campo."
      );
      return;
    }

    if (establishments.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewEstablishmentErrors({});
      showError("Ese establecimiento ya existe.");
      return;
    }

    const slug = buildAgroSlug(name);

    const establishmentId = `est-${slug}`;
    const fieldId = `field-${slug}-${buildAgroSlug(firstFieldName)}`;
    const nextEstablishment: Establishment = {
      id: establishmentId,
      name,
      location: "",
      hectares
    };

    const nextField: FieldUnit = {
      id: fieldId,
      establishmentId,
      name: firstFieldName,
      hectares: firstFieldHectares,
      notes: "Potrero cargado desde la configuracion inicial."
    };

    setEstablishments((current) => [...current, nextEstablishment]);
    setFields((current) => [...current, nextField]);
    setSelectedEstablishmentId(establishmentId);
    setSetupEstablishmentId(establishmentId);
    setSetupFieldId(fieldId);
    setAnimalForm((current) => ({ ...current, establishmentId, fieldId }));
    setAccountingForm((current) => ({ ...current, establishmentId, fieldId }));
    setRainfallForm((current) => ({ ...current, establishmentId, fieldId }));
    setSanitaryForm((current) => ({ ...current, establishmentId, fieldId }));
    resetNewEstablishmentForm();
    setNewEstablishmentErrors({});
    showSuccess("Establecimiento agregado.");
  }

  function handleAddField() {
    const name = newFieldForm.name.trim();
    const hectares = parseDecimalInput(newFieldForm.hectares);
    const nextErrors: Record<string, string> = {};

    if (!setupEstablishmentId) {
      showError("Primero elegi un establecimiento para agregarle potreros.");
      return;
    }

    if (!name) {
      nextErrors.name = "Falta el nombre del potrero.";
    }

    if (!Number.isFinite(hectares) || hectares <= 0) {
      nextErrors.hectares = "Faltan las hectareas del potrero.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setNewFieldErrors(nextErrors);
      showError(nextErrors.hectares ?? nextErrors.name ?? "Faltan datos del potrero.");
      return;
    }

    const duplicateField = fields.some(
      (field) => field.establishmentId === setupEstablishmentId && field.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicateField) {
      setNewFieldErrors({});
      showError("Ese potrero ya existe dentro del campo elegido.");
      return;
    }

    const fieldId = `field-${buildAgroSlug(setupEstablishmentId)}-${buildAgroSlug(name)}`;
    const nextField: FieldUnit = {
      id: fieldId,
      establishmentId: setupEstablishmentId,
      name,
      hectares,
      notes: "Potrero agregado manualmente."
    };

    setFields((current) => [...current, nextField]);
    setSetupFieldId(fieldId);
    setAnimalForm((current) =>
      current.establishmentId === setupEstablishmentId ? { ...current, fieldId } : current
    );
    setAccountingForm((current) =>
      current.establishmentId === setupEstablishmentId ? { ...current, fieldId } : current
    );
    setRainfallForm((current) =>
      current.establishmentId === setupEstablishmentId ? { ...current, fieldId } : current
    );
    setSanitaryForm((current) =>
      current.establishmentId === setupEstablishmentId ? { ...current, fieldId } : current
    );
    resetNewFieldForm();
    showSuccess("Potrero agregado.");
  }

  function handleDeleteField(fieldId: string) {
    const field = fields.find((item) => item.id === fieldId);

    if (!field) {
      showError("No encontramos ese potrero.");
      return;
    }

    if (field.establishmentId !== setupEstablishmentId) {
      showError("Ese potrero no pertenece al campo seleccionado.");
      return;
    }

    const deleteBlockReason = getFieldDeleteBlockReason(fieldId);
    if (deleteBlockReason) {
      showError(deleteBlockReason);
      return;
    }

    const confirmed = window.confirm(`Eliminar el potrero "${field.name}"? Esta accion solo se permite porque no tiene datos asociados.`);
    if (!confirmed) {
      return;
    }

    const fallbackFieldId =
      fields.find((item) => item.establishmentId === setupEstablishmentId && item.id !== fieldId)?.id ?? "";

    setFields((current) => current.filter((item) => item.id !== fieldId));
    setSetupFieldId((current) => (current === fieldId ? fallbackFieldId : current));
    setSelectedVisibleFieldId((current) => (current === fieldId ? "all" : current));
    setAnimalForm((current) => (current.fieldId === fieldId ? { ...current, fieldId: fallbackFieldId } : current));
    setAccountingForm((current) => (current.fieldId === fieldId ? { ...current, fieldId: fallbackFieldId } : current));
    setRainfallForm((current) => (current.fieldId === fieldId ? { ...current, fieldId: fallbackFieldId } : current));
    setSanitaryForm((current) => (current.fieldId === fieldId ? { ...current, fieldId: fallbackFieldId } : current));
    showSuccess("Potrero eliminado.");
  }

  function handleAnimalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = parseDecimalInput(animalForm.quantity);
    const weightKg = parseDecimalInput(animalForm.weightKg);
    const unitPrice = parseDecimalInput(animalForm.unitPrice);
    const freightAmount = parseDecimalInput(animalForm.freightAmount);
    const commissionAmount = parseDecimalInput(animalForm.commissionAmount);
    const taxAmount = parseDecimalInput(animalForm.taxAmount);
    const collectedAmount =
      animalForm.kind === "sale"
        ? animalForm.collectedAmount.trim() === ""
          ? 0
          : parseDecimalInput(animalForm.collectedAmount)
        : undefined;
    const commercialMovement = animalForm.kind === "purchase" || animalForm.kind === "sale";
    const isTransferMovement = animalForm.kind === "transfer";
    const isInternalTransferMovement =
      isTransferMovement && animalForm.transferDestinationEstablishmentId === animalForm.establishmentId;
    const nextErrors: Record<string, string> = {};

    if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = "La cantidad debe ser mayor a 0.";
    }

    if (isCattleDeathWithEarTag && !animalForm.earTag.trim()) {
      nextErrors.earTag = "Falta agregar el numero de caravana.";
    }

    if (isTransferMovement) {
      if (!animalForm.transferDestinationEstablishmentId) {
        nextErrors.transferDestinationEstablishmentId = "Falta elegir el campo destino.";
      }

      if (!animalForm.transferDestinationFieldId) {
        nextErrors.transferDestinationFieldId = "Falta elegir el potrero destino.";
      } else if (
        isInternalTransferMovement &&
        animalForm.transferDestinationEstablishmentId === animalForm.establishmentId &&
        animalForm.transferDestinationFieldId === animalForm.fieldId
      ) {
        nextErrors.transferDestinationFieldId = "El potrero destino debe ser distinto del origen.";
      }

      if (!transferAvailableSpecies.includes(animalForm.species)) {
        nextErrors.species = "Esa especie no tiene stock disponible en el potrero origen.";
      }

      const availableCategory = transferOriginAvailability
        .get(animalForm.species)
        ?.find((item) => item.categoryCode === animalForm.categoryCode);

      if (!availableCategory) {
        nextErrors.categoryCode = "Esa categoria no tiene stock disponible en el potrero origen.";
      } else if (Number.isFinite(quantity) && quantity > availableCategory.quantity) {
        nextErrors.quantity = `Solo hay ${formatNumber(availableCategory.quantity, 0)} disponibles en el potrero origen.`;
      }
    }

    if (!animalForm.fieldId) {
      nextErrors.fieldId = "Falta elegir el potrero origen.";
    }

    if (commercialMovement) {
      if (!Number.isFinite(weightKg) || weightKg < 0) {
        nextErrors.weightKg = "Falta agregar peso.";
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        nextErrors.unitPrice = "Falta agregar precio.";
      }

      if (animalForm.kind === "purchase" && (!Number.isFinite(freightAmount) || freightAmount < 0)) {
        nextErrors.freightAmount = "Falta agregar flete.";
      }

      if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
        nextErrors.commissionAmount = "Falta agregar comision.";
      }

      if (!Number.isFinite(taxAmount) || taxAmount < 0) {
        nextErrors.taxAmount = "Falta agregar IVA.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setAnimalFormErrors(nextErrors);
      const firstErrorField = Object.keys(nextErrors)[0];
      showError(nextErrors[firstErrorField] ?? "Faltan datos obligatorios.");
      focusAnimalField(firstErrorField);
      return;
    }

    setAnimalFormErrors({});

    const existingMovement = editingAnimalMovementId
      ? animalMovements.find((movement) => movement.id === editingAnimalMovementId)
      : undefined;
    const nextMovementId = editingAnimalMovementId ?? `anm-${Date.now()}`;
    const nextPairedTransferMovementId =
      isTransferMovement || existingMovement?.pairedTransferMovementId
        ? existingMovement?.pairedTransferMovementId ?? `anm-${Date.now()}-pair`
        : undefined;
    const transferOutMovementId =
      isTransferMovement && existingMovement?.kind === "transfer_in" && existingMovement.pairedTransferMovementId
        ? existingMovement.pairedTransferMovementId
        : nextMovementId;
    const transferInMovementId =
      isTransferMovement && existingMovement?.kind === "transfer_in" && existingMovement.pairedTransferMovementId
        ? existingMovement.id
        : nextPairedTransferMovementId;
    const normalizedFreight = commercialMovement && Number.isFinite(freightAmount) ? freightAmount : 0;
    const normalizedCommission = commercialMovement && Number.isFinite(commissionAmount) ? commissionAmount : 0;
    const normalizedTax = commercialMovement && Number.isFinite(taxAmount) ? taxAmount : 0;
    const totalAmount = commercialMovement
      ? calculateAnimalTotal(quantity, unitPrice, normalizedCommission, normalizedTax, normalizedFreight)
      : undefined;

    if (animalForm.kind === "sale") {
      if (collectedAmount === undefined || !Number.isFinite(collectedAmount) || collectedAmount < 0) {
        nextErrors.collectedAmount = "Falta agregar un cobrado valido.";
      } else if (totalAmount !== undefined && collectedAmount > totalAmount) {
        nextErrors.collectedAmount = "El cobrado no puede ser mayor al total de la venta.";
      }
    }

    const entryType: AccountingEntryType = animalForm.kind === "sale" ? "income" : "expense";
    const accountingConcept =
      animalForm.kind === "sale" ? getIncomeConceptForSpecies(animalForm.species) : "compra_animales";
    const nextAccountingId = commercialMovement
      ? existingMovement?.linkedAccountingEntryId ?? `acc-${Date.now()}`
      : undefined;

    const movement: AnimalMovementRecord = {
      id: nextMovementId,
      date: animalForm.date,
      establishmentId: animalForm.establishmentId,
      fieldId: animalForm.fieldId,
      species: animalForm.species,
      categoryCode: animalForm.categoryCode,
      kind: animalForm.kind,
      quantity,
      earTag: isCattleDeathWithEarTag ? animalForm.earTag.trim() : undefined,
      weightKg: commercialMovement ? weightKg : undefined,
      unitPrice: commercialMovement ? unitPrice : undefined,
      freightAmount: animalForm.kind === "purchase" ? normalizedFreight : undefined,
      commissionAmount: commercialMovement ? normalizedCommission : undefined,
      taxAmount: commercialMovement ? normalizedTax : undefined,
      totalAmount,
      currency: commercialMovement ? animalForm.currency : undefined,
      linkedAccountingEntryId: nextAccountingId,
      pairedTransferMovementId: nextPairedTransferMovementId,
      notes: animalForm.notes.trim()
    };

    const nextMovements = isTransferMovement
      ? [
          {
            ...movement,
            id: transferOutMovementId,
            kind: "transfer_out" as AnimalMovementKind,
            pairedTransferMovementId: transferInMovementId
          },
          {
            ...movement,
            id: transferInMovementId!,
            establishmentId: animalForm.transferDestinationEstablishmentId,
            fieldId: animalForm.transferDestinationFieldId,
            kind: "transfer_in" as AnimalMovementKind,
            pairedTransferMovementId: transferOutMovementId
          }
        ]
      : [movement];

    setAnimalMovements((current) => {
      const idsToReplace = new Set(
        editingAnimalMovementId
          ? [editingAnimalMovementId, existingMovement?.pairedTransferMovementId].filter(Boolean) as string[]
          : []
      );
      const baseRows = idsToReplace.size > 0 ? current.filter((item) => !idsToReplace.has(item.id)) : current;
      return [...nextMovements, ...baseRows];
    });

    if (commercialMovement && nextAccountingId && totalAmount !== undefined) {
      const accountingEntry: AccountingEntry = {
        id: nextAccountingId,
        date: animalForm.date,
        establishmentId: animalForm.establishmentId,
        fieldId: animalForm.fieldId,
        type: entryType,
        concept: accountingConcept,
        currency: animalForm.currency,
        grossAmount: quantity * unitPrice,
        commissionAmount: normalizedCommission,
        taxAmount: normalizedTax,
        netAmount: totalAmount,
        expectedAmount: entryType === "income" ? totalAmount : undefined,
        collectedAmount: entryType === "income" ? collectedAmount ?? 0 : undefined,
        linkedAnimalMovementId: nextMovementId,
        notes: animalForm.notes.trim()
      };

      setAccountingEntries((current) => {
        const hasExisting = current.some((item) => item.id === nextAccountingId);
        if (hasExisting) {
          return current.map((item) => (item.id === nextAccountingId ? accountingEntry : item));
        }

        return [accountingEntry, ...current];
      });
    } else if (!commercialMovement && existingMovement?.linkedAccountingEntryId) {
      setAccountingEntries((current) => current.filter((item) => item.id !== existingMovement.linkedAccountingEntryId));
    }

    setSelectedEstablishmentId(animalForm.establishmentId);
    resetAnimalForm(true);
    showSuccess(editingAnimalMovementId ? "Movimiento de animales actualizado." : "Movimiento de animales guardado.");
  }

  function handleAccountingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const grossAmount = parseDecimalInput(accountingForm.grossAmount);
    const commissionAmount =
      accountingForm.commissionAmount.trim() === "" ? 0 : parseDecimalInput(accountingForm.commissionAmount);
    const taxAmount = accountingForm.taxAmount.trim() === "" ? 0 : parseDecimalInput(accountingForm.taxAmount);
    const netAmount = getNetAmount(accountingForm.type, grossAmount, commissionAmount, taxAmount);
    const collectedAmount =
      accountingForm.type === "income"
        ? accountingForm.collectedAmount.trim() === ""
          ? 0
          : parseDecimalInput(accountingForm.collectedAmount)
        : undefined;

    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      showError("El importe bruto debe ser mayor a 0.");
      return false;
    }

    if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
      showError("La comision debe ser un numero valido.");
      return false;
    }

    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      showError("Los impuestos deben ser un numero valido.");
      return false;
    }

    if (accountingForm.type === "income") {
      if (collectedAmount === undefined || !Number.isFinite(collectedAmount) || collectedAmount < 0) {
        showError("El importe cobrado debe ser un numero valido.");
        return false;
      }

      if (collectedAmount > netAmount) {
        showError("El cobrado no puede ser mayor al neto de la operacion.");
        return false;
      }
    }

    const existingEntry = editingAccountingEntryId
      ? accountingEntries.find((item) => item.id === editingAccountingEntryId)
      : undefined;
    const entry: AccountingEntry = {
      id: editingAccountingEntryId ?? `acc-${Date.now()}`,
      date: accountingForm.date,
      establishmentId: accountingForm.establishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, accountingForm.establishmentId),
      type: accountingForm.type,
      concept: accountingForm.concept,
      currency: accountingForm.currency,
      grossAmount,
      commissionAmount,
      taxAmount,
      netAmount,
      expectedAmount: accountingForm.type === "income" ? netAmount : undefined,
      collectedAmount,
      notes: accountingForm.notes.trim()
    };

    setAccountingEntries((current) =>
      editingAccountingEntryId
        ? current.map((item) => (item.id === editingAccountingEntryId ? entry : item))
        : [entry, ...current]
    );
    if (existingEntry?.linkedAnimalMovementId) {
      setAnimalMovements((current) =>
        current.map((movement) =>
          movement.id === existingEntry.linkedAnimalMovementId ? { ...movement, linkedAccountingEntryId: entry.id } : movement
        )
      );
    }
    setSelectedEstablishmentId(accountingForm.establishmentId);
    resetAccountingForm(true);
    showSuccess(editingAccountingEntryId ? "Movimiento contable actualizado." : "Movimiento contable guardado.");
    return true;
  }

  function handleRainfallSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const millimeters = parseDecimalInput(rainfallForm.millimeters);
    if (!Number.isFinite(millimeters) || millimeters < 0) {
      showError("La lluvia debe ser un numero valido.");
      return;
    }

    const rainfallEntry: RainfallRecord = {
      id: editingRainfallRecordId ?? `rain-${Date.now()}`,
      date: rainfallForm.date,
      fieldId: getFieldIdForEstablishmentFrom(fields, rainfallForm.establishmentId),
      millimeters,
      notes: rainfallForm.notes.trim()
    };

    setRainfallRecords((current) =>
      editingRainfallRecordId
        ? current.map((item) => (item.id === editingRainfallRecordId ? rainfallEntry : item))
        : [rainfallEntry, ...current]
    );
    resetRainfallForm(true);
    showSuccess(editingRainfallRecordId ? "Registro de lluvia actualizado." : "Registro de lluvia guardado.");
  }

  function handleSanitarySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = parseDecimalInput(sanitaryForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showError("La cantidad de animales debe ser mayor a 0.");
      return;
    }

    if (!sanitaryForm.treatment.trim()) {
      showError("Falta agregar el tratamiento sanitario.");
      return;
    }

    const sanitaryEntry: SanitaryRecord = {
      id: editingSanitaryRecordId ?? `san-${Date.now()}`,
      date: sanitaryForm.date,
      establishmentId: sanitaryForm.establishmentId,
      fieldId: sanitaryForm.fieldId,
      species: sanitaryForm.species,
      quantity,
      treatment: sanitaryForm.treatment.trim(),
      notes: sanitaryForm.notes.trim()
    };

    setSanitaryRecords((current) =>
      editingSanitaryRecordId
        ? current.map((item) => (item.id === editingSanitaryRecordId ? sanitaryEntry : item))
        : [sanitaryEntry, ...current]
    );
    setSelectedEstablishmentId(sanitaryForm.establishmentId);
    resetSanitaryForm(true);
    showSuccess(editingSanitaryRecordId ? "Tratamiento sanitario actualizado." : "Tratamiento sanitario guardado.");
  }

  function saveInitialStockLoad() {
    const quantity = parseDecimalInput(initialStockForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showError("La cantidad inicial debe ser mayor a 0.");
      return false;
    }

    const entry: AnimalMovementRecord = {
      id: `anm-${Date.now()}`,
      date: setupCutoffDate,
      establishmentId: setupEstablishmentId,
      fieldId: setupFieldId || getFieldIdForEstablishmentFrom(fields, setupEstablishmentId),
      species: setupSpecies,
      categoryCode: initialStockForm.categoryCode,
      kind: "adjustment",
      quantity,
      commissionAmount: 0,
      taxAmount: 0,
      notes: `Carga inicial: ${initialStockForm.notes.trim() || "stock base del establecimiento"}`
    };

    setAnimalMovements((current) => [entry, ...current]);
    setSelectedEstablishmentId(setupEstablishmentId);
    resetInitialStockForm(true);
    return true;
  }

  function handleInitialLoadSubmit() {
    const hasStockData = initialStockForm.quantity.trim() !== "" || initialStockForm.notes.trim() !== "";

    if (!hasStockData) {
      showError("No hay datos cargados para guardar en la carga inicial.");
      return;
    }

    const savedStock = saveInitialStockLoad();
    if (!savedStock) {
      return;
    }

    if (savedStock) {
      showSuccess("Stock inicial cargado.");
    }
  }

  function handleExchangeRateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const averageRate = parseDecimalInput(exchangeRateForm.averageRate);
    if (!exchangeRateForm.yearMonth) {
      showError("Falta elegir el mes del tipo de cambio.");
      return;
    }

    if (!Number.isFinite(averageRate) || averageRate <= 0) {
      showError("El tipo de cambio promedio debe ser mayor a 0.");
      return;
    }

    const nextRate: MonthlyExchangeRate = {
      id: editingExchangeRateId ?? `fx-${exchangeRateForm.yearMonth}`,
      yearMonth: exchangeRateForm.yearMonth,
      averageRate
    };

    setMonthlyExchangeRates((current) => {
      const filtered = current.filter((item) => item.id !== editingExchangeRateId && item.yearMonth !== nextRate.yearMonth);
      return [nextRate, ...filtered];
    });

    resetExchangeRateForm(true);
    showSuccess(editingExchangeRateId ? "Tipo de cambio actualizado." : "Tipo de cambio guardado.");
  }

  function handleEditAnimalMovement(movementId: string) {
    const movement = animalMovements.find((item) => item.id === movementId);
    if (!movement) {
      return;
    }

    const linkedEntry = movement.linkedAccountingEntryId
      ? accountingEntries.find((item) => item.id === movement.linkedAccountingEntryId)
      : undefined;

    setEditingAnimalMovementId(movementId);
    setSelectedEstablishmentId(movement.establishmentId);
    setAnimalForm({
      date: movement.date,
      establishmentId: movement.establishmentId,
      fieldId: movement.fieldId,
      transferDestinationEstablishmentId: "",
      transferDestinationFieldId: "",
      species: movement.species,
      categoryCode: movement.categoryCode,
      kind: movement.kind,
      quantity: `${movement.quantity}`,
      earTag: movement.earTag ?? "",
      weightKg: movement.weightKg !== undefined ? `${movement.weightKg}` : "",
      unitPrice: movement.unitPrice !== undefined ? `${movement.unitPrice}` : "",
      freightAmount: movement.freightAmount !== undefined ? `${movement.freightAmount}` : "",
      commissionAmount: movement.commissionAmount !== undefined ? `${movement.commissionAmount}` : "",
      taxAmount: movement.taxAmount !== undefined ? `${movement.taxAmount}` : "",
      collectedAmount: movement.kind === "sale" ? `${linkedEntry && linkedEntry.type === "income" ? getIncomeCollectedAmount(linkedEntry) : 0}` : "",
      currency: movement.currency ?? "USD",
      notes: movement.notes
    });
    if (isTransferMovementKind(movement.kind) && movement.pairedTransferMovementId) {
      const pairedMovement = animalMovements.find((item) => item.id === movement.pairedTransferMovementId);
      if (pairedMovement) {
        const sourceEstablishmentId = movement.kind === "transfer_out" ? movement.establishmentId : pairedMovement.establishmentId;
        const destinationEstablishmentId = movement.kind === "transfer_out" ? pairedMovement.establishmentId : movement.establishmentId;
        const isInternalTransfer = sourceEstablishmentId === destinationEstablishmentId;
        setAnimalForm((current) => ({
          ...current,
          kind: "transfer",
          establishmentId: sourceEstablishmentId,
          fieldId:
            movement.kind === "transfer_out"
              ? movement.fieldId
              : pairedMovement.fieldId,
          transferDestinationEstablishmentId: destinationEstablishmentId,
          transferDestinationFieldId: movement.kind === "transfer_out" ? pairedMovement.fieldId : movement.fieldId
        }));
      }
    }
    animalFormPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleEditAccountingEntry(entryId: string) {
    const entry = accountingEntries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    setEditingAccountingEntryId(entryId);
    setSelectedEstablishmentId(entry.establishmentId);
    setAccountingForm({
      date: entry.date,
      establishmentId: entry.establishmentId,
      fieldId: entry.fieldId,
      type: entry.type,
      concept: entry.concept,
      currency: entry.currency,
      grossAmount: `${entry.grossAmount}`,
      commissionAmount: `${entry.commissionAmount}`,
      taxAmount: `${entry.taxAmount}`,
      collectedAmount: entry.type === "income" ? `${getIncomeCollectedAmount(entry)}` : "",
      notes: entry.notes
    });
    accountingFormPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleEditRainfallRecord(recordId: string) {
    const record = rainfallRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    const field = fields.find((item) => item.id === record.fieldId);
    if (field) {
      setSelectedEstablishmentId(field.establishmentId);
    }
    setEditingRainfallRecordId(recordId);
    setRainfallForm({
      date: record.date,
      establishmentId: field?.establishmentId ?? establishments[0]?.id ?? "",
      fieldId: record.fieldId,
      millimeters: `${record.millimeters}`,
      notes: record.notes
    });
  }

  function handleEditSanitaryRecord(recordId: string) {
    const record = sanitaryRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    setSelectedEstablishmentId(record.establishmentId);
    setEditingSanitaryRecordId(recordId);
    setSanitaryForm({
      date: record.date,
      establishmentId: record.establishmentId,
      fieldId: record.fieldId,
      species: record.species,
      quantity: `${record.quantity}`,
      treatment: record.treatment,
      notes: record.notes
    });
  }

  function handleEditExchangeRate(rateId: string) {
    const rate = monthlyExchangeRates.find((item) => item.id === rateId);
    if (!rate) {
      return;
    }

    setEditingExchangeRateId(rateId);
    setExchangeRateForm({
      yearMonth: rate.yearMonth,
      averageRate: `${rate.averageRate}`
    });
  }

  function handleDeleteAnimalMovement(movementId: string) {
    const movement = animalMovements.find((item) => item.id === movementId);
    const idsToDelete = new Set([movementId, movement?.pairedTransferMovementId].filter(Boolean) as string[]);
    setAnimalMovements((current) => current.filter((item) => !idsToDelete.has(item.id)));
    if (editingAnimalMovementId === movementId || editingAnimalMovementId === movement?.pairedTransferMovementId) {
      resetAnimalForm();
    }

    if (movement?.linkedAccountingEntryId) {
      setAccountingEntries((current) => current.filter((item) => item.id !== movement.linkedAccountingEntryId));
    }

    showSuccess("Movimiento de animales eliminado.");
  }

  function handleDeleteAccountingEntry(entryId: string) {
    setAccountingEntries((current) => current.filter((item) => item.id !== entryId));
    if (editingAccountingEntryId === entryId) {
      resetAccountingForm();
    }
    setAnimalMovements((current) =>
      current.map((movement) =>
        movement.linkedAccountingEntryId === entryId ? { ...movement, linkedAccountingEntryId: undefined } : movement
      )
    );
    showSuccess("Movimiento contable eliminado.");
  }

  function handleDeleteRainfallRecord(recordId: string) {
    setRainfallRecords((current) => current.filter((item) => item.id !== recordId));
    if (editingRainfallRecordId === recordId) {
      resetRainfallForm();
    }
    showSuccess("Registro de lluvia eliminado.");
  }

  function handleDeleteSanitaryRecord(recordId: string) {
    setSanitaryRecords((current) => current.filter((item) => item.id !== recordId));
    if (editingSanitaryRecordId === recordId) {
      resetSanitaryForm();
    }
    showSuccess("Tratamiento sanitario eliminado.");
  }

  function handleDeleteExchangeRate(rateId: string) {
    setMonthlyExchangeRates((current) => current.filter((item) => item.id !== rateId));
    if (editingExchangeRateId === rateId) {
      resetExchangeRateForm();
    }
    showSuccess("Tipo de cambio eliminado.");
  }

  function requestDeleteAnimalMovement(movementId: string) {
    setPendingDelete({
      kind: "animal",
      id: movementId,
      title: "Eliminar movimiento de animales",
      message: "Este movimiento se va a borrar de la planilla. Si tenia relacion contable, tambien se elimina esa relacion."
    });
  }

  function requestDeleteAccountingEntry(entryId: string) {
    setPendingDelete({
      kind: "accounting",
      id: entryId,
      title: "Eliminar movimiento contable",
      message: "Este movimiento se va a borrar de la planilla contable y cualquier vinculo con animales quedara desarmado."
    });
  }

  function requestDeleteRainfallRecord(recordId: string) {
    setPendingDelete({
      kind: "rainfall",
      id: recordId,
      title: "Eliminar registro de lluvia",
      message: "Este registro se va a borrar del historial de lluvias del establecimiento."
    });
  }

  function requestDeleteSanitaryRecord(recordId: string) {
    setPendingDelete({
      kind: "sanitary",
      id: recordId,
      title: "Eliminar tratamiento sanitario",
      message: "Este tratamiento se va a borrar de la planilla sanitaria del establecimiento."
    });
  }

  function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.kind === "animal") {
      handleDeleteAnimalMovement(pendingDelete.id);
    } else if (pendingDelete.kind === "accounting") {
      handleDeleteAccountingEntry(pendingDelete.id);
    } else if (pendingDelete.kind === "sanitary") {
      handleDeleteSanitaryRecord(pendingDelete.id);
    } else {
      handleDeleteRainfallRecord(pendingDelete.id);
    }

    setPendingDelete(null);
  }

  const projectedNet = getNetAmount(
    accountingForm.type,
    parseDecimalInput(accountingForm.grossAmount) || 0,
    parseDecimalInput(accountingForm.commissionAmount) || 0,
    parseDecimalInput(accountingForm.taxAmount) || 0
  );

  const projectedAnimalTotal = calculateAnimalTotal(
    parseDecimalInput(animalForm.quantity) || 0,
    parseDecimalInput(animalForm.unitPrice) || 0,
    parseDecimalInput(animalForm.commissionAmount) || 0,
    parseDecimalInput(animalForm.taxAmount) || 0,
    animalForm.kind === "purchase" ? parseDecimalInput(animalForm.freightAmount) || 0 : 0
  );

  return (
    <main className="app-shell">
      <ProductShell
        title="Agro"
        subtitle="Control del establecimiento"
        badge=""
        navItems={agroWorkspaceSections}
        activeKey={activeView}
        onSelect={(key) => setActiveView(key as AgroView)}
        onTitleClick={() => setActiveView(null)}
        onSignOut={onSignOut}
      >
        <AgroToolbar
          availableYears={availableYears}
          establishments={establishments}
          visibleFields={establishmentFields}
          selectedEstablishmentId={selectedEstablishmentId}
          selectedVisibleFieldId={selectedVisibleFieldId}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onEstablishmentChange={setSelectedEstablishmentId}
          onVisibleFieldChange={setSelectedVisibleFieldId}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />

        <AgroMetricsGrid
          accountingTotals={accountingTotals}
          stockBySpecies={stockBySpecies}
          stockBreakdownBySpecies={stockBreakdownBySpecies}
        />

        {activeView === "overview" ? (
          <AgroOverviewSection
            establishmentSummary={establishmentSummary}
            latestAccountingEntries={latestAccountingEntries}
            latestAnimalMovements={latestAnimalMovements}
          />
        ) : null}

        {activeView === "setup" ? (
          <AgroSetupSection
            establishments={establishments}
            setupFields={setupFieldRows}
            setupEstablishmentId={setupEstablishmentId}
            setupFieldId={setupFieldId}
            setupSpecies={setupSpecies}
            newEstablishmentForm={newEstablishmentForm}
            newFieldForm={newFieldForm}
            initialStockForm={initialStockForm}
            newEstablishmentErrors={newEstablishmentErrors}
            newFieldErrors={newFieldErrors}
            setupSummary={setupSummary}
            setSetupEstablishmentId={setSetupEstablishmentId}
            setSetupFieldId={setSetupFieldId}
            setSetupSpecies={setSetupSpecies}
            clearNewEstablishmentError={clearNewEstablishmentError}
            clearNewFieldError={clearNewFieldError}
            setNewEstablishmentForm={setNewEstablishmentForm}
            setNewFieldForm={setNewFieldForm}
            setInitialStockForm={setInitialStockForm}
            resetInitialStockForm={resetInitialStockForm}
            onAddEstablishment={handleAddEstablishment}
            onAddField={handleAddField}
            onDeleteField={handleDeleteField}
            onSubmitInitialLoad={handleInitialLoadSubmit}
          />
        ) : null}

        {activeView === "animals" ? (
          <AgroAnimalsSection
            establishments={establishments}
            fields={fields}
            animalFieldRefs={animalFieldRefs}
            animalForm={animalForm}
            animalFormErrors={animalFormErrors}
            animalFormPanelRef={animalFormPanelRef}
            animalMovements={animalMovements}
            animalLedgerRows={animalLedgerRows}
            animalLedgerSummary={animalLedgerSummary}
            animalSearchTerm={animalSearchTerm}
            animalTableRef={animalTableRef}
            animalTableScrollbarInnerRef={animalTableScrollbarInnerRef}
            animalTableScrollbarRef={animalTableScrollbarRef}
            animalTableWrapRef={animalTableWrapRef}
            clearAnimalFieldError={clearAnimalFieldError}
            editingAnimalMovementId={editingAnimalMovementId}
            handleAnimalKindChange={handleAnimalKindChange}
            handleAnimalSubmit={handleAnimalSubmit}
            isBirthOrDeathAnimalMovement={isBirthOrDeathAnimalMovement}
            isCattleDeathWithEarTag={isCattleDeathWithEarTag}
            isCommercialAnimalMovement={isCommercialAnimalMovement}
            isAdjustmentAnimalMovement={isAdjustmentAnimalMovement}
            projectedAnimalTotal={projectedAnimalTotal}
            transferAvailableSpecies={transferAvailableSpecies}
            transferAvailableCategories={transferAvailableCategories}
            transferAvailableQuantity={transferAvailableQuantity}
            registerAnimalFieldRef={registerAnimalFieldRef}
            requestDeleteAnimalMovement={requestDeleteAnimalMovement}
            resetAnimalForm={resetAnimalForm}
            setAnimalForm={setAnimalForm}
            setAnimalSearchTerm={setAnimalSearchTerm}
            showAnimalFloatingScrollbar={showAnimalFloatingScrollbar}
            onEditMovement={handleEditAnimalMovement}
          />
        ) : null}

        {activeView === "accounting" ? (
          <AgroAccountingSection
            establishments={establishments}
            fields={fields}
            visibleMonthLabel={visibleMonthRange.label}
            accountingStatusFilter={accountingStatusFilter}
            accountingFormPanelRef={accountingFormPanelRef}
            accountingForm={accountingForm}
            exchangeRateForm={exchangeRateForm}
            accountingLedgerRows={visibleAccountingLedgerWithConversions}
            accountingLedgerWithConversions={visibleAccountingLedgerWithConversions}
            accountingSearchTerm={accountingSearchTerm}
            editingAccountingEntryId={editingAccountingEntryId}
            monthlyExchangeRates={visibleExchangeRates}
            projectedNet={projectedNet}
            accountingCollectionSummary={accountingCollectionSummary}
            requestDeleteAccountingEntry={requestDeleteAccountingEntry}
            resetExchangeRateForm={resetExchangeRateForm}
            resetAccountingForm={resetAccountingForm}
            setExchangeRateForm={setExchangeRateForm}
            setAccountingForm={setAccountingForm}
            setAccountingStatusFilter={setAccountingStatusFilter}
            setAccountingSearchTerm={setAccountingSearchTerm}
            onEditEntry={handleEditAccountingEntry}
            onEditExchangeRate={handleEditExchangeRate}
            onDeleteExchangeRate={handleDeleteExchangeRate}
            onSubmit={handleAccountingSubmit}
            onSubmitExchangeRate={handleExchangeRateSubmit}
          />
        ) : null}

        {activeView === "rainfall" ? (
          <AgroRainfallSection
            establishments={establishments}
            fields={fields}
            editingRainfallRecordId={editingRainfallRecordId}
            rainfallForm={rainfallForm}
            rainfallRows={rainfallRows}
            rainfallSearchTerm={rainfallSearchTerm}
            resetRainfallForm={resetRainfallForm}
            requestDeleteRainfallRecord={requestDeleteRainfallRecord}
            setRainfallForm={setRainfallForm}
            setRainfallSearchTerm={setRainfallSearchTerm}
            onEditRainfallRecord={handleEditRainfallRecord}
            onSubmit={handleRainfallSubmit}
          />
        ) : null}

        {activeView === "sanity" ? (
          <AgroSanitySection
            establishments={establishments}
            fields={fields}
            editingSanitaryRecordId={editingSanitaryRecordId}
            sanitaryForm={sanitaryForm}
            sanitaryRows={sanitaryRows}
            sanitarySearchTerm={sanitarySearchTerm}
            resetSanitaryForm={resetSanitaryForm}
            requestDeleteSanitaryRecord={requestDeleteSanitaryRecord}
            setSanitaryForm={setSanitaryForm}
            setSanitarySearchTerm={setSanitarySearchTerm}
            onEditSanitaryRecord={handleEditSanitaryRecord}
            onSubmit={handleSanitarySubmit}
          />
        ) : null}

        {activeView === "summary" ? (
          <section className="content-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Planilla del mes</h2>
                  <p>Movimientos visibles de {visibleMonthRange.label}.</p>
                </div>
              </div>
              <div className="list-stack">
                <div className="list-row">
                  <span>Entradas animales</span>
                  <strong>{periodSummary.entries}</strong>
                </div>
                <div className="list-row">
                  <span>Salidas animales</span>
                  <strong>{periodSummary.exits}</strong>
                </div>
                <div className="list-row">
                  <span>Ingresos cobrados</span>
                  <strong>{formatMoney(periodSummary.incomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Valor pendiente de cobro</span>
                  <strong>{formatMoney(periodSummary.pendingIncomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado USD</span>
                  <strong>{formatMoney(periodSummary.livestockPurchaseExpenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado UYU</span>
                  <strong>{formatMoney(periodSummary.livestockPurchaseExpenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado UYU a USD</span>
                  <strong>{formatMoney(periodSummary.livestockPurchaseExpenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado total USD eq.</span>
                  <strong>{formatMoney(periodSummary.totalLivestockPurchaseExpenseUsdEquivalent, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos USD</span>
                  <strong>{formatMoney(periodSummary.operationalExpenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos UYU</span>
                  <strong>{formatMoney(periodSummary.operationalExpenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos UYU a USD</span>
                  <strong>{formatMoney(periodSummary.operationalExpenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos total USD eq.</span>
                  <strong>{formatMoney(periodSummary.totalOperationalExpenseUsdEquivalent, "USD")}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Acumulado del ejercicio</h2>
                  <p>{accumulatedFiscalRange.label}</p>
                </div>
              </div>
              <div className="list-stack">
                <div className="list-row">
                  <span>Entradas animales</span>
                  <strong>{accumulatedSummary.entries}</strong>
                </div>
                <div className="list-row">
                  <span>Salidas animales</span>
                  <strong>{accumulatedSummary.exits}</strong>
                </div>
                <div className="list-row">
                  <span>Ingresos cobrados</span>
                  <strong>{formatMoney(accumulatedSummary.incomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Valor pendiente de cobro</span>
                  <strong>{formatMoney(accumulatedSummary.pendingIncomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado USD</span>
                  <strong>{formatMoney(accumulatedSummary.livestockPurchaseExpenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado UYU</span>
                  <strong>{formatMoney(accumulatedSummary.livestockPurchaseExpenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado UYU a USD</span>
                  <strong>{formatMoney(accumulatedSummary.livestockPurchaseExpenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado total USD eq.</span>
                  <strong>{formatMoney(accumulatedSummary.totalLivestockPurchaseExpenseUsdEquivalent, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos USD</span>
                  <strong>{formatMoney(accumulatedSummary.operationalExpenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos UYU</span>
                  <strong>{formatMoney(accumulatedSummary.operationalExpenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos UYU a USD</span>
                  <strong>{formatMoney(accumulatedSummary.operationalExpenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos total USD eq.</span>
                  <strong>{formatMoney(accumulatedSummary.totalOperationalExpenseUsdEquivalent, "USD")}</strong>
                </div>
              </div>
            </article>

            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Planilla de carga inicial</h2>
                  <p>Base cargada del campo o potrero visible hasta {visibleMonthRange.label}.</p>
                </div>
              </div>
              <div className="inline-metrics">
                <span className="data-badge accent">Registros de carga inicial {initialLoadRows.length}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Campo</th>
                      <th>Potrero</th>
                      <th>Especie</th>
                      <th>Categoria</th>
                      <th>Cantidad</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialLoadRows.length > 0 ? (
                      initialLoadRows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatShortDate(row.date)}</td>
                          <td>{row.establishmentName}</td>
                          <td>{row.fieldName}</td>
                          <td>{row.speciesLabel}</td>
                          <td>{row.categoryLabel}</td>
                          <td>{row.quantity}</td>
                          <td>{row.notes}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>Todavia no hay carga inicial guardada para el campo o potrero visible.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Resumen global</h2>
                  <p>Sumatoria del mes visible: {visibleMonthRange.label}.</p>
                </div>
              </div>
              <div className="list-stack">
                <div className="list-row">
                  <span>Establecimientos</span>
                  <strong>{globalPeriodSummary.establishmentCount}</strong>
                </div>
                <div className="list-row">
                  <span>Campos</span>
                  <strong>{globalPeriodSummary.fieldCount}</strong>
                </div>
                <div className="list-row">
                  <span>Total vacunos</span>
                  <strong>{globalStockBySpecies.vacunos}</strong>
                </div>
                <div className="list-row">
                  <span>Total ovinos</span>
                  <strong>{globalStockBySpecies.ovinos}</strong>
                </div>
                <div className="list-row">
                  <span>Total equinos</span>
                  <strong>{globalStockBySpecies.equinos}</strong>
                </div>
                <div className="list-row">
                  <span>Entradas animales</span>
                  <strong>{globalPeriodSummary.entries}</strong>
                </div>
                <div className="list-row">
                  <span>Salidas animales</span>
                  <strong>{globalPeriodSummary.exits}</strong>
                </div>
                <div className="list-row">
                  <span>Ingresos cobrados</span>
                  <strong>{formatMoney(globalPeriodSummary.incomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Valor pendiente de cobro</span>
                  <strong>{formatMoney(globalPeriodSummary.pendingIncomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado USD</span>
                  <strong>{formatMoney(globalPeriodSummary.livestockPurchaseExpenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado UYU</span>
                  <strong>{formatMoney(globalPeriodSummary.livestockPurchaseExpenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado UYU a USD</span>
                  <strong>{formatMoney(globalPeriodSummary.livestockPurchaseExpenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Compra ganado total USD eq.</span>
                  <strong>{formatMoney(globalPeriodSummary.totalLivestockPurchaseExpenseUsdEquivalent, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos USD</span>
                  <strong>{formatMoney(globalPeriodSummary.operationalExpenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos UYU</span>
                  <strong>{formatMoney(globalPeriodSummary.operationalExpenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos UYU a USD</span>
                  <strong>{formatMoney(globalPeriodSummary.operationalExpenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Gastos operativos total USD eq.</span>
                  <strong>{formatMoney(globalPeriodSummary.totalOperationalExpenseUsdEquivalent, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Lluvia acumulada</span>
                  <strong>{globalPeriodSummary.rainfallTotal} mm</strong>
                </div>
              </div>
            </article>

            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Resumen por establecimiento</h2>
                  <p>Lectura corta de animales, caja y lluvia solo para {visibleMonthRange.label}.</p>
                </div>
              </div>
              <div className="report-stack">
                {summaryByField.map((item) => (
                  <article key={item.field.id} className="report-row-card">
                    <div className="report-row-head">
                      <strong>{item.field.name}</strong>
                      <span>{formatNumber(item.field.hectares)} ha</span>
                    </div>
                    <div className="list-stack">
                      <div className="list-row">
                        <span>Hectareas</span>
                        <strong>{formatNumber(item.field.hectares)} ha</strong>
                      </div>
                      <div className="list-row">
                        <span>Vacunos</span>
                        <strong>{item.speciesTotals.vacunos}</strong>
                      </div>
                      <div className="list-row">
                        <span>Ovinos</span>
                        <strong>{item.speciesTotals.ovinos}</strong>
                      </div>
                      <div className="list-row">
                        <span>Equinos</span>
                        <strong>{item.speciesTotals.equinos}</strong>
                      </div>
                      <div className="list-row">
                        <span>Compras</span>
                        <strong>{item.purchases}</strong>
                      </div>
                      <div className="list-row">
                        <span>Ventas</span>
                        <strong>{item.sales}</strong>
                      </div>
                      <div className="list-row">
                        <span>Traslados ingreso</span>
                        <strong>{item.transfersIn}</strong>
                      </div>
                      <div className="list-row">
                        <span>Traslados egreso</span>
                        <strong>{item.transfersOut}</strong>
                      </div>
                      <div className="list-row">
                        <span>Faltantes</span>
                        <strong>{item.shortages}</strong>
                      </div>
                      <div className="list-row">
                        <span>Lluvia acumulada</span>
                        <strong>{formatNumber(item.rainfallTotal)} mm</strong>
                      </div>
                      <div className="list-row">
                        <span>Ingresos cobrados</span>
                        <strong>{formatMoney(item.incomeUsd, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Valor pendiente de cobro</span>
                        <strong>{formatMoney(item.pendingIncomeUsd, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Compra ganado USD</span>
                        <strong>{formatMoney(item.livestockPurchaseExpenseUsd, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Compra ganado UYU</span>
                        <strong>{formatMoney(item.livestockPurchaseExpenseUyu, "UYU")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Compra ganado UYU a USD</span>
                        <strong>{formatMoney(item.livestockPurchaseExpenseUyuDollarized, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Compra ganado total USD eq.</span>
                        <strong>{formatMoney(item.totalLivestockPurchaseExpenseUsdEquivalent, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Gastos operativos USD</span>
                        <strong>{formatMoney(item.operationalExpenseUsd, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Gastos operativos UYU</span>
                        <strong>{formatMoney(item.operationalExpenseUyu, "UYU")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Gastos operativos UYU a USD</span>
                        <strong>{formatMoney(item.operationalExpenseUyuDollarized, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Gastos operativos total USD eq.</span>
                        <strong>{formatMoney(item.totalOperationalExpenseUsdEquivalent, "USD")}</strong>
                      </div>
                    </div>
                    <div className="inline-metrics">
                      {item.adjustments > 0 ? (
                        <span className="data-badge warning">Ajustes pendientes de revisar: {item.adjustments}</span>
                      ) : null}
                      {item.deaths > 0 ? (
                        <span className="data-badge warning">Muertes registradas: {item.deaths}</span>
                      ) : null}
                      {item.shortages > 0 ? (
                        <span className="data-badge warning">Faltantes registrados: {item.shortages}</span>
                      ) : null}
                      {item.transfersIn > 0 || item.transfersOut > 0 ? (
                        <span className="data-badge compact">Traslados {item.transfersIn} / {item.transfersOut}</span>
                      ) : null}
                      {item.lastRainfallDate ? (
                        <span className="data-badge compact">Ultima lluvia {item.lastRainfallDate}</span>
                      ) : (
                        <span className="data-badge warning">Sin lluvia cargada</span>
                      )}
                      {item.stockRows.length === 0 ? (
                        <span className="data-badge warning">Sin existencias visibles</span>
                      ) : null}
                    </div>
                    {item.specialMovementRows.length > 0 ? (
                      <div className="report-note-list">
                        {item.specialMovementRows.map((movement) => (
                          <div key={movement.id} className="report-note-row">
                            <strong>
                              {formatShortDate(movement.date)} | {movement.kind === "shortage" ? "Faltante" : "Traslado"} x{" "}
                              {movement.quantity} | {movement.categoryLabel}
                            </strong>
                            <span>{movement.detail ?? "-"}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </article>

            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Estado de cuenta</h2>
                  <p>Lectura de lo que esta pendiente, parcial o ya cobrado solo para el campo o potrero visible en {visibleMonthRange.label}.</p>
                </div>
              </div>
              <div className="inline-metrics">
                <span className="data-badge warning">Pendientes {accountStatementSummary.pending}</span>
                <span className="data-badge">Parciales {accountStatementSummary.partial}</span>
                <span className="data-badge accent">Cobradas {accountStatementSummary.collected}</span>
                <span className="data-badge warning">
                  Valor a cobrar {formatMoney(accountStatementSummary.pendingValue, "USD")}
                </span>
              </div>
              <label className="table-search">
                <span>Estado comercial</span>
                <select
                  value={linkedOperationsStatusFilter}
                  onChange={(event) =>
                    setLinkedOperationsStatusFilter(event.target.value as "all" | "pending" | "partial" | "collected")
                  }
                >
                  <option value="all">Todas</option>
                  <option value="pending">Pendientes</option>
                  <option value="partial">Parciales</option>
                  <option value="collected">Cobradas</option>
                </select>
              </label>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Campo</th>
                      <th>Concepto</th>
                      <th>Total</th>
                      <th>Cobrado</th>
                      <th>Pendiente</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAccountStatementRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatShortDate(row.date)}</td>
                        <td>{row.fieldName}</td>
                        <td>{row.conceptLabel}</td>
                        <td>{formatMoney(row.totalAmount, row.currency)}</td>
                        <td>{formatMoney(row.collectedAmount, row.currency)}</td>
                        <td>{formatMoney(row.pendingAmount, row.currency)}</td>
                        <td>
                          <span
                            className={
                              row.collectionStatus === "Cobrado"
                                ? "data-badge accent compact"
                                : row.collectionStatus === "Parcial"
                                  ? "data-badge compact"
                                : "data-badge warning compact"
                            }
                          >
                            {row.collectionStatus}
                          </span>
                        </td>
                        <td>{row.originLabel}</td>
                        <td>{row.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Control fino por categoria</h2>
                  <p>Lectura para revisar existencias por potrero, especie y categoria dentro del periodo elegido.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Potrero</th>
                      <th>Especie</th>
                      <th>Categoria</th>
                      <th>Total actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryControlRows.map((row) => (
                      <tr key={`${row.fieldName}-${row.speciesLabel}-${row.categoryLabel}`}>
                        <td>{row.fieldName}</td>
                        <td>{row.speciesLabel}</td>
                        <td>{row.categoryLabel}</td>
                        <td>{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : null}

        <AgroDeleteConfirmModal
          pendingDelete={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      </ProductShell>
    </main>
  );
}
