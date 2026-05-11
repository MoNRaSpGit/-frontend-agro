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
import { fetchAgroWorkspace, saveAgroWorkspace } from "./agro.client";
import { calculateAnimalTotal, deriveMovementDirection, getIncomeConceptForSpecies, requiresEarTag } from "./agro.domain";
import {
  expenseConceptLabels,
  formatMoney,
  formatShortDate,
  getNetAmount,
  getTodayDate,
  getYearMonth,
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

function normalizeAnimalMovementRecord(movement: AnimalMovementRecord): AnimalMovementRecord {
  const establishmentId = movement.establishmentId || getLegacyEstablishmentIdFromFieldId(movement.fieldId);
  const fieldId = initialFields.find((field) => field.establishmentId === establishmentId)?.id ?? movement.fieldId;

  return {
    ...movement,
    establishmentId,
    fieldId
  };
}

function normalizeAccountingEntry(entry: AccountingEntry): AccountingEntry {
  const establishmentId = entry.establishmentId || getLegacyEstablishmentIdFromFieldId(entry.fieldId);
  const fieldId = initialFields.find((field) => field.establishmentId === establishmentId)?.id ?? entry.fieldId;
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

function normalizeRainfallRecord(record: RainfallRecord): RainfallRecord {
  const establishmentId = getLegacyEstablishmentIdFromFieldId(record.fieldId);
  const fieldId = initialFields.find((field) => field.establishmentId === establishmentId)?.id ?? record.fieldId;

  return {
    ...record,
    fieldId
  };
}

function normalizeSanitaryRecord(record: SanitaryRecord): SanitaryRecord {
  const establishmentId = record.establishmentId || getLegacyEstablishmentIdFromFieldId(record.fieldId);
  const fieldId = initialFields.find((field) => field.establishmentId === establishmentId)?.id ?? record.fieldId;

  return {
    ...record,
    establishmentId,
    fieldId
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

function isDateWithinStockCutoff(date: string, selectedYear: string, selectedMonth: string) {
  if (selectedYear === "all") {
    return true;
  }

  const yearMonth = date.slice(0, 7);

  if (selectedMonth === "all") {
    return date.slice(0, 4) <= selectedYear;
  }

  return yearMonth <= `${selectedYear}-${selectedMonth}`;
}

function getFieldIdForEstablishmentFrom(fields: FieldUnit[], establishmentId: string) {
  return fields.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

export function AgroHomePage() {
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
  const [establishments, setEstablishments] = useState<Establishment[]>(initialEstablishments);
  const [fields, setFields] = useState<FieldUnit[]>(initialFields);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState(initialEstablishments[0]?.id ?? "");
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [selectedMonth, setSelectedMonth] = useState("all");
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
    establishmentId: initialEstablishments[0]?.id ?? "",
    fieldId: getFieldIdForEstablishmentFrom(initialFields, initialEstablishments[0]?.id ?? ""),
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
    establishmentId: initialEstablishments[0]?.id ?? "",
    fieldId: getFieldIdForEstablishmentFrom(initialFields, initialEstablishments[0]?.id ?? ""),
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
    establishmentId: initialEstablishments[0]?.id ?? "",
    fieldId: getFieldIdForEstablishmentFrom(initialFields, initialEstablishments[0]?.id ?? ""),
    millimeters: "",
    notes: ""
  });
  const [sanitaryForm, setSanitaryForm] = useState({
    date: today,
    establishmentId: initialEstablishments[0]?.id ?? "",
    fieldId: getFieldIdForEstablishmentFrom(initialFields, initialEstablishments[0]?.id ?? ""),
    quantity: "",
    treatment: "",
    notes: ""
  });
  const [editingExchangeRateId, setEditingExchangeRateId] = useState<string | null>(null);
  const [exchangeRateForm, setExchangeRateForm] = useState({
    yearMonth: getYearMonth(today),
    averageRate: ""
  });
  const [setupCutoffDate, setSetupCutoffDate] = useState(today);
  const [setupEstablishmentId, setSetupEstablishmentId] = useState(initialEstablishments[0]?.id ?? "");
  const [setupSpecies, setSetupSpecies] = useState<AgroSpecies>("vacunos");
  const [newEstablishmentForm, setNewEstablishmentForm] = useState({
    name: ""
  });
  const [initialStockForm, setInitialStockForm] = useState({
    categoryCode: categoryCatalog.vacunos[0]?.code ?? "",
    quantity: "",
    notes: ""
  });
  const [initialReceivableForm, setInitialReceivableForm] = useState({
    totalAmount: "",
    collectedAmount: "",
    notes: ""
  });

  function resetAnimalForm() {
    setAnimalForm({
      date: today,
      establishmentId: establishments[0]?.id ?? "",
      fieldId: getFieldIdForEstablishmentFrom(fields, establishments[0]?.id ?? ""),
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
          collectedAmount: ""
        };
      }

      if (kind === "sale") {
        return {
          ...current,
          kind,
          earTag: "",
          freightAmount: "",
          collectedAmount: current.collectedAmount || "0"
        };
      }

      return {
        ...current,
        kind,
        earTag: kind === "death" && current.species === "vacunos" ? current.earTag : "",
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

  function resetAccountingForm() {
    setAccountingForm({
      date: today,
      establishmentId: establishments[0]?.id ?? "",
      fieldId: getFieldIdForEstablishmentFrom(fields, establishments[0]?.id ?? ""),
      type: "income" as AccountingEntryType,
      concept: "venta_vacunos" as IncomeConcept | ExpenseConcept,
      currency: "USD" as MoneyCurrency,
      grossAmount: "",
      commissionAmount: "",
      taxAmount: "",
      collectedAmount: "",
      notes: ""
    });
    setEditingAccountingEntryId(null);
  }

  function resetRainfallForm() {
    setRainfallForm({
      date: today,
      establishmentId: establishments[0]?.id ?? "",
      fieldId: getFieldIdForEstablishmentFrom(fields, establishments[0]?.id ?? ""),
      millimeters: "",
      notes: ""
    });
    setEditingRainfallRecordId(null);
  }

  function resetSanitaryForm() {
    setSanitaryForm({
      date: today,
      establishmentId: establishments[0]?.id ?? "",
      fieldId: getFieldIdForEstablishmentFrom(fields, establishments[0]?.id ?? ""),
      quantity: "",
      treatment: "",
      notes: ""
    });
    setEditingSanitaryRecordId(null);
  }

  function resetExchangeRateForm() {
    setExchangeRateForm({
      yearMonth: getYearMonth(today),
      averageRate: ""
    });
    setEditingExchangeRateId(null);
  }

  function resetInitialStockForm() {
    setInitialStockForm({
      categoryCode: categoryCatalog[setupSpecies][0]?.code ?? "",
      quantity: "",
      notes: ""
    });
  }

  function resetInitialReceivableForm() {
    setInitialReceivableForm({
      totalAmount: "",
      collectedAmount: "",
      notes: ""
    });
  }

  function resetNewEstablishmentForm() {
    setNewEstablishmentForm({
      name: ""
    });
  }

  const visibleFields = useMemo(
    () => fields.filter((field) => field.establishmentId === selectedEstablishmentId),
    [fields, selectedEstablishmentId]
  );

  useEffect(() => {
    const fallbackEstablishmentId = establishments[0]?.id ?? "";

    if (selectedEstablishmentId && establishments.some((item) => item.id === selectedEstablishmentId)) {
      return;
    }

    setSelectedEstablishmentId(fallbackEstablishmentId);
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

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    animalMovements.forEach((movement) => years.add(movement.date.slice(0, 4)));
    accountingEntries.forEach((entry) => years.add(entry.date.slice(0, 4)));
    rainfallRecords.forEach((record) => years.add(record.date.slice(0, 4)));
    years.add(today.slice(0, 4));
    return [...years].sort((left, right) => right.localeCompare(left));
  }, [accountingEntries, animalMovements, rainfallRecords, today]);

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
      if (!isDateWithinStockCutoff(movement.date, selectedYear, selectedMonth)) {
        continue;
      }

      const key = `${movement.fieldId}:${movement.species}:${movement.categoryCode}`;
      const signedQuantity = getMovementDirection(movement) === "entry" ? movement.quantity : movement.quantity * -1;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + signedQuantity);
    }

    return balanceMap;
  }, [animalMovements, selectedMonth, selectedYear]);

  const stockBySpecies = useMemo(() => {
    const speciesTotals: Record<AgroSpecies, number> = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0
    };

    for (const [key, quantity] of stockBalanceMap.entries()) {
      const [, species] = key.split(":") as [string, AgroSpecies, string];
      speciesTotals[species] += quantity;
    }

    return speciesTotals;
  }, [stockBalanceMap]);

  const accountingTotals = useMemo(() => {
    return accountingEntries.reduce(
      (summary, entry) => {
        const bucket = entry.type === "income" ? "income" : "expense";
        summary[entry.currency][bucket] += entry.netAmount;
        return summary;
      },
      {
        USD: { income: 0, expense: 0 },
        UYU: { income: 0, expense: 0 }
      }
    );
  }, [accountingEntries]);

  const exchangeRateByMonth = useMemo(() => {
    return monthlyExchangeRates.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.yearMonth] = item.averageRate;
      return accumulator;
    }, {});
  }, [monthlyExchangeRates]);

  const latestAnimalMovements = useMemo(() => {
    return [...animalMovements].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  }, [animalMovements]);

  const latestAccountingEntries = useMemo(() => {
    return [...accountingEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  }, [accountingEntries]);

  const animalLedgerRows = useMemo(() => {
    return [...animalMovements]
      .filter((movement) => {
        if (movement.establishmentId !== selectedEstablishmentId) {
          return false;
        }

        if (!animalSearchTerm.trim()) {
          return true;
        }

        const field = fields.find((item) => item.id === movement.fieldId);
        const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
        const searchBase = [
          movement.date,
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
  }, [animalMovements, animalSearchTerm, fields, selectedEstablishmentId]);

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
        if (entry.establishmentId !== selectedEstablishmentId) {
          return false;
        }

        if (!accountingSearchTerm.trim()) {
          return true;
        }

        const field = fields.find((item) => item.id === entry.fieldId);
        const conceptLabel =
          entry.type === "income"
            ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
            : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels];
        const searchBase = [entry.date, field?.name ?? "", conceptLabel, entry.currency, entry.notes]
          .join(" ")
          .toLowerCase();

        return searchBase.includes(accountingSearchTerm.trim().toLowerCase());
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [accountingEntries, accountingSearchTerm, fields, selectedEstablishmentId]);

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

  const selectedFieldIds = useMemo(
    () => fields.filter((field) => field.establishmentId === selectedEstablishmentId).map((field) => field.id),
    [fields, selectedEstablishmentId]
  );

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
            categoryLabel: category?.label ?? categoryCode,
            quantity
          };
        })
        .filter((row) => row.quantity !== 0);

      const movementRows = animalMovements.filter((movement) => {
        if (movement.fieldId !== field.id) {
          return false;
        }

        if (selectedYear !== "all" && !movement.date.startsWith(selectedYear)) {
          return false;
        }

        if (selectedMonth !== "all" && movement.date.slice(5, 7) !== selectedMonth) {
          return false;
        }

        return true;
      });
      const accountingRows = accountingEntries.filter((entry) => {
        if (entry.fieldId !== field.id) {
          return false;
        }

        if (selectedYear !== "all" && !entry.date.startsWith(selectedYear)) {
          return false;
        }

        if (selectedMonth !== "all" && entry.date.slice(5, 7) !== selectedMonth) {
          return false;
        }

        return true;
      });
      const rainfallTotal = rainfallRecords
        .filter((record) => {
          if (record.fieldId !== field.id) {
            return false;
          }

          if (selectedYear !== "all" && !record.date.startsWith(selectedYear)) {
            return false;
          }

          if (selectedMonth !== "all" && record.date.slice(5, 7) !== selectedMonth) {
            return false;
          }

          return true;
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

      return {
        field,
        stockRows,
        speciesTotals,
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
        expenseUsd: accountingRows
          .filter((entry) => entry.type === "expense" && entry.currency === "USD")
          .reduce((sum, entry) => sum + entry.netAmount, 0),
        expenseUyu: accountingRows
          .filter((entry) => entry.type === "expense" && entry.currency === "UYU")
          .reduce((sum, entry) => sum + entry.netAmount, 0),
        expenseUyuDollarized: accountingRows
          .filter((entry) => entry.type === "expense" && entry.currency === "UYU")
          .reduce((sum, entry) => {
            const exchangeRate = exchangeRateByMonth[getYearMonth(entry.date)];
            return exchangeRate ? sum + entry.netAmount / exchangeRate : sum;
          }, 0),
        rainfallTotal,
        adjustments: movementRows
          .filter((movement) => movement.kind === "adjustment")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        deaths: movementRows
          .filter((movement) => movement.kind === "death")
          .reduce((sum, movement) => sum + movement.quantity, 0),
        lastRainfallDate: rainfallRecords
          .filter((record) => {
            if (record.fieldId !== field.id) {
              return false;
            }

            if (selectedYear !== "all" && !record.date.startsWith(selectedYear)) {
              return false;
            }

            if (selectedMonth !== "all" && record.date.slice(5, 7) !== selectedMonth) {
              return false;
            }

            return true;
          })
          .sort((left, right) => right.date.localeCompare(left.date))[0]?.date
      };
    });
  }, [
    accountingEntries,
    animalMovements,
    exchangeRateByMonth,
    rainfallRecords,
    selectedMonth,
    selectedYear,
    summaryStockBalanceMap,
    visibleFields
  ]);

  const periodSummary = useMemo(() => {
    const expenseUsd = accountingEntries
      .filter(
        (entry) =>
          selectedFieldIds.includes(entry.fieldId) &&
          (selectedYear === "all" || entry.date.startsWith(selectedYear)) &&
          (selectedMonth === "all" || entry.date.slice(5, 7) === selectedMonth) &&
          entry.type === "expense" &&
          entry.currency === "USD"
      )
      .reduce((sum, entry) => sum + entry.netAmount, 0);
    const expenseUyuDollarized = accountingEntries
      .filter(
        (entry) =>
          selectedFieldIds.includes(entry.fieldId) &&
          (selectedYear === "all" || entry.date.startsWith(selectedYear)) &&
          (selectedMonth === "all" || entry.date.slice(5, 7) === selectedMonth) &&
          entry.type === "expense" &&
          entry.currency === "UYU"
      )
      .reduce((sum, entry) => {
        const exchangeRate = exchangeRateByMonth[getYearMonth(entry.date)];
        return exchangeRate ? sum + entry.netAmount / exchangeRate : sum;
      }, 0);

    return {
      entries: animalMovements
        .filter(
          (movement) =>
            selectedFieldIds.includes(movement.fieldId) &&
            (selectedYear === "all" || movement.date.startsWith(selectedYear)) &&
            (selectedMonth === "all" || movement.date.slice(5, 7) === selectedMonth) &&
            getMovementDirection(movement) === "entry"
        )
        .reduce((sum, movement) => sum + movement.quantity, 0),
      exits: animalMovements
        .filter(
          (movement) =>
            selectedFieldIds.includes(movement.fieldId) &&
            (selectedYear === "all" || movement.date.startsWith(selectedYear)) &&
            (selectedMonth === "all" || movement.date.slice(5, 7) === selectedMonth) &&
            getMovementDirection(movement) === "exit"
        )
        .reduce((sum, movement) => sum + movement.quantity, 0),
      incomeUsd: accountingEntries
        .filter(
          (entry) =>
            selectedFieldIds.includes(entry.fieldId) &&
            (selectedYear === "all" || entry.date.startsWith(selectedYear)) &&
            (selectedMonth === "all" || entry.date.slice(5, 7) === selectedMonth) &&
            entry.type === "income" &&
            entry.currency === "USD"
        )
        .reduce((sum, entry) => sum + getIncomeCollectedAmount(entry), 0),
      pendingIncomeUsd: accountingEntries
        .filter(
          (entry) =>
            selectedFieldIds.includes(entry.fieldId) &&
            (selectedYear === "all" || entry.date.startsWith(selectedYear)) &&
            (selectedMonth === "all" || entry.date.slice(5, 7) === selectedMonth) &&
            entry.type === "income" &&
            entry.currency === "USD"
        )
        .reduce((sum, entry) => sum + getIncomePendingAmount(entry), 0),
      expenseUsd,
      expenseUyu: accountingEntries
        .filter(
          (entry) =>
            selectedFieldIds.includes(entry.fieldId) &&
            (selectedYear === "all" || entry.date.startsWith(selectedYear)) &&
            (selectedMonth === "all" || entry.date.slice(5, 7) === selectedMonth) &&
            entry.type === "expense" &&
            entry.currency === "UYU"
        )
        .reduce((sum, entry) => sum + entry.netAmount, 0),
      expenseUyuDollarized,
      totalExpenseUsdEquivalent: expenseUsd + expenseUyuDollarized
    };
  }, [accountingEntries, animalMovements, exchangeRateByMonth, selectedFieldIds, selectedMonth, selectedYear]);

  const annualSummary = useMemo(() => {
    const expenseUsd = accountingEntries
      .filter(
        (entry) =>
          selectedFieldIds.includes(entry.fieldId) &&
          entry.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
          entry.type === "expense" &&
          entry.currency === "USD"
      )
      .reduce((sum, entry) => sum + entry.netAmount, 0);
    const expenseUyuDollarized = accountingEntries
      .filter(
        (entry) =>
          selectedFieldIds.includes(entry.fieldId) &&
          entry.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
          entry.type === "expense" &&
          entry.currency === "UYU"
      )
      .reduce((sum, entry) => {
        const exchangeRate = exchangeRateByMonth[getYearMonth(entry.date)];
        return exchangeRate ? sum + entry.netAmount / exchangeRate : sum;
      }, 0);

    return {
      entries: animalMovements
        .filter(
          (movement) =>
            selectedFieldIds.includes(movement.fieldId) &&
            movement.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
            getMovementDirection(movement) === "entry"
        )
        .reduce((sum, movement) => sum + movement.quantity, 0),
      exits: animalMovements
        .filter(
          (movement) =>
            selectedFieldIds.includes(movement.fieldId) &&
            movement.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
            getMovementDirection(movement) === "exit"
        )
        .reduce((sum, movement) => sum + movement.quantity, 0),
      incomeUsd: accountingEntries
        .filter(
          (entry) =>
            selectedFieldIds.includes(entry.fieldId) &&
            entry.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
            entry.type === "income" &&
            entry.currency === "USD"
        )
        .reduce((sum, entry) => sum + getIncomeCollectedAmount(entry), 0),
      pendingIncomeUsd: accountingEntries
        .filter(
          (entry) =>
            selectedFieldIds.includes(entry.fieldId) &&
            entry.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
            entry.type === "income" &&
            entry.currency === "USD"
        )
        .reduce((sum, entry) => sum + getIncomePendingAmount(entry), 0),
      expenseUsd,
      expenseUyu: accountingEntries
        .filter(
          (entry) =>
            selectedFieldIds.includes(entry.fieldId) &&
            entry.date.startsWith(selectedYear === "all" ? today.slice(0, 4) : selectedYear) &&
            entry.type === "expense" &&
            entry.currency === "UYU"
        )
        .reduce((sum, entry) => sum + entry.netAmount, 0),
      expenseUyuDollarized,
      totalExpenseUsdEquivalent: expenseUsd + expenseUyuDollarized
    };
  }, [accountingEntries, animalMovements, exchangeRateByMonth, selectedFieldIds, selectedYear, today]);

  const animalLedgerSummary = useMemo(() => {
    return {
      purchases: animalLedgerRows.filter((movement) => movement.kind === "purchase").length,
      sales: animalLedgerRows.filter((movement) => movement.kind === "sale").length,
      birthsAndDeaths: animalLedgerRows.filter(
        (movement) => movement.kind === "birth" || movement.kind === "death"
      ).length,
      linkedCommercialRows: animalLedgerRows.filter((movement) => Boolean(movement.linkedAccountingEntryId)).length
    };
  }, [animalLedgerRows]);

  const rainfallRows = useMemo(() => {
    return [...rainfallRecords]
      .filter(
        (record) => {
          if (!selectedFieldIds.includes(record.fieldId)) {
            return false;
          }

          if (rainfallForm.date && record.date !== rainfallForm.date) {
            return false;
          }

          if (!rainfallSearchTerm.trim()) {
            return true;
          }

          const field = fields.find((item) => item.id === record.fieldId);
          const searchBase = [record.date, field?.name ?? "", record.notes, `${record.millimeters}`]
            .join(" ")
            .toLowerCase();

          return searchBase.includes(rainfallSearchTerm.trim().toLowerCase());
        }
      )
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [fields, rainfallForm.date, rainfallRecords, rainfallSearchTerm, selectedFieldIds]);

  const sanitaryRows = useMemo(() => {
    return [...sanitaryRecords]
      .filter((record) => {
        if (!selectedFieldIds.includes(record.fieldId)) {
          return false;
        }

        if (sanitaryForm.date && record.date !== sanitaryForm.date) {
          return false;
        }

        if (!sanitarySearchTerm.trim()) {
          return true;
        }

        const field = fields.find((item) => item.id === record.fieldId);
        const searchBase = [record.date, field?.name ?? "", record.treatment, record.notes, `${record.quantity}`]
          .join(" ")
          .toLowerCase();

        return searchBase.includes(sanitarySearchTerm.trim().toLowerCase());
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [fields, sanitaryForm.date, sanitaryRecords, sanitarySearchTerm, selectedFieldIds]);

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
    const expenseUsdDirect = accountingLedgerRows
      .filter((entry) => entry.type === "expense" && entry.currency === "USD")
      .reduce((sum, entry) => sum + entry.netAmount, 0);
    const expenseUyu = accountingLedgerRows
      .filter((entry) => entry.type === "expense" && entry.currency === "UYU")
      .reduce((sum, entry) => sum + entry.netAmount, 0);
    const expenseUyuDollarized = accountingLedgerWithConversions.reduce((sum, entry) => sum + (entry.usdEquivalent ?? 0), 0);

    return {
      incomeUsd,
      pendingIncomeUsd,
      expenseUsdDirect,
      expenseUyu,
      expenseUyuDollarized,
      totalExpenseUsdEquivalent: expenseUsdDirect + expenseUyuDollarized
    };
  }, [accountingLedgerRows, accountingLedgerWithConversions]);

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
        if (entry.establishmentId !== selectedEstablishmentId) {
          return false;
        }

        if (selectedYear !== "all" && !entry.date.startsWith(selectedYear)) {
          return false;
        }

        if (selectedMonth !== "all" && entry.date.slice(5, 7) !== selectedMonth) {
          return false;
        }

        return true;
      })
      .map((entry) => {
        const field = fields.find((item) => item.id === entry.fieldId);
        const linkedMovement = entry.linkedAnimalMovementId
          ? animalMovements.find((movement) => movement.id === entry.linkedAnimalMovementId)
          : undefined;

        return {
          id: entry.id,
          date: entry.date,
          fieldName: field?.name ?? "-",
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
  }, [accountingEntries, animalMovements, fields, selectedEstablishmentId, selectedMonth, selectedYear]);

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
      ).length,
      receivableLoads: accountingEntries.filter((entry) => entry.notes.startsWith("Saldo inicial:")).length
    };
  }, [accountingEntries, animalMovements]);

  useEffect(() => {
    let isCancelled = false;

    async function loadWorkspace() {
      try {
        const snapshot = await fetchAgroWorkspace();
        if (isCancelled) {
          return;
        }

        const nextEstablishments =
          snapshot.data.establishments && snapshot.data.establishments.length > 0
            ? snapshot.data.establishments
            : initialEstablishments;
        const nextFields =
          snapshot.data.fields && snapshot.data.fields.length > 0 ? snapshot.data.fields : initialFields;

        setEstablishments(nextEstablishments);
        setFields(nextFields);
        setAnimalMovements(snapshot.data.animalMovements.map(normalizeAnimalMovementRecord));
        setAccountingEntries(snapshot.data.accountingEntries.map(normalizeAccountingEntry));
        setRainfallRecords(snapshot.data.rainfallRecords.map(normalizeRainfallRecord));
        setSanitaryRecords(snapshot.data.sanitaryRecords.map(normalizeSanitaryRecord));
        setMonthlyExchangeRates(snapshot.data.monthlyExchangeRates);
        setWorkspaceLoadError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "No se pudo cargar el workspace de agro.";
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
  }, []);

  useEffect(() => {
    if (!workspaceLoaded || workspaceLoadError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveAgroWorkspace({
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
    workspaceLoadError
  ]);

  const isCommercialAnimalMovement = animalForm.kind === "purchase" || animalForm.kind === "sale";
  const isBirthOrDeathAnimalMovement = animalForm.kind === "birth" || animalForm.kind === "death";
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

  function showSuccess(message: string) {
    toast.success(message, { autoClose: 2400 });
  }

  function showError(message: string) {
    toast.error(message, { autoClose: false });
  }

  function handleAddEstablishment() {
    const name = newEstablishmentForm.name.trim();
    if (!name) {
      showError("Falta el nombre del establecimiento.");
      return;
    }

    if (establishments.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      showError("Ese establecimiento ya existe.");
      return;
    }

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `est-${Date.now()}`;

    const establishmentId = `est-${slug}`;
    const fieldId = `field-${slug}`;
    const nextEstablishment: Establishment = {
      id: establishmentId,
      name,
      location: "",
      hectares: 0
    };

    const nextField: FieldUnit = {
      id: fieldId,
      establishmentId,
      name,
      notes: "Operacion consolidada del establecimiento."
    };

    setEstablishments((current) => [...current, nextEstablishment]);
    setFields((current) => [...current, nextField]);
    setSelectedEstablishmentId(establishmentId);
    setSetupEstablishmentId(establishmentId);
    setAnimalForm((current) => ({ ...current, establishmentId, fieldId }));
    setAccountingForm((current) => ({ ...current, establishmentId, fieldId }));
    setRainfallForm((current) => ({ ...current, establishmentId, fieldId }));
    setSanitaryForm((current) => ({ ...current, establishmentId, fieldId }));
    resetNewEstablishmentForm();
    showSuccess("Establecimiento agregado.");
  }

  function handleAnimalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(animalForm.quantity);
    const weightKg = Number(animalForm.weightKg);
    const unitPrice = Number(animalForm.unitPrice);
    const freightAmount = Number(animalForm.freightAmount);
    const commissionAmount = Number(animalForm.commissionAmount);
    const taxAmount = Number(animalForm.taxAmount);
    const collectedAmount = animalForm.kind === "sale" ? Number(animalForm.collectedAmount || "0") : undefined;
    const commercialMovement = animalForm.kind === "purchase" || animalForm.kind === "sale";
    const nextErrors: Record<string, string> = {};

    if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = "La cantidad debe ser mayor a 0.";
    }

    if (isCattleDeathWithEarTag && !animalForm.earTag.trim()) {
      nextErrors.earTag = "Falta agregar el numero de caravana.";
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
      fieldId: getFieldIdForEstablishmentFrom(fields, animalForm.establishmentId),
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
      notes: animalForm.notes.trim()
    };

    setAnimalMovements((current) =>
      editingAnimalMovementId
        ? current.map((item) => (item.id === editingAnimalMovementId ? movement : item))
        : [movement, ...current]
    );

    if (commercialMovement && nextAccountingId && totalAmount !== undefined) {
      const accountingEntry: AccountingEntry = {
        id: nextAccountingId,
        date: animalForm.date,
        establishmentId: animalForm.establishmentId,
        fieldId: getFieldIdForEstablishmentFrom(fields, animalForm.establishmentId),
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
    resetAnimalForm();
    showSuccess(editingAnimalMovementId ? "Movimiento de animales actualizado." : "Movimiento de animales guardado.");
  }

  function handleAccountingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const grossAmount = Number(accountingForm.grossAmount);
    const commissionAmount = Number(accountingForm.commissionAmount);
    const taxAmount = Number(accountingForm.taxAmount);
    const netAmount = getNetAmount(accountingForm.type, grossAmount, commissionAmount, taxAmount);
    const collectedAmount =
      accountingForm.type === "income"
        ? accountingForm.collectedAmount.trim() === ""
          ? 0
          : Number(accountingForm.collectedAmount)
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
    resetAccountingForm();
    showSuccess(editingAccountingEntryId ? "Movimiento contable actualizado." : "Movimiento contable guardado.");
    return true;
  }

  function handleRainfallSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const millimeters = Number(rainfallForm.millimeters);
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
    resetRainfallForm();
    showSuccess(editingRainfallRecordId ? "Registro de lluvia actualizado." : "Registro de lluvia guardado.");
  }

  function handleSanitarySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(sanitaryForm.quantity);
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
      fieldId: getFieldIdForEstablishmentFrom(fields, sanitaryForm.establishmentId),
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
    resetSanitaryForm();
    showSuccess(editingSanitaryRecordId ? "Tratamiento sanitario actualizado." : "Tratamiento sanitario guardado.");
  }

  function saveInitialStockLoad() {
    const quantity = Number(initialStockForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showError("La cantidad inicial debe ser mayor a 0.");
      return false;
    }

    const entry: AnimalMovementRecord = {
      id: `anm-${Date.now()}`,
      date: setupCutoffDate,
      establishmentId: setupEstablishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, setupEstablishmentId),
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
    resetInitialStockForm();
    return true;
  }

  function saveInitialReceivableLoad() {
    const totalAmount = Number(initialReceivableForm.totalAmount);
    const collectedAmount =
      initialReceivableForm.collectedAmount.trim() === "" ? 0 : Number(initialReceivableForm.collectedAmount);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      showError("El total a cobrar debe ser mayor a 0.");
      return false;
    }

    if (!Number.isFinite(collectedAmount) || collectedAmount < 0) {
      showError("El importe ya cobrado debe ser valido.");
      return false;
    }

    if (collectedAmount > totalAmount) {
      showError("Lo ya cobrado no puede ser mayor al total.");
      return false;
    }

    const entry: AccountingEntry = {
      id: `acc-${Date.now()}`,
      date: setupCutoffDate,
      establishmentId: setupEstablishmentId,
      fieldId: getFieldIdForEstablishmentFrom(fields, setupEstablishmentId),
      type: "income",
      concept: getIncomeConceptForSpecies(setupSpecies),
      currency: "USD",
      grossAmount: totalAmount,
      commissionAmount: 0,
      taxAmount: 0,
      netAmount: totalAmount,
      expectedAmount: totalAmount,
      collectedAmount,
      notes: `Saldo inicial: ${initialReceivableForm.notes.trim() || "cuenta vieja cargada manualmente"}`
    };

    setAccountingEntries((current) => [entry, ...current]);
    setSelectedEstablishmentId(setupEstablishmentId);
    resetInitialReceivableForm();
    return true;
  }

  function handleInitialLoadSubmit() {
    const hasStockData =
      initialStockForm.quantity.trim() !== "" || initialStockForm.notes.trim() !== "";
    const hasReceivableData =
      initialReceivableForm.totalAmount.trim() !== "" ||
      initialReceivableForm.collectedAmount.trim() !== "" ||
      initialReceivableForm.notes.trim() !== "";

    if (!hasStockData && !hasReceivableData) {
      showError("No hay datos cargados para guardar en la carga inicial.");
      return;
    }

    let savedStock = false;
    let savedReceivable = false;

    if (hasStockData) {
      savedStock = saveInitialStockLoad();
      if (!savedStock) {
        return;
      }
    }

    if (hasReceivableData) {
      savedReceivable = saveInitialReceivableLoad();
      if (!savedReceivable) {
        return;
      }
    }

    if (savedStock && savedReceivable) {
      showSuccess("Carga inicial guardada.");
    } else if (savedStock) {
      showSuccess("Stock inicial cargado.");
    } else if (savedReceivable) {
      showSuccess("Saldo inicial a cobrar cargado.");
    }
  }

  function handleExchangeRateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const averageRate = Number(exchangeRateForm.averageRate);
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

    resetExchangeRateForm();
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
    setAnimalMovements((current) => current.filter((item) => item.id !== movementId));
    if (editingAnimalMovementId === movementId) {
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
    Number(accountingForm.grossAmount) || 0,
    Number(accountingForm.commissionAmount) || 0,
    Number(accountingForm.taxAmount) || 0
  );

  const projectedAnimalTotal = calculateAnimalTotal(
    Number(animalForm.quantity) || 0,
    Number(animalForm.unitPrice) || 0,
    Number(animalForm.commissionAmount) || 0,
    Number(animalForm.taxAmount) || 0,
    animalForm.kind === "purchase" ? Number(animalForm.freightAmount) || 0 : 0
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
      >
        <AgroToolbar
          availableYears={availableYears}
          establishments={establishments}
          selectedEstablishmentId={selectedEstablishmentId}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onEstablishmentChange={setSelectedEstablishmentId}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />

        <AgroMetricsGrid accountingTotals={accountingTotals} stockBySpecies={stockBySpecies} />

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
            setupCutoffDate={setupCutoffDate}
            setupEstablishmentId={setupEstablishmentId}
            setupSpecies={setupSpecies}
            newEstablishmentForm={newEstablishmentForm}
            initialStockForm={initialStockForm}
            initialReceivableForm={initialReceivableForm}
            setupSummary={setupSummary}
            setSetupCutoffDate={setSetupCutoffDate}
            setSetupEstablishmentId={setSetupEstablishmentId}
            setSetupSpecies={setSetupSpecies}
            setNewEstablishmentForm={setNewEstablishmentForm}
            setInitialStockForm={setInitialStockForm}
            setInitialReceivableForm={setInitialReceivableForm}
            resetInitialStockForm={resetInitialStockForm}
            resetInitialReceivableForm={resetInitialReceivableForm}
            onAddEstablishment={handleAddEstablishment}
            onSubmitInitialLoad={handleInitialLoadSubmit}
          />
        ) : null}

        {activeView === "animals" ? (
          <AgroAnimalsSection
            establishments={establishments}
            fields={fields}
            getFieldIdForEstablishment={(establishmentId) => getFieldIdForEstablishmentFrom(fields, establishmentId)}
            animalFieldRefs={animalFieldRefs}
            animalForm={animalForm}
            animalFormErrors={animalFormErrors}
            animalFormPanelRef={animalFormPanelRef}
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
            getFieldIdForEstablishment={(establishmentId) => getFieldIdForEstablishmentFrom(fields, establishmentId)}
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
            getFieldIdForEstablishment={(establishmentId) => getFieldIdForEstablishmentFrom(fields, establishmentId)}
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
            getFieldIdForEstablishment={(establishmentId) => getFieldIdForEstablishmentFrom(fields, establishmentId)}
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
            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Resumen por establecimiento</h2>
                  <p>Lectura corta de animales, caja y lluvia con un dato al lado de cada item.</p>
                </div>
              </div>
              <div className="report-stack">
                {summaryByField.map((item) => (
                  <article key={item.field.id} className="report-row-card">
                    <div className="report-row-head">
                      <strong>{item.field.name}</strong>
                      <span>{item.field.notes}</span>
                    </div>
                    <div className="list-stack">
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
                        <span>Lluvia acumulada</span>
                        <strong>{item.rainfallTotal} mm</strong>
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
                        <span>Egresos USD directos</span>
                        <strong>{formatMoney(item.expenseUsd, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Egresos UYU</span>
                        <strong>{formatMoney(item.expenseUyu, "UYU")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Egresos UYU pasados a USD</span>
                        <strong>{formatMoney(item.expenseUyuDollarized, "USD")}</strong>
                      </div>
                      <div className="list-row">
                        <span>Egreso total equivalente USD</span>
                        <strong>{formatMoney(item.expenseUsd + item.expenseUyuDollarized, "USD")}</strong>
                      </div>
                    </div>
                    <div className="inline-metrics">
                      {item.adjustments > 0 ? (
                        <span className="data-badge warning">Ajustes pendientes de revisar: {item.adjustments}</span>
                      ) : null}
                      {item.deaths > 0 ? (
                        <span className="data-badge warning">Muertes registradas: {item.deaths}</span>
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
                  </article>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Resumen del periodo</h2>
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
                  <span>Egresos USD directos</span>
                  <strong>{formatMoney(periodSummary.expenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Egresos UYU</span>
                  <strong>{formatMoney(periodSummary.expenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Egresos UYU pasados a USD</span>
                  <strong>{formatMoney(periodSummary.expenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Total egresos USD equivalentes</span>
                  <strong>{formatMoney(periodSummary.totalExpenseUsdEquivalent, "USD")}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Resumen anual</h2>
                </div>
              </div>
              <div className="list-stack">
                <div className="list-row">
                  <span>Entradas animales</span>
                  <strong>{annualSummary.entries}</strong>
                </div>
                <div className="list-row">
                  <span>Salidas animales</span>
                  <strong>{annualSummary.exits}</strong>
                </div>
                <div className="list-row">
                  <span>Ingresos cobrados</span>
                  <strong>{formatMoney(annualSummary.incomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Valor pendiente de cobro</span>
                  <strong>{formatMoney(annualSummary.pendingIncomeUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Egresos USD directos</span>
                  <strong>{formatMoney(annualSummary.expenseUsd, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Egresos UYU</span>
                  <strong>{formatMoney(annualSummary.expenseUyu, "UYU")}</strong>
                </div>
                <div className="list-row">
                  <span>Egresos UYU pasados a USD</span>
                  <strong>{formatMoney(annualSummary.expenseUyuDollarized, "USD")}</strong>
                </div>
                <div className="list-row">
                  <span>Total egresos USD equivalentes</span>
                  <strong>{formatMoney(annualSummary.totalExpenseUsdEquivalent, "USD")}</strong>
                </div>
              </div>
            </article>

            <article className="panel wide">
              <div className="panel-header">
                <div>
                  <h2>Estado de cuenta</h2>
                  <p>Lectura de lo que esta pendiente, parcial o ya cobrado dentro del periodo activo.</p>
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
                      <th>Establecimiento</th>
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
                  <p>Lectura para revisar existencias por establecimiento, especie y categoria dentro del periodo elegido.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Establecimiento</th>
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
