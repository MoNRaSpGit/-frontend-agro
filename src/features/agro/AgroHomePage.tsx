import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AgroApiError } from "../../shared/errors/agroApiError";
import { calculateAnimalTotal, deriveMovementDirection, getIncomeConceptForSpecies, requiresEarTag } from "./agro.domain";
import {
  buildStockCorrectionMovement,
  computeFieldAvailability,
  describeAnimalMovementDetail,
  formatCategoryLabel,
  expenseConceptLabels,
  formatMoney,
  formatNumber,
  parseDecimalInput,
  formatShortDate,
  getAlternativeFieldId,
  getFieldIdForEstablishmentFrom,
  getFirstFieldIdForEstablishment,
  getIncomeCollectedAmount,
  getIncomeCollectionStatus,
  getIncomeExpectedAmount,
  getIncomePendingAmount,
  getMovementDirection,
  getNetAmount,
  getTodayDate,
  getVisibleMonthRange,
  getYearMonth,
  formatYearMonth,
  isDateOnOrBefore,
  isDateWithinRange,
  isLivestockPurchaseEntry,
  isTransferMovementKind,
  normalizeAccountingEntry,
  normalizeAnimalMovementRecord,
  normalizeFieldUnits,
  normalizeRainfallRecord,
  normalizeSanitaryRecord,
  sumFieldHectares,
  summarizeExpenses,
  summarizeRangeData,
  incomeConceptLabels
} from "./agro.home.shared";
import { agroWorkspaceSections } from "./agro.workspace.config";
import { AGRO_WORKSPACE_SAVE_ERROR_TOAST_ID, describeAgroWorkspaceError, friendlyAgroToastMessage } from "./agro.workspaceErrors";
import {
  categoryCatalog,
  establishments as initialEstablishments,
  fields as initialFields,
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
  AnimalPricingMode,
  Establishment,
  ExpenseConcept,
  FieldUnit,
  IncomeConcept,
  MonthlyExchangeRate,
  MoneyCurrency,
  RainfallRecord,
  SanitaryRecord
} from "./agro.types";

interface AgroHomePageProps {
  persistenceMode: AgroPersistenceMode;
  onSignOut: () => void;
}

// Opciones simplificadas para el filtro de movimientos de "Resumen por
// establecimiento": agrupa los "kind" internos (transfer_out/transfer_internal,
// correction_in/correction_out/adjustment) en una sola opcion cada uno, para
// no marear al usuario con la granularidad interna del ledger de Animales.
type SummaryMovementFilterKind = "purchase" | "sale" | "birth" | "death" | "transfer" | "shortage" | "correction";

const SUMMARY_MOVEMENT_FILTER_LABELS: Record<SummaryMovementFilterKind, string> = {
  purchase: "Compras",
  sale: "Ventas",
  birth: "Nacimientos",
  death: "Muertes",
  transfer: "Traslados",
  shortage: "Faltantes",
  correction: "Ajustes / correcciones"
};

function matchesSummaryMovementFilterKind(kind: AnimalMovementKind, filterKind: SummaryMovementFilterKind) {
  if (filterKind === "transfer") {
    return kind === "transfer_out" || kind === "transfer_internal";
  }
  if (filterKind === "correction") {
    return kind === "correction_in" || kind === "correction_out" || kind === "adjustment";
  }
  return kind === filterKind;
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
  const latestWorkspaceSaveRef = useRef<{
    mode: AgroPersistenceMode;
    snapshot: Parameters<typeof saveAgroWorkspace>[1];
  } | null>(null);
  const workspaceSaveInFlightRef = useRef(false);
  const workspaceSaveStatusRef = useRef<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  // Ultima version de fila que vimos (carga inicial o nuestro propio ultimo
  // guardado con exito). Se manda en cada guardado para que el backend
  // pueda detectar si otro dispositivo/pestana ya guardo algo mas nuevo.
  const workspaceRowVersionRef = useRef<number | null>(null);
  // Referencias siempre-actualizadas para usar dentro de efectos sin
  // tenerlas que poner en el array de dependencias: onSignOut es una prop
  // que el padre recrea en cada render, y enqueueWorkspaceSave se recrea en
  // cada render del propio componente - si cualquiera de las dos entrara
  // directo en un array de dependencias, el efecto se volveria a disparar
  // en cada render (fetch repetido / autoguardado de mas), no solo cuando
  // realmente cambia lo que le importa a ese efecto.
  const onSignOutRef = useRef(onSignOut);
  onSignOutRef.current = onSignOut;
  const enqueueWorkspaceSaveRef = useRef(enqueueWorkspaceSave);
  enqueueWorkspaceSaveRef.current = enqueueWorkspaceSave;
  const [activeView, setActiveView] = useState<AgroView | null>(null);
  const [summarySubView, setSummarySubView] = useState<"establishment" | "global">("establishment");
  // Selector propio de la sub-pestana "Por establecimiento" de Resumen,
  // separado del selector de arriba (que usan Animales/Contabilidad/etc y
  // necesita siempre un establecimiento puntual). Vacio = "Todos".
  const [summaryEstablishmentFilter, setSummaryEstablishmentFilter] = useState("");
  // Filtro de tipo de movimiento para la planilla de "Resumen por
  // establecimiento". A diferencia del de establecimiento, este es
  // obligatorio: vacio = no mostrar filas (evita tirar todo el historial de
  // una) hasta que el usuario elija que quiere ver.
  const [summaryMovementKindFilter, setSummaryMovementKindFilter] = useState<SummaryMovementFilterKind | "">("");
  // Mismo patron que summaryMovementKindFilter, pero para movimientos de
  // caja: "" = no mostrar filas. Usa el mismo summaryEstablishmentFilter
  // de arriba (no tiene un selector de establecimiento propio).
  const [summaryAccountingConceptFilter, setSummaryAccountingConceptFilter] = useState<string>("");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [fields, setFields] = useState<FieldUnit[]>([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState("");
  const [selectedVisibleFieldId, setSelectedVisibleFieldId] = useState("");
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(today.slice(5, 7));
  const [animalSearchTerm, setAnimalSearchTerm] = useState("");
  const [accountingSearchTerm, setAccountingSearchTerm] = useState("");
  const [accountingStatusFilter, setAccountingStatusFilter] = useState<"all" | "pending" | "partial" | "collected">("all");
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
  const [workspaceSaveStatus, setWorkspaceSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [workspaceSaveErrorMessage, setWorkspaceSaveErrorMessage] = useState<string | null>(null);
  const [workspaceLastSavedAt, setWorkspaceLastSavedAt] = useState<Date | null>(null);

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
    pricingMode: "kilo" as AnimalPricingMode,
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
    categoryCode: categoryCatalog.vacunos[0]?.code ?? "",
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
      pricingMode: preserveContext ? current.pricingMode : ("kilo" as AnimalPricingMode),
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
        pricingMode: "kilo",
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
      // "" en vez de la primera categoria del catalogo fijo: el efecto que
      // sincroniza sanitaryForm.categoryCode con sanitaryAvailableCategories
      // la completa sola con la primera que realmente tenga stock en el
      // potrero, o la deja vacia si no hay ninguna.
      categoryCode: preserveContext ? current.categoryCode : "",
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

  // Parametrizado por fieldId (no solo el potrero origen actual) para que
  // el selector de "Potrero origen" pueda recalcular especie/categoria
  // disponible EN EL MISMO cambio de estado que el fieldId, sin esperar a
  // que este memo se vuelva a calcular en el render siguiente -- ver
  // getTransferAvailabilityForField mas abajo y su uso en
  // AgroAnimalsSection (bug intermitente "Esa categoria no tiene stock
  // disponible en el potrero origen").
  const buildTransferAvailabilityForField = useCallback(
    (fieldId: string) => {
      const availability = new Map<AgroSpecies, Array<{ categoryCode: string; quantity: number }>>();

      for (const [key, rawQuantity] of stockBalanceMap.entries()) {
        const [entryFieldId, species, categoryCode] = key.split(":") as [string, AgroSpecies, string];
        if (entryFieldId !== fieldId) {
          continue;
        }

        let quantity = rawQuantity;
        if (
          currentEditingTransferMovement &&
          currentEditingTransferMovement.sourceMovement.fieldId === entryFieldId &&
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
    },
    [currentEditingTransferMovement, stockBalanceMap]
  );

  const transferOriginAvailability = useMemo(
    () => buildTransferAvailabilityForField(animalForm.fieldId),
    [animalForm.fieldId, buildTransferAvailabilityForField]
  );

  const transferAvailableSpecies = useMemo(
    () => Array.from(transferOriginAvailability.keys()),
    [transferOriginAvailability]
  );

  const transferAvailableCategories = useMemo(
    () => transferOriginAvailability.get(animalForm.species) ?? [],
    [animalForm.species, transferOriginAvailability]
  );

  const editingAnimalMovement = useMemo(() => {
    if (!editingAnimalMovementId) {
      return null;
    }

    return animalMovements.find((item) => item.id === editingAnimalMovementId) ?? null;
  }, [animalMovements, editingAnimalMovementId]);

  // Stock actual para el potrero/especie/categoria elegidos en el formulario,
  // "base" (sin contar el movimiento que se esta editando, si hay uno para
  // esa misma combinacion). Sirve para dos cosas: el hint de "cuanto muestra
  // el sistema" en una correccion, y para bloquear ventas/muertes/faltantes/
  // ajustes que dejarian una categoria en negativo (los traslados ya se
  // validan aparte, con transferOriginAvailability).
  const animalFormBaselineQuantity = useMemo(() => {
    const key = `${animalForm.fieldId}:${animalForm.species}:${animalForm.categoryCode}`;
    let quantity = stockBalanceMap.get(key) ?? 0;

    if (
      editingAnimalMovement &&
      !isTransferMovementKind(editingAnimalMovement.kind) &&
      editingAnimalMovement.fieldId === animalForm.fieldId &&
      editingAnimalMovement.species === animalForm.species &&
      editingAnimalMovement.categoryCode === animalForm.categoryCode
    ) {
      const sign = getMovementDirection(editingAnimalMovement) === "entry" ? 1 : -1;
      quantity -= sign * editingAnimalMovement.quantity;
    }

    return quantity;
  }, [animalForm.categoryCode, animalForm.fieldId, animalForm.species, editingAnimalMovement, stockBalanceMap]);

  // En sanidad no se mueve stock, pero igual se filtra y se bloquea con la
  // misma logica que el traslado: antes el combo de categoria mostraba el
  // catalogo fijo completo (con "(0 en el potrero)" al lado, pero
  // seleccionable igual), asi que si no se elegia a mano quedaba
  // seleccionada por defecto la primera categoria del catalogo aunque no
  // hubiera ni un animal de esa categoria en el potrero -- la sanidad
  // quedaba registrada con una categoria inventada.
  const sanitaryFieldAvailability = useMemo(
    () => computeFieldAvailability(stockBalanceMap, sanitaryForm.fieldId),
    [sanitaryForm.fieldId, stockBalanceMap]
  );

  const sanitaryAvailableCategories = useMemo(
    () => sanitaryFieldAvailability.get(sanitaryForm.species) ?? [],
    [sanitaryFieldAvailability, sanitaryForm.species]
  );

  // Si se esta editando un registro ya guardado, su categoria puede ya no
  // tener stock hoy en el potrero (ej: se vendieron esos animales despues
  // de aplicarle el tratamiento) -- se agrega igual al combo para no
  // esconder la opcion que ese registro realmente tiene, pero no se usa
  // para el autocompletado ni para la validacion de un registro nuevo.
  const sanitaryCategoryOptions = useMemo(() => {
    if (
      editingSanitaryRecordId &&
      sanitaryForm.categoryCode &&
      !sanitaryAvailableCategories.some((item) => item.categoryCode === sanitaryForm.categoryCode)
    ) {
      return [...sanitaryAvailableCategories, { categoryCode: sanitaryForm.categoryCode, quantity: 0 }];
    }
    return sanitaryAvailableCategories;
  }, [sanitaryAvailableCategories, editingSanitaryRecordId, sanitaryForm.categoryCode]);

  // Autocompleta sanitaryForm.categoryCode con la primera categoria que
  // realmente tenga stock en el potrero/especie elegidos (o la deja vacia
  // si no hay ninguna), cada vez que cambia el potrero, la especie, o el
  // stock disponible deja invalida la categoria actual. No se toca
  // mientras se edita un registro existente (ver sanitaryCategoryOptions).
  useEffect(() => {
    if (editingSanitaryRecordId) return;

    setSanitaryForm((current) => {
      const nextCategoryCode = sanitaryAvailableCategories.some((item) => item.categoryCode === current.categoryCode)
        ? current.categoryCode
        : sanitaryAvailableCategories[0]?.categoryCode ?? "";

      if (nextCategoryCode === current.categoryCode) {
        return current;
      }

      return { ...current, categoryCode: nextCategoryCode };
    });
  }, [sanitaryAvailableCategories, editingSanitaryRecordId]);

  const sanitarySpeciesAvailableQuantity = useMemo(() => {
    const totals: Record<AgroSpecies, number> = { vacunos: 0, ovinos: 0, equinos: 0 };
    for (const [species, rows] of sanitaryFieldAvailability.entries()) {
      totals[species] = rows.reduce((sum, row) => sum + row.quantity, 0);
    }
    return totals;
  }, [sanitaryFieldAvailability]);

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

        // Traslado interno visible por completo: si las dos puntas del
        // mismo traslado caen dentro de lo que se esta mirando ahora (ej:
        // "todo el campo" con un traslado entre dos potreros de ese mismo
        // campo), no repetir el mismo movimiento dos veces -- se deja solo
        // la fila de salida (Traslado), igual que ya hace
        // globalAnimalLedgerRows. Si solo una punta esta a la vista (un
        // potrero puntual, o un traslado entre campos distintos), la fila
        // de llegada (Ingreso) se sigue mostrando normal.
        if (movement.kind === "transfer_in" && movement.pairedTransferMovementId) {
          const pairedMovement = animalMovements.find((item) => item.id === movement.pairedTransferMovementId);
          if (pairedMovement && selectedFieldIdSet.has(pairedMovement.fieldId)) {
            return false;
          }
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

  // A diferencia de animalLedgerRows (filtrada por el campo seleccionado,
  // igual que el resto de la pantalla), esta lista es deliberadamente
  // global: el cliente pidio ver sus ultimos movimientos (de cualquier
  // tipo, no solo traslados) sin tener que cambiar el filtro de campo
  // para ver ambas puntas de un traslado entre establecimientos. Solo
  // respeta el rango de fechas visible, no el campo ni la busqueda.
  const globalAnimalLedgerRows = useMemo(() => {
    return [...animalMovements]
      .filter(
        (movement) =>
          movement.kind !== "transfer_in" && isDateWithinRange(movement.date, visibleMonthRange.startDate, visibleMonthRange.endDate)
      )
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [animalMovements, visibleMonthRange.endDate, visibleMonthRange.startDate]);

  // Planilla de "Resumen por establecimiento": mismos datos que el ledger de
  // Animales (globalAnimalLedgerRows, ya acotado al mes visible), filtrados
  // por establecimiento y tipo de movimiento. El tipo es obligatorio: sin
  // eleccion no se muestra nada, para no tirar de entrada todo el historial.
  const summaryMovementRows = useMemo(() => {
    if (!summaryMovementKindFilter) {
      return [];
    }

    return globalAnimalLedgerRows.filter((movement) => {
      if (summaryEstablishmentFilter && movement.establishmentId !== summaryEstablishmentFilter) {
        return false;
      }
      return matchesSummaryMovementFilterKind(movement.kind, summaryMovementKindFilter);
    });
  }, [globalAnimalLedgerRows, summaryEstablishmentFilter, summaryMovementKindFilter]);

  // Para el select "Contabilidad": el cliente pedia poder ver cuanto se
  // gasto/cobro en un rubro puntual (sanidad, sueldos, etc.) por mes y en
  // el año completo, y no lo encontraba en ningun lado -- a diferencia de
  // "Movimiento" (acotado al mes visible), esto va por el "Año visible"
  // completo para poder armar el resumen mes a mes + total anual. Reusa el
  // mismo summaryEstablishmentFilter de arriba, sin selector propio.
  const summaryAccountingYearRows = useMemo(() => {
    if (!summaryAccountingConceptFilter) {
      return [];
    }

    return accountingEntries
      .filter((entry) => {
        if (entry.date.slice(0, 4) !== selectedYear) {
          return false;
        }
        if (summaryEstablishmentFilter && entry.establishmentId !== summaryEstablishmentFilter) {
          return false;
        }
        return entry.concept === summaryAccountingConceptFilter;
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [accountingEntries, selectedYear, summaryEstablishmentFilter, summaryAccountingConceptFilter]);

  // Resumen mes a mes del rubro elegido, cada mes con su total separado por
  // moneda (un rubro nunca mezcla ingreso y egreso, pero si puede tener
  // renglones en pesos y en dolares). Solo lista los meses que tienen algun
  // movimiento, para no mostrar 12 filas en $0.
  const summaryAccountingMonthlyTotals = useMemo(() => {
    const totalsByMonth = new Map<string, { UYU: number; USD: number }>();

    for (const entry of summaryAccountingYearRows) {
      const yearMonth = getYearMonth(entry.date);
      const current = totalsByMonth.get(yearMonth) ?? { UYU: 0, USD: 0 };
      current[entry.currency] += entry.netAmount;
      totalsByMonth.set(yearMonth, current);
    }

    return [...totalsByMonth.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([yearMonth, totals]) => ({ yearMonth, label: formatYearMonth(yearMonth), totals }));
  }, [summaryAccountingYearRows]);

  // Total del año completo (suma de los totales mensuales), separado por
  // moneda igual que arriba.
  const summaryAccountingYearTotal = useMemo(() => {
    return summaryAccountingMonthlyTotals.reduce(
      (accumulated, month) => ({
        UYU: accumulated.UYU + month.totals.UYU,
        USD: accumulated.USD + month.totals.USD
      }),
      { UYU: 0, USD: 0 }
    );
  }, [summaryAccountingMonthlyTotals]);

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

  const animalLedgerSummary = useMemo(() => {
    return {
      purchases: animalLedgerRows.filter((movement) => movement.kind === "purchase").length,
      sales: animalLedgerRows.filter((movement) => movement.kind === "sale").length,
      stockInternalMoves: transferRows.length,
      stockIncidents: animalLedgerRows.filter(
        (movement) =>
          movement.kind === "birth" ||
          movement.kind === "death" ||
          movement.kind === "shortage" ||
          movement.kind === "correction_in" ||
          movement.kind === "correction_out"
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
  }, [establishmentFieldIds, establishments, fields, rainfallRecords, rainfallSearchTerm, visibleMonthRange.endDate, visibleMonthRange.startDate]);

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
        const category = categoryCatalog[record.species]?.find((item) => item.code === record.categoryCode);
        const searchBase = [
          record.date,
          establishment?.name ?? "",
          field?.name ?? "",
          speciesLabels[record.species],
          category ? formatCategoryLabel(category.label) : "",
          record.treatment,
          record.notes,
          `${record.quantity}`
        ]
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

  const setupSummary = useMemo(() => {
    return {
      stockLoads: animalMovements.filter(
        (movement) => movement.kind === "adjustment" && movement.notes.startsWith("Carga inicial:")
      ).length
    };
  }, [animalMovements]);

  const getFieldDeleteBlockReason = useCallback(
    (fieldId: string) => {
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
    },
    [setupFields, animalMovements, accountingEntries, rainfallRecords, sanitaryRecords]
  );

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
    [setupFields, getFieldDeleteBlockReason]
  );

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
        const nextFields = normalizeFieldUnits(Array.isArray(snapshot.data.fields) ? snapshot.data.fields : initialFields);

        setEstablishments(nextEstablishments);
        setFields(nextFields);
        setAnimalMovements(snapshot.data.animalMovements.map((movement) => normalizeAnimalMovementRecord(movement, nextFields)));
        setAccountingEntries(snapshot.data.accountingEntries.map((entry) => normalizeAccountingEntry(entry, nextFields)));
        setRainfallRecords(snapshot.data.rainfallRecords.map((record) => normalizeRainfallRecord(record, nextFields)));
        setSanitaryRecords(snapshot.data.sanitaryRecords.map((record) => normalizeSanitaryRecord(record, nextFields)));
        setMonthlyExchangeRates(snapshot.data.monthlyExchangeRates);
        workspaceRowVersionRef.current = snapshot.rowVersion;
        setWorkspaceLoadError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = describeAgroWorkspaceError(error, "cargar");
        setEstablishments([]);
        setFields([]);
        setAnimalMovements([]);
        setAccountingEntries([]);
        setRainfallRecords([]);
        setSanitaryRecords([]);
        setMonthlyExchangeRates([]);
        setWorkspaceLoadError(message);
        showError(message);

        // Si la sesion realmente vencio (no una carrera pasajera), no tiene
        // sentido dejar al usuario mirando una app rota que nunca va a poder
        // guardar nada: lo mandamos derecho a la pantalla de login.
        if (error instanceof AgroApiError && error.kind === "auth") {
          onSignOutRef.current();
        }
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

    setWorkspaceSaveStatus("pending");

    const timeoutId = window.setTimeout(() => {
      enqueueWorkspaceSaveRef.current(persistenceMode, {
        establishments,
        fields,
        animalMovements,
        accountingEntries,
        rainfallRecords,
        sanitaryRecords,
        monthlyExchangeRates
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

  useEffect(() => {
    workspaceSaveStatusRef.current = workspaceSaveStatus;
  }, [workspaceSaveStatus]);

  // Si cierra la pestana o navega afuera mientras todavia hay un cambio sin
  // guardar (esperando el debounce o con el pedido en viaje), el navegador
  // le muestra una confirmacion nativa en vez de perder ese ultimo cambio
  // en silencio.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      const status = workspaceSaveStatusRef.current;
      if (status !== "pending" && status !== "saving") {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const isCommercialAnimalMovement = animalForm.kind === "purchase" || animalForm.kind === "sale";
  const isCorrectionAnimalMovement = animalForm.kind === "correction";
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
    toast.success(friendlyAgroToastMessage(message, "success"), { autoClose: 2400 });
  }

  function showError(message: string) {
    toast.error(friendlyAgroToastMessage(message, "error"), { autoClose: false });
  }

  async function flushWorkspaceSaveQueue() {
    if (workspaceSaveInFlightRef.current) {
      return;
    }

    workspaceSaveInFlightRef.current = true;

    try {
      while (latestWorkspaceSaveRef.current) {
        const nextSave = latestWorkspaceSaveRef.current;
        latestWorkspaceSaveRef.current = null;

        setWorkspaceSaveStatus("saving");

        try {
          const savedSnapshot = await saveAgroWorkspace(nextSave.mode, nextSave.snapshot, workspaceRowVersionRef.current);
          workspaceRowVersionRef.current = savedSnapshot.rowVersion;
          setWorkspaceSaveStatus("saved");
          setWorkspaceSaveErrorMessage(null);
          setWorkspaceLastSavedAt(new Date());
          // Si habia quedado un aviso de error de un guardado anterior, lo
          // cerramos: este guardado nuevo si tuvo exito, no puede quedar
          // colgado el mensaje viejo diciendo que no se guardo.
          toast.dismiss(AGRO_WORKSPACE_SAVE_ERROR_TOAST_ID);
        } catch (error) {
          const message = describeAgroWorkspaceError(error, "guardar");
          console.error("[agro-workspace-save]", message, error);
          setWorkspaceSaveStatus("error");
          setWorkspaceSaveErrorMessage(message);
          toast.error(message, { autoClose: false, toastId: AGRO_WORKSPACE_SAVE_ERROR_TOAST_ID });

          // Sesion realmente vencida: mandamos al login en vez de dejar al
          // usuario cargando datos que nunca se van a poder guardar.
          if (error instanceof AgroApiError && error.kind === "auth") {
            onSignOut();
          }
        }
      }
    } finally {
      workspaceSaveInFlightRef.current = false;

      if (latestWorkspaceSaveRef.current) {
        void flushWorkspaceSaveQueue();
      }
    }
  }

  function enqueueWorkspaceSave(mode: AgroPersistenceMode, snapshot: Parameters<typeof saveAgroWorkspace>[1]) {
    latestWorkspaceSaveRef.current = { mode, snapshot };
    void flushWorkspaceSaveQueue();
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
    } else if (Number.isFinite(hectares) && firstFieldHectares > hectares) {
      nextErrors.firstFieldHectares = "Las hectareas del potrero no pueden superar las del establecimiento.";
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
    } else {
      const establishmentHectares = establishments.find((item) => item.id === setupEstablishmentId)?.hectares ?? 0;
      const otherFieldsHectares = sumFieldHectares(fields, setupEstablishmentId);

      if (otherFieldsHectares + hectares > establishmentHectares) {
        nextErrors.hectares = "La suma de los potreros no puede superar las hectareas del establecimiento.";
      }
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

  function handleUpdateEstablishmentHectares(establishmentId: string, hectaresInput: string) {
    const hectares = parseDecimalInput(hectaresInput);

    if (!establishmentId) {
      showError("Elegi un establecimiento para editar sus hectareas.");
      return;
    }

    if (!Number.isFinite(hectares) || hectares <= 0) {
      showError("Las hectareas del campo deben ser un numero mayor a 0.");
      return;
    }

    const fieldsHectares = sumFieldHectares(fields, establishmentId);
    if (hectares < fieldsHectares) {
      showError(
        `Las hectareas del campo no pueden ser menos que la suma de sus potreros (${fieldsHectares} ha ya asignadas).`
      );
      return;
    }

    setEstablishments((current) =>
      current.map((item) => (item.id === establishmentId ? { ...item, hectares } : item))
    );
    showSuccess("Hectareas del campo actualizadas.");
  }

  function handleUpdateFieldHectares(fieldId: string, hectaresInput: string) {
    const hectares = parseDecimalInput(hectaresInput);

    if (!Number.isFinite(hectares) || hectares <= 0) {
      showError("Las hectareas del potrero deben ser un numero mayor a 0.");
      return;
    }

    const field = fields.find((item) => item.id === fieldId);
    if (!field) {
      showError("No encontramos ese potrero.");
      return;
    }

    const establishmentHectares = establishments.find((item) => item.id === field.establishmentId)?.hectares ?? 0;
    const otherFieldsHectares = sumFieldHectares(fields, field.establishmentId, fieldId);

    if (otherFieldsHectares + hectares > establishmentHectares) {
      showError("La suma de los potreros no puede superar las hectareas del establecimiento.");
      return;
    }

    setFields((current) => current.map((item) => (item.id === fieldId ? { ...item, hectares } : item)));
    showSuccess("Hectareas del potrero actualizadas.");
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

  function handleMergeField(sourceFieldId: string, targetFieldId: string) {
    const sourceField = fields.find((item) => item.id === sourceFieldId);
    const targetField = fields.find((item) => item.id === targetFieldId);

    if (!sourceField) {
      showError("No encontramos el potrero que queres eliminar.");
      return;
    }

    if (!targetField) {
      showError("Elegí un potrero destino para mover los datos.");
      return;
    }

    if (sourceField.id === targetField.id) {
      showError("El potrero destino debe ser distinto.");
      return;
    }

    if (sourceField.establishmentId !== targetField.establishmentId) {
      showError("Solo se pueden fusionar potreros del mismo campo.");
      return;
    }

    setAnimalMovements((current) =>
      current.map((movement) =>
        movement.fieldId === sourceFieldId
          ? { ...movement, fieldId: targetFieldId, establishmentId: targetField.establishmentId }
          : movement
      )
    );
    setAccountingEntries((current) =>
      current.map((entry) =>
        entry.fieldId === sourceFieldId ? { ...entry, fieldId: targetFieldId, establishmentId: targetField.establishmentId } : entry
      )
    );
    setRainfallRecords((current) =>
      current.map((record) => (record.fieldId === sourceFieldId ? { ...record, fieldId: targetFieldId } : record))
    );
    setSanitaryRecords((current) =>
      current.map((record) =>
        record.fieldId === sourceFieldId ? { ...record, fieldId: targetFieldId, establishmentId: targetField.establishmentId } : record
      )
    );
    setFields((current) => current.filter((item) => item.id !== sourceFieldId));
    setSetupFieldId((current) => (current === sourceFieldId ? targetFieldId : current));
    setSelectedVisibleFieldId((current) => (current === sourceFieldId ? targetFieldId : current));
    setAnimalForm((current) => (current.fieldId === sourceFieldId ? { ...current, fieldId: targetFieldId } : current));
    setAccountingForm((current) => (current.fieldId === sourceFieldId ? { ...current, fieldId: targetFieldId } : current));
    setRainfallForm((current) => (current.fieldId === sourceFieldId ? { ...current, fieldId: targetFieldId } : current));
    setSanitaryForm((current) => (current.fieldId === sourceFieldId ? { ...current, fieldId: targetFieldId } : current));
    showSuccess("Potreros fusionados.");
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
    const isCorrectionMovement = animalForm.kind === "correction";
    const nextErrors: Record<string, string> = {};

    // En una correccion, "quantity" es el total correcto que el usuario
    // quiere que quede, no una cantidad a sumar/restar. La diferencia con
    // el stock actual (animalFormBaselineQuantity) se calcula sola y se
    // guarda como un movimiento de entrada o salida segun corresponda. Como
    // el total no puede ser negativo, una correccion nunca puede dejar la
    // categoria en negativo.
    let correctionDelta = 0;

    if (isCorrectionMovement) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        nextErrors.quantity = "La cantidad correcta debe ser un numero mayor o igual a 0.";
      } else {
        correctionDelta = quantity - animalFormBaselineQuantity;
        if (correctionDelta === 0) {
          nextErrors.quantity = "Ese valor ya es el que muestra el sistema. No hay nada para corregir.";
        }
      }
    } else if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = "La cantidad debe ser mayor a 0.";
    }

    // Ventas, muertes, faltantes y ajustes manuales restan animales del
    // potrero: no pueden dejar una categoria en negativo (a diferencia de
    // la contabilidad, donde estar en rojo es valido). Los traslados ya se
    // validan aparte (transferOriginAvailability) y las correcciones no
    // pueden dar negativo por construccion (el total minimo es 0).
    const isExitMovementRequiringStockCheck =
      !isTransferMovement &&
      !isCorrectionMovement &&
      deriveMovementDirection(animalForm.kind) === "exit" &&
      !(animalForm.kind === "adjustment" && animalForm.notes.trim().startsWith("Carga inicial:"));

    if (
      isExitMovementRequiringStockCheck &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      quantity > animalFormBaselineQuantity
    ) {
      nextErrors.quantity = `Solo hay ${formatNumber(animalFormBaselineQuantity, 0)} disponibles en este potrero para esa especie y categoria.`;
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
      if (animalForm.pricingMode === "kilo" && (!Number.isFinite(weightKg) || weightKg < 0)) {
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
      ? calculateAnimalTotal(
          animalForm.kind,
          animalForm.pricingMode,
          quantity,
          animalForm.pricingMode === "kilo" ? weightKg : 0,
          unitPrice,
          normalizedCommission,
          normalizedTax,
          normalizedFreight
        )
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

    const correctionMovement = isCorrectionMovement
      ? buildStockCorrectionMovement({
          id: nextMovementId,
          date: animalForm.date,
          establishmentId: animalForm.establishmentId,
          fieldId: animalForm.fieldId,
          species: animalForm.species,
          categoryCode: animalForm.categoryCode,
          currentQuantity: animalFormBaselineQuantity,
          targetQuantity: quantity,
          notes: animalForm.notes
        })
      : null;

    const movement: AnimalMovementRecord = {
      id: nextMovementId,
      date: animalForm.date,
      establishmentId: animalForm.establishmentId,
      fieldId: animalForm.fieldId,
      species: animalForm.species,
      categoryCode: animalForm.categoryCode,
      kind: correctionMovement?.kind ?? animalForm.kind,
      quantity: correctionMovement?.quantity ?? quantity,
      earTag: isCattleDeathWithEarTag ? animalForm.earTag.trim() : undefined,
      pricingMode: commercialMovement ? animalForm.pricingMode : undefined,
      weightKg: commercialMovement && animalForm.pricingMode === "kilo" ? weightKg : undefined,
      unitPrice: commercialMovement ? unitPrice : undefined,
      freightAmount: animalForm.kind === "purchase" ? normalizedFreight : undefined,
      commissionAmount: commercialMovement ? normalizedCommission : undefined,
      taxAmount: commercialMovement ? normalizedTax : undefined,
      totalAmount,
      currency: commercialMovement ? animalForm.currency : undefined,
      linkedAccountingEntryId: nextAccountingId,
      pairedTransferMovementId: nextPairedTransferMovementId,
      notes: correctionMovement?.notes ?? animalForm.notes.trim()
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

    // Solo se valida contra el stock real al cargar un tratamiento nuevo.
    // Un registro que se esta editando puede referirse a una categoria que
    // hoy ya no tiene stock en el potrero (se vendieron esos animales
    // despues), y no tiene sentido bloquear la correccion de un dato viejo
    // por eso -- la sanidad es un registro historico, no mueve stock.
    if (!editingSanitaryRecordId) {
      const availableCategory = sanitaryAvailableCategories.find(
        (item) => item.categoryCode === sanitaryForm.categoryCode
      );
      if (!availableCategory) {
        showError("Esa categoria no tiene stock disponible en este potrero.");
        return;
      }
      if (quantity > availableCategory.quantity) {
        showError(`Solo hay ${formatNumber(availableCategory.quantity, 0)} disponibles en este potrero para esa categoria.`);
        return;
      }
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
      categoryCode: sanitaryForm.categoryCode,
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
    const isCorrectionRecord = movement.kind === "correction_in" || movement.kind === "correction_out";

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
      pricingMode: movement.pricingMode ?? "kilo",
      weightKg: movement.weightKg !== undefined ? `${movement.weightKg}` : "",
      unitPrice: movement.unitPrice !== undefined ? `${movement.unitPrice}` : "",
      freightAmount: movement.freightAmount !== undefined ? `${movement.freightAmount}` : "",
      commissionAmount: movement.commissionAmount !== undefined ? `${movement.commissionAmount}` : "",
      taxAmount: movement.taxAmount !== undefined ? `${movement.taxAmount}` : "",
      collectedAmount: movement.kind === "sale" ? `${linkedEntry && linkedEntry.type === "income" ? getIncomeCollectedAmount(linkedEntry) : 0}` : "",
      currency: movement.currency ?? "USD",
      notes: isCorrectionRecord ? movement.notes.replace(/^Correccion manual: de .* a .* animales\.\s*/, "") : movement.notes
    });
    if (isCorrectionRecord) {
      const key = `${movement.fieldId}:${movement.species}:${movement.categoryCode}`;
      const totalAtEditTime = stockBalanceMap.get(key) ?? 0;
      setAnimalForm((current) => ({
        ...current,
        kind: "correction",
        quantity: `${totalAtEditTime}`
      }));
    }
    if (isTransferMovementKind(movement.kind) && movement.pairedTransferMovementId) {
      const pairedMovement = animalMovements.find((item) => item.id === movement.pairedTransferMovementId);
      if (pairedMovement) {
        const sourceEstablishmentId = movement.kind === "transfer_out" ? movement.establishmentId : pairedMovement.establishmentId;
        const destinationEstablishmentId = movement.kind === "transfer_out" ? pairedMovement.establishmentId : movement.establishmentId;
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
      categoryCode: record.categoryCode,
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
    animalForm.kind,
    animalForm.pricingMode,
    parseDecimalInput(animalForm.quantity) || 0,
    animalForm.pricingMode === "kilo" ? parseDecimalInput(animalForm.weightKg) || 0 : 0,
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
        {persistenceMode === "backend" && workspaceSaveStatus !== "idle" ? (
          <div className={`workspace-save-status is-${workspaceSaveStatus}`} role="status" aria-live="polite">
            {workspaceSaveStatus === "pending" ? "Cambios sin guardar todavia..." : null}
            {workspaceSaveStatus === "saving" ? "Guardando cambios..." : null}
            {workspaceSaveStatus === "saved"
              ? `Guardado${
                  workspaceLastSavedAt
                    ? ` (${workspaceLastSavedAt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })})`
                    : ""
                }`
              : null}
            {workspaceSaveStatus === "error" ? workspaceSaveErrorMessage ?? "No se pudo guardar." : null}
          </div>
        ) : null}

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
            onMergeField={handleMergeField}
            onSubmitInitialLoad={handleInitialLoadSubmit}
            onUpdateEstablishmentHectares={handleUpdateEstablishmentHectares}
            onUpdateFieldHectares={handleUpdateFieldHectares}
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
            globalAnimalLedgerRows={globalAnimalLedgerRows}
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
            isCattleDeathWithEarTag={isCattleDeathWithEarTag}
            isCommercialAnimalMovement={isCommercialAnimalMovement}
            isCorrectionAnimalMovement={isCorrectionAnimalMovement}
            correctionCurrentQuantity={animalFormBaselineQuantity}
            projectedAnimalTotal={projectedAnimalTotal}
            transferAvailableSpecies={transferAvailableSpecies}
            transferAvailableCategories={transferAvailableCategories}
            getTransferAvailabilityForField={buildTransferAvailabilityForField}
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
            sanitaryCategoryOptions={sanitaryCategoryOptions}
            sanitarySpeciesAvailableQuantity={sanitarySpeciesAvailableQuantity}
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
                  <h2>Resumen</h2>
                  <p>Sumatoria del mes visible: {visibleMonthRange.label}.</p>
                </div>
              </div>
              <div className="product-shell-nav" role="tablist" aria-label="Tipo de resumen">
                <button
                  type="button"
                  className={summarySubView === "establishment" ? "shell-nav-pill active" : "shell-nav-pill"}
                  onClick={() => setSummarySubView("establishment")}
                >
                  <strong>Por establecimiento</strong>
                </button>
                <button
                  type="button"
                  className={summarySubView === "global" ? "shell-nav-pill active" : "shell-nav-pill"}
                  onClick={() => setSummarySubView("global")}
                >
                  <strong>Global</strong>
                </button>
              </div>
            </article>

            {summarySubView === "establishment" ? (
              <article className="panel wide">
                <div className="panel-header">
                  <div>
                    <h2>Resumen por establecimiento</h2>
                    <p>Elegi un establecimiento y despues Movimiento o Contabilidad para ver esa planilla.</p>
                  </div>
                </div>
                <label className="period-picker">
                  <span>Establecimiento</span>
                  <select
                    value={summaryEstablishmentFilter}
                    onChange={(event) => setSummaryEstablishmentFilter(event.target.value)}
                  >
                    <option value="">Todos</option>
                    {establishments.map((establishment) => (
                      <option key={establishment.id} value={establishment.id}>
                        {establishment.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="period-picker">
                  <span>Movimiento</span>
                  <select
                    value={summaryMovementKindFilter}
                    onChange={(event) => setSummaryMovementKindFilter(event.target.value as SummaryMovementFilterKind | "")}
                  >
                    <option value="">Seleccionar...</option>
                    {(Object.entries(SUMMARY_MOVEMENT_FILTER_LABELS) as Array<[SummaryMovementFilterKind, string]>).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                {summaryMovementKindFilter ? (
                  <div className="table-wrap">
                    <table className="animal-ledger-table animal-ledger-table--movement">
                      <thead>
                        <tr>
                          <th className="cell-date">Fecha</th>
                          <th className="cell-field">Establecimiento</th>
                          <th className="cell-field">Potrero</th>
                          <th className="cell-category">Categoria</th>
                          <th className="cell-number">Cantidad</th>
                          <th className="cell-description">Detalle</th>
                          <th className="cell-money">Monto total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryMovementRows.length ? (
                          summaryMovementRows.map((movement) => {
                            const field = fields.find((item) => item.id === movement.fieldId);
                            const establishment = establishments.find((item) => item.id === movement.establishmentId);
                            const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
                            const detail = describeAnimalMovementDetail(movement, animalMovements, fields);

                            return (
                              <tr key={movement.id}>
                                <td className="cell-date">{formatShortDate(movement.date)}</td>
                                <td className="cell-field">{establishment?.name ?? "-"}</td>
                                <td className="cell-field">{field?.name ?? "-"}</td>
                                <td className="cell-category">{category ? formatCategoryLabel(category.label) : movement.categoryCode}</td>
                                <td className="cell-number">{movement.quantity}</td>
                                <td className="cell-description">{detail ?? (movement.notes.trim() || "-")}</td>
                                <td className="cell-money">
                                  {movement.totalAmount !== undefined ? formatMoney(movement.totalAmount, movement.currency ?? "USD") : "-"}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="cell-empty" colSpan={7}>
                              No hay {SUMMARY_MOVEMENT_FILTER_LABELS[summaryMovementKindFilter].toLowerCase()} para este filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <label className="period-picker summary-filter-divider">
                  <span>Contabilidad</span>
                  <select
                    value={summaryAccountingConceptFilter}
                    onChange={(event) => setSummaryAccountingConceptFilter(event.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <optgroup label="Ingresos">
                      {Object.entries(incomeConceptLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Gastos">
                      {Object.entries(expenseConceptLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>

                {summaryAccountingConceptFilter ? (
                  <>
                    <div className="table-wrap">
                      <table className="animal-ledger-table animal-ledger-table--accounting">
                        <thead>
                          <tr>
                            <th className="cell-field">Mes</th>
                            <th className="cell-money">Total UYU</th>
                            <th className="cell-money">Total USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryAccountingMonthlyTotals.length ? (
                            summaryAccountingMonthlyTotals.map((month) => (
                              <tr key={month.yearMonth}>
                                <td className="cell-field">{month.label}</td>
                                <td className="cell-money">{month.totals.UYU ? formatMoney(month.totals.UYU, "UYU") : "-"}</td>
                                <td className="cell-money">{month.totals.USD ? formatMoney(month.totals.USD, "USD") : "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="cell-empty" colSpan={3}>
                                No hay movimientos de contabilidad para este filtro en {selectedYear}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {summaryAccountingMonthlyTotals.length ? (
                          <tfoot>
                            <tr className="animal-ledger-table-total-row">
                              <td className="cell-field">Total {selectedYear}</td>
                              <td className="cell-money">
                                {summaryAccountingYearTotal.UYU ? formatMoney(summaryAccountingYearTotal.UYU, "UYU") : "-"}
                              </td>
                              <td className="cell-money">
                                {summaryAccountingYearTotal.USD ? formatMoney(summaryAccountingYearTotal.USD, "USD") : "-"}
                              </td>
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>

                    {summaryAccountingYearRows.length ? (
                      <div className="table-wrap">
                        <table className="animal-ledger-table animal-ledger-table--accounting">
                          <thead>
                            <tr>
                              <th className="cell-date">Fecha</th>
                              <th className="cell-field">Establecimiento</th>
                              <th className="cell-category">Rubro</th>
                              <th className="cell-description">Observaciones</th>
                              <th className="cell-money">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryAccountingYearRows.map((entry) => {
                              const establishment = establishments.find((item) => item.id === entry.establishmentId);
                              const conceptLabel =
                                entry.type === "income"
                                  ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
                                  : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels];

                              return (
                                <tr key={entry.id}>
                                  <td className="cell-date">{formatShortDate(entry.date)}</td>
                                  <td className="cell-field">{establishment?.name ?? "-"}</td>
                                  <td className="cell-category">{conceptLabel ?? entry.concept}</td>
                                  <td className="cell-description">{entry.notes.trim() || "-"}</td>
                                  <td className={`cell-money ${entry.type === "income" ? "tone-positive" : "tone-negative"}`}>
                                    {entry.type === "income" ? "+" : "-"}
                                    {formatMoney(entry.netAmount, entry.currency)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            ) : (
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
            )}
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
