import { useEffect, useState } from "react";
import { animalMovementFormKinds, categoryCatalog, currencyLabels, movementKindLabels, speciesLabels } from "./agro.demo.data";
import { formatCategoryLabel, formatMoney, formatNumber, formatShortDate, parseDecimalInput } from "./agro.home.shared";
import {
  AgroSpecies,
  AnimalMovementKind,
  AnimalMovementRecord,
  AnimalPricingMode,
  Establishment,
  FieldUnit,
  MoneyCurrency
} from "./agro.types";

interface AgroAnimalsSectionProps {
  establishments: Establishment[];
  fields: FieldUnit[];
  animalFieldRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLSelectElement | null>>;
  animalForm: {
    date: string;
    establishmentId: string;
    fieldId: string;
    transferDestinationEstablishmentId: string;
    transferDestinationFieldId: string;
    species: AgroSpecies;
    categoryCode: string;
    kind: AnimalMovementKind;
    quantity: string;
    earTag: string;
    pricingMode: AnimalPricingMode;
    weightKg: string;
    unitPrice: string;
    freightAmount: string;
    commissionAmount: string;
    taxAmount: string;
    collectedAmount: string;
    currency: MoneyCurrency;
    notes: string;
  };
  animalFormErrors: Record<string, string>;
  animalFormPanelRef: React.RefObject<HTMLElement | null>;
  animalMovements: AnimalMovementRecord[];
  animalLedgerRows: AnimalMovementRecord[];
  // Igual que animalLedgerRows pero sin el filtro de campo seleccionado --
  // se usa para la tabla "Movimientos recientes" (ver mas abajo), que
  // muestra los ultimos movimientos de cualquier campo/establecimiento sin
  // que el cliente tenga que ir cambiando el filtro para ver ambas puntas
  // de un traslado entre establecimientos distintos.
  globalAnimalLedgerRows: AnimalMovementRecord[];
  // Solo correction_in/correction_out, de siempre (no acotado al mes
  // visible) -- para la "Planilla de stock" separada.
  stockCorrectionRows: AnimalMovementRecord[];
  // Stock real en vivo (fieldId:species:categoryCode -> cantidad), para la
  // columna "Actualidad" de la Planilla de stock -- asi esa columna
  // siempre muestra lo que el potrero tiene AHORA, no solo lo que quedo
  // justo despues de esa correccion puntual (que podria haber cambiado de
  // nuevo despues, ej: otra correccion o movimiento posterior).
  stockBalanceMap: Map<string, number>;
  animalLedgerSummary: {
    purchases: number;
    sales: number;
    stockInternalMoves: number;
    stockIncidents: number;
    linkedCommercialRows: number;
  };
  animalSearchTerm: string;
  animalTableRef: React.RefObject<HTMLTableElement | null>;
  animalTableScrollbarInnerRef: React.RefObject<HTMLDivElement | null>;
  animalTableScrollbarRef: React.RefObject<HTMLDivElement | null>;
  animalTableWrapRef: React.RefObject<HTMLDivElement | null>;
  clearAnimalFieldError: (fieldName: string) => void;
  editingAnimalMovementId: string | null;
  handleAnimalKindChange: (kind: AnimalMovementKind) => void;
  handleAnimalSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCattleDeathWithEarTag: boolean;
  isCommercialAnimalMovement: boolean;
  isCorrectionAnimalMovement: boolean;
  correctionCurrentQuantity: number;
  // categoryCode -> cantidad actual en este potrero/especie, para mostrar
  // "(25)" al lado de cada categoria en el combo, en una Correccion.
  correctionFieldCategoryQuantities: Map<string, number>;
  projectedAnimalTotal: number;
  transferAvailableSpecies: AgroSpecies[];
  transferAvailableCategories: Array<{ categoryCode: string; quantity: number }>;
  // Stock actual en origen/destino para el boton "Ver origen y destino"
  // del traslado (vista previa antes/despues, pedida por el cliente).
  transferOriginCurrentQuantity: number;
  transferDestinationCurrentQuantity: number;
  // Igual que transferOriginAvailability (AgroHomePage) pero parametrizado
  // por un fieldId cualquiera -- hace falta para recalcular especie y
  // categoria EN EL MISMO cambio de estado que el potrero origen (ver
  // onChange de "Potrero origen" mas abajo). Antes esa correccion vivia
  // solo en un useEffect que corria un render despues, dejando una
  // ventana en la que species/categoryCode le quedaban pisados del
  // potrero anterior -- si el usuario guardaba en ese instante, mandaba
  // una categoria invalida para el potrero nuevo (bug intermitente
  // "Esa categoria no tiene stock disponible en el potrero origen").
  getTransferAvailabilityForField: (fieldId: string) => Map<AgroSpecies, Array<{ categoryCode: string; quantity: number }>>;
  registerAnimalFieldRef: (fieldName: string) => (element: HTMLInputElement | HTMLSelectElement | null) => void;
  requestDeleteAnimalMovement: (movementId: string) => void;
  resetAnimalForm: () => void;
  setAnimalForm: React.Dispatch<
    React.SetStateAction<{
      date: string;
      establishmentId: string;
      fieldId: string;
      transferDestinationEstablishmentId: string;
      transferDestinationFieldId: string;
      species: AgroSpecies;
      categoryCode: string;
      kind: AnimalMovementKind;
      quantity: string;
      earTag: string;
      pricingMode: AnimalPricingMode;
      weightKg: string;
      unitPrice: string;
      freightAmount: string;
      commissionAmount: string;
      taxAmount: string;
      collectedAmount: string;
      currency: MoneyCurrency;
      notes: string;
    }>
  >;
  setAnimalSearchTerm: (value: string) => void;
  showAnimalFloatingScrollbar: boolean;
  onEditMovement: (movementId: string) => void;
}

// Desglosa el calculo del monto neto en texto (ej: "10 Vacunos x 200kg x
// $4,50 - $100 comision - $50 IVA = $8.850"), para que quede claro de donde
// sale el numero sin tener que adivinar la formula.
function buildAnimalTotalFormula(
  animalForm: {
    kind: AnimalMovementKind;
    species: AgroSpecies;
    pricingMode: AnimalPricingMode;
    quantity: string;
    weightKg: string;
    unitPrice: string;
    commissionAmount: string;
    taxAmount: string;
    freightAmount: string;
    currency: MoneyCurrency;
  },
  total: number
) {
  const quantity = parseDecimalInput(animalForm.quantity) || 0;
  const weight = parseDecimalInput(animalForm.weightKg) || 0;
  const price = parseDecimalInput(animalForm.unitPrice) || 0;
  const commission = parseDecimalInput(animalForm.commissionAmount) || 0;
  const tax = parseDecimalInput(animalForm.taxAmount) || 0;
  const freight = parseDecimalInput(animalForm.freightAmount) || 0;
  const speciesLabel = speciesLabels[animalForm.species];

  const grossFormula =
    animalForm.pricingMode === "kilo"
      ? `${formatNumber(quantity, 0)} ${speciesLabel} x ${formatNumber(weight, 0)}kg x ${formatMoney(price, animalForm.currency)}`
      : `${formatNumber(quantity, 0)} ${speciesLabel} x ${formatMoney(price, animalForm.currency)}`;

  const adjustments: string[] = [];
  if (animalForm.kind === "sale") {
    if (commission) adjustments.push(`- ${formatMoney(commission, animalForm.currency)} comision`);
    if (tax) adjustments.push(`- ${formatMoney(tax, animalForm.currency)} IVA`);
  } else {
    if (commission) adjustments.push(`+ ${formatMoney(commission, animalForm.currency)} comision`);
    if (tax) adjustments.push(`+ ${formatMoney(tax, animalForm.currency)} IVA`);
    if (freight) adjustments.push(`+ ${formatMoney(freight, animalForm.currency)} flete`);
  }

  return `${grossFormula}${adjustments.length ? ` ${adjustments.join(" ")}` : ""} = ${formatMoney(total, animalForm.currency)}`;
}

export function AgroAnimalsSection({
  establishments,
  fields,
  animalForm,
  animalFormErrors,
  animalFormPanelRef,
  animalMovements,
  animalLedgerRows,
  globalAnimalLedgerRows,
  stockCorrectionRows,
  stockBalanceMap,
  animalLedgerSummary,
  animalSearchTerm,
  animalTableRef,
  animalTableScrollbarInnerRef,
  animalTableScrollbarRef,
  animalTableWrapRef,
  clearAnimalFieldError,
  editingAnimalMovementId,
  handleAnimalKindChange,
  handleAnimalSubmit,
  isCattleDeathWithEarTag,
  isCommercialAnimalMovement,
  isCorrectionAnimalMovement,
  correctionCurrentQuantity,
  correctionFieldCategoryQuantities,
  projectedAnimalTotal,
  transferAvailableSpecies,
  transferAvailableCategories,
  transferOriginCurrentQuantity,
  transferDestinationCurrentQuantity,
  getTransferAvailabilityForField,
  registerAnimalFieldRef,
  requestDeleteAnimalMovement,
  resetAnimalForm,
  setAnimalForm,
  setAnimalSearchTerm,
  showAnimalFloatingScrollbar,
  onEditMovement
}: AgroAnimalsSectionProps) {
  const LEDGER_PREVIEW_COUNT = 5;
  const LEDGER_PREVIEW_STEP = 5;
  const [visibleFilteredCount, setVisibleFilteredCount] = useState(LEDGER_PREVIEW_COUNT);
  const [visibleRecentCount, setVisibleRecentCount] = useState(LEDGER_PREVIEW_COUNT);
  const [showTransferPreview, setShowTransferPreview] = useState(false);

  const visibleFilteredMovements = animalLedgerRows.slice(0, visibleFilteredCount);
  // Las correcciones de stock ya no se muestran aca -- tienen su propia
  // "Planilla de stock" mas abajo (el cliente las encontraba confundibles
  // mezcladas con compras/ventas/traslados de verdad).
  const recentMovementsWithoutCorrections = globalAnimalLedgerRows.filter(
    (movement) => movement.kind !== "correction_in" && movement.kind !== "correction_out"
  );
  const visibleRecentMovements = recentMovementsWithoutCorrections.slice(0, visibleRecentCount);

  // Traslados, nacimientos y muertes -- los motivos "de campo" por los que
  // cambia el rodeo de un potrero, a diferencia de compra/venta que son
  // mas de oficina (el cliente pidio expresamente dejar afuera compra).
  // Planilla chica, sin las columnas de precio/comision/IVA que lo
  // obligaban a desplazar la pantalla para ver todo junto. Mismo alcance
  // de fechas que "Movimientos recientes" (globalAnimalLedgerRows ya viene
  // acotado al mes visible); transfer_in ya viene excluido ahi (es la otra
  // mitad del mismo traslado).
  const fieldMovementRows = globalAnimalLedgerRows.filter(
    (movement) =>
      movement.kind === "transfer_out" ||
      movement.kind === "transfer_internal" ||
      movement.kind === "birth" ||
      movement.kind === "death"
  );

  // Vuelve a la vista compacta cuando cambia la busqueda -- si no, el
  // usuario podia quedar viendo "todos" de una busqueda vieja mezclado con
  // los resultados nuevos.
  useEffect(() => {
    setVisibleFilteredCount(LEDGER_PREVIEW_COUNT);
  }, [animalSearchTerm]);

  const isTransferMovement = animalForm.kind === "transfer";
  const isInternalTransfer = isTransferMovement && animalForm.transferDestinationEstablishmentId === animalForm.establishmentId;
  const selectedEstablishment = establishments.find((item) => item.id === animalForm.establishmentId);
  const selectedFields = fields.filter((item) => item.establishmentId === animalForm.establishmentId);
  const transferDestinations = establishments;
  const transferDestinationFields = fields.filter(
    (item) =>
      item.establishmentId === animalForm.transferDestinationEstablishmentId &&
      (!isInternalTransfer || item.id !== animalForm.fieldId)
  );

  // Datos para el boton "Ver origen y destino": antes/despues de cada lado
  // del traslado, partido a la mitad. "Despues" solo se calcula si ya hay
  // una cantidad valida cargada -- si no, se muestra igual que "antes".
  const transferPreviewQuantity = parseDecimalInput(animalForm.quantity);
  const hasValidTransferPreviewQuantity = Number.isFinite(transferPreviewQuantity) && transferPreviewQuantity > 0;
  const transferOriginAfterQuantity = hasValidTransferPreviewQuantity
    ? transferOriginCurrentQuantity - transferPreviewQuantity
    : transferOriginCurrentQuantity;
  const transferDestinationAfterQuantity = hasValidTransferPreviewQuantity
    ? transferDestinationCurrentQuantity + transferPreviewQuantity
    : transferDestinationCurrentQuantity;
  const transferOriginFieldName = fields.find((item) => item.id === animalForm.fieldId)?.name ?? "-";
  const transferDestinationFieldName = fields.find((item) => item.id === animalForm.transferDestinationFieldId)?.name ?? "-";
  const transferDestinationEstablishmentName =
    establishments.find((item) => item.id === animalForm.transferDestinationEstablishmentId)?.name ?? "-";

  // Recalcula especie/categoria para el potrero origen que se acaba de
  // elegir, en el mismo tick que el cambio de fieldId -- ver el comentario
  // de getTransferAvailabilityForField en la interfaz de props de arriba.
  function resolveSpeciesAndCategoryForOriginField(nextFieldId: string, currentSpecies: AgroSpecies, currentCategoryCode: string) {
    const availability = getTransferAvailabilityForField(nextFieldId);
    const availableSpecies = Array.from(availability.keys());
    const nextSpecies = availableSpecies.includes(currentSpecies) ? currentSpecies : availableSpecies[0] ?? currentSpecies;
    const nextCategories = availability.get(nextSpecies) ?? [];
    const nextCategoryCode = nextCategories.some((item) => item.categoryCode === currentCategoryCode)
      ? currentCategoryCode
      : nextCategories[0]?.categoryCode ?? "";
    return { species: nextSpecies, categoryCode: nextCategoryCode };
  }

  // Toda correccion se crea con buildStockCorrectionMovement
  // (agro.home.shared.ts), que siempre arranca la nota con "Correccion
  // manual: de X a Y animales." -- de ahi se sacan los numeros de antes y
  // despues para la Planilla de stock, sin tener que recalcular el
  // historial de nuevo aca.
  function getCorrectionBeforeAfter(movement: AnimalMovementRecord) {
    const match = movement.notes.match(/de (-?\d+) a (-?\d+) animales/);
    if (!match) {
      return null;
    }
    return { before: Number(match[1]), after: Number(match[2]) };
  }

  // El resto de la nota (lo que haya tipeado el usuario), sin el prefijo
  // automatico -- para mostrar el motivo real en la Planilla de stock.
  function getCorrectionReason(movement: AnimalMovementRecord) {
    return movement.notes.replace(/^Correccion manual: de -?\d+ a -?\d+ animales\.\s*/, "").trim();
  }

  // Stock real de HOY para ese potrero/especie/categoria (columna
  // "Actualidad") -- distinto del "despues" que quedo grabado en la nota
  // de esa correccion puntual, que puede haber cambiado de nuevo desde
  // entonces.
  function getCorrectionCurrentQuantity(movement: AnimalMovementRecord) {
    return stockBalanceMap.get(`${movement.fieldId}:${movement.species}:${movement.categoryCode}`) ?? 0;
  }

  // "Traslado" es la fila de salida (transfer_out) y "Ingreso" es la fila
  // de llegada (transfer_in) del mismo movimiento -- antes las dos decian
  // "Traslado" a secas, y sin mirar la fecha no se sabia si esa fila era
  // la salida o la llegada.
  function getMovementLabel(movement: AnimalMovementRecord) {
    if (movement.kind === "transfer_out" || movement.kind === "transfer_internal") {
      return "Traslado";
    }
    if (movement.kind === "transfer_in") {
      return "Ingreso";
    }

    return movementKindLabels[movement.kind as keyof typeof movementKindLabels];
  }

  type LugarOrigenDestino = {
    campoOrigen: string;
    potreroOrigen: string;
    campoDestino: string;
    potreroDestino: string;
  };

  // Arma las 4 columnas de origen/destino para que cada fila se lea como
  // un renglon de cuenta corriente, sin tener que adivinar que campo es
  // el propio y cual es "el otro" (antes una sola columna mezclaba campo
  // y potrero en un mismo texto -- ej: "Personal / Bermuda" -- y se leia
  // como si hubiera 3 potreros en vez de 2).
  function getOrigenDestino(movement: AnimalMovementRecord): LugarOrigenDestino {
    const ownEstablishment = establishments.find((item) => item.id === movement.establishmentId);
    const ownField = fields.find((item) => item.id === movement.fieldId);
    const propio = { campo: ownEstablishment?.name ?? "-", potrero: ownField?.name ?? "-" };

    const vacio: LugarOrigenDestino = { campoOrigen: "-", potreroOrigen: "-", campoDestino: "-", potreroDestino: "-" };

    // Traslados: el origen/destino real es SIEMPRE la otra punta del par,
    // nunca el propio campo/potrero de la fila.
    if (movement.kind === "transfer_out" || movement.kind === "transfer_in" || movement.kind === "transfer_internal") {
      const pairedMovement = movement.pairedTransferMovementId
        ? animalMovements.find((item) => item.id === movement.pairedTransferMovementId)
        : undefined;
      const pairedEstablishment = pairedMovement ? establishments.find((item) => item.id === pairedMovement.establishmentId) : undefined;
      const pairedField = pairedMovement ? fields.find((item) => item.id === pairedMovement.fieldId) : undefined;
      const contraparte = { campo: pairedEstablishment?.name ?? "-", potrero: pairedField?.name ?? "-" };

      return movement.kind === "transfer_in"
        ? { campoOrigen: contraparte.campo, potreroOrigen: contraparte.potrero, campoDestino: propio.campo, potreroDestino: propio.potrero }
        : { campoOrigen: propio.campo, potreroOrigen: propio.potrero, campoDestino: contraparte.campo, potreroDestino: contraparte.potrero };
    }

    // Movimientos que suman animales al potrero (entran): compra,
    // nacimiento, correccion hacia arriba -- el potrero propio es el
    // destino, no hay origen (viene de afuera del sistema).
    if (movement.kind === "purchase" || movement.kind === "birth" || movement.kind === "correction_in") {
      return { ...vacio, campoDestino: propio.campo, potreroDestino: propio.potrero };
    }

    // Movimientos que restan animales del potrero (salen): venta, muerte,
    // faltante, correccion hacia abajo -- el potrero propio es el origen,
    // no hay destino (se va afuera del sistema).
    if (movement.kind === "sale" || movement.kind === "death" || movement.kind === "shortage" || movement.kind === "correction_out") {
      return { ...vacio, campoOrigen: propio.campo, potreroOrigen: propio.potrero };
    }

    // Ajuste / correccion generica: no tienen una direccion fija (pueden
    // sumar o restar), asi que no se fuerza un origen/destino inventado.
    return vacio;
  }

  // Reusada por la tabla "Movimientos recientes" (sin filtro de campo) y
  // por la "Planilla de animales" (filtrada) para que ambas muestren
  // exactamente lo mismo por fila -- una sola fuente de verdad para el
  // origen/destino y el resto de las columnas.
  function renderLedgerRow(movement: AnimalMovementRecord) {
    const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
    const lugar = getOrigenDestino(movement);
    return (
      <tr key={movement.id}>
        <td className="cell-date">{formatShortDate(movement.date)}</td>
        <td className="cell-kind">{getMovementLabel(movement)}</td>
        <td className="cell-field">{lugar.campoOrigen}</td>
        <td className="cell-field">{lugar.potreroOrigen}</td>
        <td className="cell-field">{lugar.campoDestino}</td>
        <td className="cell-field">{lugar.potreroDestino}</td>
        <td className="cell-description">{movement.notes.trim() || "-"}</td>
        <td className="cell-number">{movement.quantity}</td>
        <td className="cell-category">{category ? formatCategoryLabel(category.label) : movement.categoryCode}</td>
        <td className="cell-tag">{movement.earTag ?? "-"}</td>
        <td className="cell-number">{formatNumber(movement.weightKg)}</td>
        <td className="cell-money">
          {movement.unitPrice !== undefined ? formatMoney(movement.unitPrice, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.freightAmount !== undefined ? formatMoney(movement.freightAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.commissionAmount !== undefined ? formatMoney(movement.commissionAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.taxAmount !== undefined ? formatMoney(movement.taxAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-money">
          {movement.totalAmount !== undefined ? formatMoney(movement.totalAmount, movement.currency ?? "USD") : "-"}
        </td>
        <td className="cell-link">
          <span className={movement.linkedAccountingEntryId ? "data-badge accent compact" : "data-badge compact"}>
            {movement.linkedAccountingEntryId ? "Si" : "No"}
          </span>
        </td>
        <td className="cell-actions">
          <div className="table-actions">
            <button type="button" className="ghost-button" onClick={() => onEditMovement(movement.id)}>
              Editar
            </button>
            <button type="button" className="ghost-button danger" onClick={() => requestDeleteAnimalMovement(movement.id)}>
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Exporta exactamente lo que muestra "Planilla de animales" en este
  // momento: ya viene filtrada por Campo/Potrero visible (arriba de todo) y
  // Ano/Mes visible, mas lo que se haya tipeado en "Buscar en animales"
  // (categoria incluida). No hace falta filtrar de nuevo aca.
  async function exportAnimalLedgerToExcel() {
    // Import dinamico: exceljs es pesada (~930kb) y el boton se usa de vez
    // en cuando, no tiene sentido sumarla a la carga inicial de toda la app.
    const ExcelJS = (await import("exceljs")).default;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SaasPro Agro";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Planilla de animales", {
      views: [{ state: "frozen", ySplit: 1 }]
    });

    const headerRow = sheet.getRow(1);
    headerRow.values = [
      "Fecha",
      "Movimiento",
      "Campo origen",
      "Potrero origen",
      "Campo destino",
      "Potrero destino",
      "Descripcion",
      "Cantidad",
      "Categoria",
      "Caravana",
      "Peso",
      "Precio",
      "Flete",
      "Comision",
      "IVA",
      "Monto total",
      "Moneda",
      "Relacion contable"
    ];
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFDF7" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF217346" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    for (const movement of animalLedgerRows) {
      const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
      const lugar = getOrigenDestino(movement);
      const currency = movement.currency ?? "USD";

      const row = sheet.addRow([
        new Date(`${movement.date}T00:00:00`),
        getMovementLabel(movement),
        lugar.campoOrigen,
        lugar.potreroOrigen,
        lugar.campoDestino,
        lugar.potreroDestino,
        movement.notes.trim() || "-",
        movement.quantity,
        category ? formatCategoryLabel(category.label) : movement.categoryCode,
        movement.earTag ?? "-",
        movement.weightKg ?? null,
        movement.unitPrice ?? null,
        movement.freightAmount ?? null,
        movement.commissionAmount ?? null,
        movement.taxAmount ?? null,
        movement.totalAmount ?? null,
        movement.totalAmount !== undefined ? currency : "",
        movement.linkedAccountingEntryId ? "Si" : "No"
      ]);

      row.getCell(1).numFmt = "dd/mm/yyyy";
      row.getCell(8).numFmt = "#,##0";
      for (const columnIndex of [11, 12, 13, 14, 15, 16]) {
        row.getCell(columnIndex).numFmt = "#,##0.00";
      }
      row.eachCell((cell) => {
        cell.border = { bottom: { style: "hair", color: { argb: "FFE1DCC8" } } };
      });
    }

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 18 } };
    sheet.columns = [
      { width: 12 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 32 },
      { width: 10 },
      { width: 28 },
      { width: 12 },
      { width: 10 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
      { width: 9 },
      { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `planilla-animales-${today}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Mismo criterio que exportAnimalLedgerToExcel: exporta exactamente lo
  // que muestra "Planilla de animales" en este momento (menos columna
  // "Relacion contable", que no aporta nada en un PDF para imprimir).
  async function exportAnimalLedgerToPdf() {
    const { exportRowsToPdf } = await import("./agro.exportPdf");
    const rows = animalLedgerRows.map((movement) => {
      const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
      const lugar = getOrigenDestino(movement);
      const currency = movement.currency ?? "USD";

      return [
        formatShortDate(movement.date),
        getMovementLabel(movement),
        lugar.campoOrigen,
        lugar.potreroOrigen,
        lugar.campoDestino,
        lugar.potreroDestino,
        movement.quantity,
        category ? formatCategoryLabel(category.label) : movement.categoryCode,
        movement.totalAmount !== undefined ? formatMoney(movement.totalAmount, currency) : "-"
      ];
    });

    await exportRowsToPdf({
      title: "Planilla de animales",
      subtitle: `${rows.length} movimiento(s)`,
      columns: [
        "Fecha",
        "Movimiento",
        "Campo origen",
        "Potrero origen",
        "Campo destino",
        "Potrero destino",
        "Cantidad",
        "Categoria",
        "Monto total"
      ],
      rows,
      fileName: `planilla-animales-${new Date().toISOString().slice(0, 10)}.pdf`
    });
  }

  // Filas de la Planilla de stock, compartidas entre la tabla y los dos
  // exports -- cada correccion ya trae antes/despues en la nota (ver
  // getCorrectionBeforeAfter).
  function buildStockCorrectionExportRows() {
    return stockCorrectionRows.map((movement) => {
      const field = fields.find((item) => item.id === movement.fieldId);
      const establishment = establishments.find((item) => item.id === field?.establishmentId);
      const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
      const beforeAfter = getCorrectionBeforeAfter(movement);
      return [
        movement.date,
        establishment?.name ?? "-",
        field?.name ?? "-",
        speciesLabels[movement.species],
        category ? formatCategoryLabel(category.label) : movement.categoryCode || "-",
        beforeAfter?.before ?? "-",
        getCorrectionCurrentQuantity(movement),
        movement.kind === "correction_in" ? `+${movement.quantity}` : `-${movement.quantity}`,
        getCorrectionReason(movement) || "-"
      ];
    });
  }

  async function exportStockCorrectionsToExcel() {
    const { exportRowsToExcel } = await import("./agro.exportExcel");
    await exportRowsToExcel({
      sheetName: "Planilla de stock",
      columns: [
        { header: "Fecha", width: 12, numFmt: "dd/mm/yyyy" },
        { header: "Campo", width: 18 },
        { header: "Potrero", width: 18 },
        { header: "Especie", width: 12 },
        { header: "Categoria", width: 24 },
        { header: "Antes", width: 10, numFmt: "#,##0" },
        { header: "Actualidad", width: 12, numFmt: "#,##0" },
        { header: "Diferencia", width: 12 },
        { header: "Motivo", width: 40 }
      ],
      rows: buildStockCorrectionExportRows().map((row) => [new Date(`${row[0]}T00:00:00`), ...row.slice(1)]),
      fileName: `planilla-stock-${new Date().toISOString().slice(0, 10)}.xlsx`
    });
  }

  async function exportStockCorrectionsToPdf() {
    const { exportRowsToPdf } = await import("./agro.exportPdf");
    const rows = buildStockCorrectionExportRows();
    await exportRowsToPdf({
      title: "Planilla de stock",
      subtitle: `${rows.length} correccion(es)`,
      columns: ["Fecha", "Campo", "Potrero", "Especie", "Categoria", "Antes", "Actualidad", "Diferencia", "Motivo"],
      rows: rows.map((row) => [formatShortDate(String(row[0])), ...row.slice(1)]),
      fileName: `planilla-stock-${new Date().toISOString().slice(0, 10)}.pdf`
    });
  }

  // Filas de la Planilla de movimientos de campo, compartidas entre la
  // tabla y los dos exports.
  function buildFieldMovementExportRows() {
    return fieldMovementRows.map((movement) => {
      const lugar = getOrigenDestino(movement);
      const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
      const currency = movement.currency ?? "USD";
      return [
        movement.date,
        getMovementLabel(movement),
        `${lugar.campoOrigen} / ${lugar.potreroOrigen}`,
        `${lugar.campoDestino} / ${lugar.potreroDestino}`,
        `${speciesLabels[movement.species]} · ${category ? formatCategoryLabel(category.label) : movement.categoryCode}`,
        movement.quantity,
        movement.freightAmount !== undefined ? formatMoney(movement.freightAmount, currency) : "-"
      ];
    });
  }

  async function exportFieldMovementsToExcel() {
    const { exportRowsToExcel } = await import("./agro.exportExcel");
    await exportRowsToExcel({
      sheetName: "Planilla de movimientos de campo",
      columns: [
        { header: "Fecha", width: 12, numFmt: "dd/mm/yyyy" },
        { header: "Motivo", width: 14 },
        { header: "Origen", width: 26 },
        { header: "Destino", width: 26 },
        { header: "Categoria", width: 28 },
        { header: "Cantidad", width: 10, numFmt: "#,##0" },
        { header: "Flete", width: 14 }
      ],
      rows: buildFieldMovementExportRows().map((row) => [new Date(`${row[0]}T00:00:00`), ...row.slice(1)]),
      fileName: `planilla-movimientos-campo-${new Date().toISOString().slice(0, 10)}.xlsx`
    });
  }

  async function exportFieldMovementsToPdf() {
    const { exportRowsToPdf } = await import("./agro.exportPdf");
    const rows = buildFieldMovementExportRows();
    await exportRowsToPdf({
      title: "Planilla de movimientos de campo",
      subtitle: `${rows.length} movimiento(s)`,
      columns: ["Fecha", "Motivo", "Origen", "Destino", "Categoria", "Cantidad", "Flete"],
      rows: rows.map((row) => [formatShortDate(String(row[0])), ...row.slice(1)]),
      fileName: `planilla-movimientos-campo-${new Date().toISOString().slice(0, 10)}.pdf`
    });
  }

  // Las tres tablas de mas abajo se arman una sola vez aca (no directo en el
  // JSX del return) para poder reordenarlas segun el Movimiento elegido en
  // el formulario, sin duplicar el markup -- ver el uso mas abajo.
  const planillaDeAnimalesPanel = (
    <article className="panel wide">
      <div className="panel-header">
        <div>
          <h2>Planilla de animales</h2>
          <p>Vista de trabajo para revisar compras, ventas y movimientos del rodeo, filtrada por el campo/potrero seleccionado.</p>
        </div>
        <div className="table-actions">
          <button
            type="button"
            className="ghost-button excel-button"
            onClick={() => void exportAnimalLedgerToExcel()}
            disabled={animalLedgerRows.length === 0}
          >
            Exportar a Excel
          </button>
          <button
            type="button"
            className="ghost-button pdf-button"
            onClick={() => void exportAnimalLedgerToPdf()}
            disabled={animalLedgerRows.length === 0}
          >
            Exportar a PDF
          </button>
        </div>
      </div>
      <div className="inline-metrics">
        <span className="data-badge">Compras {animalLedgerSummary.purchases}</span>
        <span className="data-badge">Ventas {animalLedgerSummary.sales}</span>
        <span className="data-badge">Traslados {animalLedgerSummary.stockInternalMoves}</span>
        <span className="data-badge">Nacimientos, muertes y faltantes {animalLedgerSummary.stockIncidents}</span>
        <span className="data-badge accent">Relacionados a contabilidad {animalLedgerSummary.linkedCommercialRows}</span>
      </div>
      <label className="table-search">
        <span>Buscar en animales</span>
        <input
          type="search"
          placeholder="Campo, potrero, categoria, especie, fecha o nota..."
          value={animalSearchTerm}
          onChange={(event) => setAnimalSearchTerm(event.target.value)}
        />
      </label>
      <div ref={animalTableWrapRef} className="table-wrap floating-scroll-host">
        <table ref={animalTableRef} className="animal-ledger-table">
          <thead>
            <tr>
              <th className="cell-date">Fecha</th>
              <th className="cell-kind">Movimiento</th>
              <th className="cell-field">Campo origen</th>
              <th className="cell-field">Potrero origen</th>
              <th className="cell-field">Campo destino</th>
              <th className="cell-field">Potrero destino</th>
              <th className="cell-description">Descripcion</th>
              <th className="cell-number">Cantidad</th>
              <th className="cell-category">Categoria</th>
              <th className="cell-tag">Caravana</th>
              <th className="cell-number">Peso</th>
              <th className="cell-money">Precio</th>
              <th className="cell-money">Flete</th>
              <th className="cell-money">Comision</th>
              <th className="cell-money">IVA</th>
              <th className="cell-money">Monto total</th>
              <th className="cell-link">Relacion contable</th>
              <th className="cell-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleFilteredMovements.length ? (
              visibleFilteredMovements.map((movement) => renderLedgerRow(movement))
            ) : (
              <tr>
                <td className="cell-empty" colSpan={17}>
                  No hay movimientos para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        ref={animalTableScrollbarRef}
        className={showAnimalFloatingScrollbar ? "floating-table-scrollbar" : "floating-table-scrollbar hidden"}
      >
        <div ref={animalTableScrollbarInnerRef} className="floating-table-scrollbar-inner" />
      </div>
      {animalLedgerRows.length > LEDGER_PREVIEW_COUNT ? (
        <div className="action-row">
          {visibleFilteredCount < animalLedgerRows.length ? (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setVisibleFilteredCount((current) => Math.min(current + LEDGER_PREVIEW_STEP, animalLedgerRows.length))}
              >
                Ver 5 más
              </button>
              <button type="button" className="ghost-button" onClick={() => setVisibleFilteredCount(animalLedgerRows.length)}>
                Ver todos ({animalLedgerRows.length})
              </button>
            </>
          ) : (
            <button type="button" className="ghost-button" onClick={() => setVisibleFilteredCount(LEDGER_PREVIEW_COUNT)}>
              Ver menos
            </button>
          )}
        </div>
      ) : null}
    </article>
  );

  const planillaDeStockPanel = (
    <article className="panel wide">
      <div className="panel-header">
        <div>
          <h2>Planilla de stock</h2>
          <p>Correcciones de stock, de todos los campos.</p>
        </div>
        <div className="table-actions">
          <button
            type="button"
            className="ghost-button excel-button"
            onClick={() => void exportStockCorrectionsToExcel()}
            disabled={stockCorrectionRows.length === 0}
          >
            Excel
          </button>
          <button
            type="button"
            className="ghost-button pdf-button"
            onClick={() => void exportStockCorrectionsToPdf()}
            disabled={stockCorrectionRows.length === 0}
          >
            PDF
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="animal-ledger-table">
          <thead>
            <tr>
              <th className="cell-date">Fecha</th>
              <th className="cell-field">Campo</th>
              <th className="cell-field">Potrero</th>
              <th>Especie</th>
              <th className="cell-category">Categoria</th>
              <th className="cell-number">Antes</th>
              <th className="cell-number">Actualidad</th>
              <th className="cell-number">Diferencia</th>
              <th className="cell-description">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {stockCorrectionRows.length ? (
              stockCorrectionRows.map((movement) => {
                const field = fields.find((item) => item.id === movement.fieldId);
                const establishment = establishments.find((item) => item.id === field?.establishmentId);
                const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
                const beforeAfter = getCorrectionBeforeAfter(movement);
                const isEntry = movement.kind === "correction_in";
                return (
                  <tr key={movement.id}>
                    <td>{formatShortDate(movement.date)}</td>
                    <td>{establishment?.name ?? "-"}</td>
                    <td>{field?.name ?? "-"}</td>
                    <td>{speciesLabels[movement.species]}</td>
                    <td>{category ? formatCategoryLabel(category.label) : movement.categoryCode || "-"}</td>
                    <td className="cell-number">{beforeAfter ? formatNumber(beforeAfter.before, 0) : "-"}</td>
                    <td className="cell-number">{formatNumber(getCorrectionCurrentQuantity(movement), 0)}</td>
                    <td className={`cell-number ${isEntry ? "tone-positive" : "tone-negative"}`}>
                      {isEntry ? "+" : "-"}
                      {formatNumber(movement.quantity, 0)}
                    </td>
                    <td>{getCorrectionReason(movement) || "-"}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="cell-empty" colSpan={9}>
                  Todavia no hay correcciones de stock cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );

  const planillaDeMovimientosCampoPanel = (
    <article className="panel wide">
      <div className="panel-header">
        <div>
          <h2>Planilla de movimientos de campo</h2>
          <p>Traslados, nacimientos y muertes: fecha, motivo, origen, destino y cantidad, sin compras ni ventas.</p>
        </div>
        <div className="table-actions">
          <button
            type="button"
            className="ghost-button excel-button"
            onClick={() => void exportFieldMovementsToExcel()}
            disabled={fieldMovementRows.length === 0}
          >
            Excel
          </button>
          <button
            type="button"
            className="ghost-button pdf-button"
            onClick={() => void exportFieldMovementsToPdf()}
            disabled={fieldMovementRows.length === 0}
          >
            PDF
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="animal-ledger-table">
          <thead>
            <tr>
              <th className="cell-date">Fecha</th>
              <th className="cell-kind">Motivo</th>
              <th className="cell-field">Origen</th>
              <th className="cell-field">Destino</th>
              <th className="cell-category">Categoria</th>
              <th className="cell-number">Cantidad</th>
              <th className="cell-money">Flete</th>
              <th className="cell-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {fieldMovementRows.length ? (
              fieldMovementRows.map((movement) => {
                const lugar = getOrigenDestino(movement);
                const category = categoryCatalog[movement.species].find((item) => item.code === movement.categoryCode);
                const currency = movement.currency ?? "USD";
                return (
                  <tr key={movement.id}>
                    <td>{formatShortDate(movement.date)}</td>
                    <td>{getMovementLabel(movement)}</td>
                    <td>
                      {lugar.campoOrigen} / {lugar.potreroOrigen}
                    </td>
                    <td>
                      {lugar.campoDestino} / {lugar.potreroDestino}
                    </td>
                    <td>
                      {speciesLabels[movement.species]} · {category ? formatCategoryLabel(category.label) : movement.categoryCode}
                    </td>
                    <td className="cell-number">{formatNumber(movement.quantity, 0)}</td>
                    <td className="cell-money">
                      {movement.freightAmount !== undefined ? formatMoney(movement.freightAmount, currency) : "-"}
                    </td>
                    <td className="cell-actions">
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => onEditMovement(movement.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => requestDeleteAnimalMovement(movement.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="cell-empty" colSpan={8}>
                  No hay traslados, nacimientos ni muertes en el rango de fechas visible.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );

  return (
    <section className="content-grid">
      <article ref={animalFormPanelRef} className="panel">
        <div className="panel-header">
          <div>
            <h2>Cargar movimiento de animales</h2>
            <p>Alta de compras, ventas, nacimientos, muertes, traslados, faltantes, ajustes o correcciones de stock.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleAnimalSubmit}>
          <label className={animalFormErrors.date ? "field-error" : undefined}>
            <span>Fecha</span>
            <input
              ref={registerAnimalFieldRef("date")}
              type="date"
              value={animalForm.date}
              onChange={(event) => {
                clearAnimalFieldError("date");
                setAnimalForm((current) => ({ ...current, date: event.target.value }));
              }}
            />
          </label>
          <label className={animalFormErrors.kind ? "field-error" : undefined}>
            <span>Movimiento</span>
            <select
              ref={registerAnimalFieldRef("kind")}
              value={animalForm.kind}
              onChange={(event) => handleAnimalKindChange(event.target.value as AnimalMovementKind)}
            >
              {animalMovementFormKinds.map((value) => (
                <option key={value} value={value}>
                  {movementKindLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Campo origen</span>
            <div className="readonly-field">{selectedEstablishment?.name ?? "-"}</div>
          </label>
          {isTransferMovement ? (
            <label className={animalFormErrors.transferDestinationEstablishmentId ? "field-error" : undefined}>
              <span>Campo destino</span>
              <select
                ref={registerAnimalFieldRef("transferDestinationEstablishmentId")}
                value={animalForm.transferDestinationEstablishmentId}
                onChange={(event) => {
                  clearAnimalFieldError("transferDestinationEstablishmentId");
                  const nextEstablishmentId = event.target.value;
                  setAnimalForm((current) => ({
                    ...current,
                    transferDestinationEstablishmentId: nextEstablishmentId,
                    transferDestinationFieldId:
                      nextEstablishmentId === current.establishmentId
                        ? fields.find((item) => item.establishmentId === nextEstablishmentId && item.id !== current.fieldId)?.id ?? ""
                        : fields.find((item) => item.establishmentId === nextEstablishmentId)?.id ?? ""
                  }));
                }}
              >
                {transferDestinations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isInternalTransfer ? (
            <div className="form-grid span-2">
              <label className={animalFormErrors.fieldId ? "field-error" : undefined}>
                <span>Potrero origen</span>
                <select
                  ref={registerAnimalFieldRef("fieldId")}
                  value={animalForm.fieldId}
                  onChange={(event) => {
                    clearAnimalFieldError("fieldId");
                    const nextFieldId = event.target.value;
                    setAnimalForm((current) => ({
                      ...current,
                      fieldId: nextFieldId,
                      ...resolveSpeciesAndCategoryForOriginField(nextFieldId, current.species, current.categoryCode),
                      transferDestinationFieldId:
                        current.transferDestinationEstablishmentId === current.establishmentId &&
                        current.transferDestinationFieldId === nextFieldId
                          ? selectedFields.find((item) => item.id !== nextFieldId)?.id ?? ""
                          : current.transferDestinationEstablishmentId === current.establishmentId &&
                              !selectedFields.some(
                                (item) => item.id === current.transferDestinationFieldId && item.id !== nextFieldId
                              )
                            ? selectedFields.find((item) => item.id !== nextFieldId)?.id ?? ""
                            : current.transferDestinationFieldId
                    }));
                  }}
                >
                  {selectedFields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={animalFormErrors.transferDestinationFieldId ? "field-error" : undefined}>
                <span>Potrero destino</span>
                <select
                  ref={registerAnimalFieldRef("transferDestinationFieldId")}
                  value={animalForm.transferDestinationFieldId}
                  onChange={(event) => {
                    clearAnimalFieldError("transferDestinationFieldId");
                    setAnimalForm((current) => ({ ...current, transferDestinationFieldId: event.target.value }));
                  }}
                >
                  {transferDestinationFields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className={animalFormErrors.fieldId ? "field-error" : undefined}>
              <span>Potrero origen</span>
              <select
                ref={registerAnimalFieldRef("fieldId")}
                value={animalForm.fieldId}
                onChange={(event) => {
                  clearAnimalFieldError("fieldId");
                  const nextFieldId = event.target.value;
                  setAnimalForm((current) => ({
                    ...current,
                    fieldId: nextFieldId,
                    ...(isTransferMovement
                      ? resolveSpeciesAndCategoryForOriginField(nextFieldId, current.species, current.categoryCode)
                      : null)
                  }));
                }}
              >
                {selectedFields.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isTransferMovement && !isInternalTransfer ? (
            <label className={animalFormErrors.transferDestinationFieldId ? "field-error" : undefined}>
              <span>Potrero destino</span>
              <select
                ref={registerAnimalFieldRef("transferDestinationFieldId")}
                value={animalForm.transferDestinationFieldId}
                onChange={(event) => {
                  clearAnimalFieldError("transferDestinationFieldId");
                  setAnimalForm((current) => ({ ...current, transferDestinationFieldId: event.target.value }));
                }}
              >
                {transferDestinationFields.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={animalFormErrors.species ? "field-error" : undefined}>
            <span>Especie</span>
            <select
              ref={registerAnimalFieldRef("species")}
              value={animalForm.species}
              onChange={(event) => {
                clearAnimalFieldError("species");
                const nextSpecies = event.target.value as AgroSpecies;
                setAnimalForm((current) => {
                  if (!isTransferMovement) {
                    return { ...current, species: nextSpecies, categoryCode: categoryCatalog[nextSpecies][0]?.code ?? "" };
                  }
                  // En un traslado la categoria tiene que salir de lo que
                  // realmente hay en el potrero origen para esa especie, no
                  // de la primera del catalogo completo (que puede no tener
                  // stock ahi -- mismo bug que el potrero origen, ver arriba).
                  const nextCategories = getTransferAvailabilityForField(current.fieldId).get(nextSpecies) ?? [];
                  return { ...current, species: nextSpecies, categoryCode: nextCategories[0]?.categoryCode ?? "" };
                });
              }}
            >
              {(isTransferMovement
                ? transferAvailableSpecies
                : (Object.keys(speciesLabels) as AgroSpecies[])
              ).map((value) => (
                <option key={value} value={value}>
                  {speciesLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className={animalFormErrors.categoryCode ? "field-error" : undefined}>
            <span>Categoria</span>
            <select
              ref={registerAnimalFieldRef("categoryCode")}
              value={animalForm.categoryCode}
              onChange={(event) => {
                clearAnimalFieldError("categoryCode");
                setAnimalForm((current) => ({ ...current, categoryCode: event.target.value }));
              }}
            >
              {(isTransferMovement
                ? transferAvailableCategories.map((entry) => {
                    const category = categoryCatalog[animalForm.species].find((item) => item.code === entry.categoryCode);
                    return {
                      code: entry.categoryCode,
                      label: category ? `${category.label} (${formatNumber(entry.quantity, 0)} disponibles)` : entry.categoryCode
                    };
                  })
                : categoryCatalog[animalForm.species].map((category) => ({
                    code: category.code,
                    label: isCorrectionAnimalMovement
                      ? `${category.label} (${formatNumber(correctionFieldCategoryQuantities.get(category.code) ?? 0, 0)})`
                      : category.label
                  }))
              ).map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className={animalFormErrors.quantity ? "field-error" : undefined}>
            <span>{isCorrectionAnimalMovement ? "Cantidad correcta (total real)" : "Cantidad"}</span>
            <input
              ref={registerAnimalFieldRef("quantity")}
              type="text"
              inputMode="numeric"
              min="0"
              value={animalForm.quantity}
              onChange={(event) => {
                clearAnimalFieldError("quantity");
                setAnimalForm((current) => ({ ...current, quantity: event.target.value }));
              }}
            />
            {isCorrectionAnimalMovement ? (
              <small>
                {`El sistema muestra ${formatNumber(correctionCurrentQuantity, 0)} en este potrero para esta especie y categoria. Al guardar, se ajusta sola la diferencia.`}
              </small>
            ) : null}
          </label>
          {isTransferMovement ? (
            <div className="span-2 transfer-preview">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowTransferPreview((current) => !current)}
              >
                {showTransferPreview ? "Ocultar origen y destino" : "Ver origen y destino"}
              </button>

              {showTransferPreview ? (
                <div className="transfer-preview__split">
                  <div className="transfer-preview__side transfer-preview__side--origin">
                    <span className="transfer-preview__label">Origen</span>
                    <strong className="transfer-preview__place">
                      {selectedEstablishment?.name ?? "-"} / {transferOriginFieldName}
                    </strong>
                    <div className="transfer-preview__numbers">
                      <span>Antes: {formatNumber(transferOriginCurrentQuantity, 0)}</span>
                      <span className="tone-negative">Despues: {formatNumber(transferOriginAfterQuantity, 0)}</span>
                    </div>
                  </div>
                  <div className="transfer-preview__arrow" aria-hidden="true">
                    →
                  </div>
                  <div className="transfer-preview__side transfer-preview__side--destination">
                    <span className="transfer-preview__label">Destino</span>
                    <strong className="transfer-preview__place">
                      {transferDestinationEstablishmentName} / {transferDestinationFieldName}
                    </strong>
                    <div className="transfer-preview__numbers">
                      <span>Antes: {formatNumber(transferDestinationCurrentQuantity, 0)}</span>
                      <span className="tone-positive">Despues: {formatNumber(transferDestinationAfterQuantity, 0)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {isCattleDeathWithEarTag ? (
            <label className={animalFormErrors.earTag ? "field-error" : undefined}>
              <span>Numero de caravana</span>
              <input
                ref={registerAnimalFieldRef("earTag")}
                type="text"
                placeholder="Ej. UY-458921"
                value={animalForm.earTag}
                onChange={(event) => {
                  clearAnimalFieldError("earTag");
                  setAnimalForm((current) => ({ ...current, earTag: event.target.value }));
                }}
              />
            </label>
          ) : null}
          {isCommercialAnimalMovement ? (
            <>
              <label>
                <span>Modalidad de venta</span>
                <select
                  value={animalForm.pricingMode}
                  onChange={(event) => {
                    clearAnimalFieldError("weightKg");
                    setAnimalForm((current) => ({ ...current, pricingMode: event.target.value as AnimalPricingMode }));
                  }}
                >
                  <option value="kilo">Por kilo</option>
                  <option value="unidad">Por unidad</option>
                </select>
              </label>
              {animalForm.pricingMode === "kilo" ? (
                <label className={animalFormErrors.weightKg ? "field-error" : undefined}>
                  <span>Peso individual (kg)</span>
                  <input
                    ref={registerAnimalFieldRef("weightKg")}
                    type="text"
                    inputMode="decimal"
                    value={animalForm.weightKg}
                    onChange={(event) => {
                      clearAnimalFieldError("weightKg");
                      setAnimalForm((current) => ({ ...current, weightKg: event.target.value }));
                    }}
                  />
                  <small>Se multiplica por la cantidad para obtener el peso total.</small>
                </label>
              ) : null}
              <label className={animalFormErrors.unitPrice ? "field-error" : undefined}>
                <span>{animalForm.pricingMode === "kilo" ? "Precio por kilo" : "Precio por unidad"}</span>
                <input
                  ref={registerAnimalFieldRef("unitPrice")}
                  type="text"
                  inputMode="decimal"
                  value={animalForm.unitPrice}
                  onChange={(event) => {
                    clearAnimalFieldError("unitPrice");
                    setAnimalForm((current) => ({ ...current, unitPrice: event.target.value }));
                  }}
                />
              </label>
              {animalForm.kind === "purchase" ? (
                <label className={animalFormErrors.freightAmount ? "field-error" : undefined}>
                  <span>Flete</span>
                  <input
                    ref={registerAnimalFieldRef("freightAmount")}
                    type="text"
                    inputMode="decimal"
                    value={animalForm.freightAmount}
                    onChange={(event) => {
                      clearAnimalFieldError("freightAmount");
                      setAnimalForm((current) => ({ ...current, freightAmount: event.target.value }));
                    }}
                  />
                </label>
              ) : null}
              <label className={animalFormErrors.commissionAmount ? "field-error" : undefined}>
                <span>Comision</span>
                <input
                  ref={registerAnimalFieldRef("commissionAmount")}
                  type="text"
                  inputMode="decimal"
                  value={animalForm.commissionAmount}
                  onChange={(event) => {
                    clearAnimalFieldError("commissionAmount");
                    setAnimalForm((current) => ({ ...current, commissionAmount: event.target.value }));
                  }}
                />
              </label>
              <label className={animalFormErrors.taxAmount ? "field-error" : undefined}>
                <span>IVA</span>
                <input
                  ref={registerAnimalFieldRef("taxAmount")}
                  type="text"
                  inputMode="decimal"
                  value={animalForm.taxAmount}
                  onChange={(event) => {
                    clearAnimalFieldError("taxAmount");
                    setAnimalForm((current) => ({ ...current, taxAmount: event.target.value }));
                  }}
                  />
                </label>
              {animalForm.kind === "sale" ? (
                <label className={animalFormErrors.collectedAmount ? "field-error" : undefined}>
                  <span>Cobrado</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={animalForm.collectedAmount}
                    onChange={(event) => setAnimalForm((current) => ({ ...current, collectedAmount: event.target.value }))}
                  />
                </label>
              ) : null}
              <label>
                <span>Moneda</span>
                <select
                  value={animalForm.currency}
                  onChange={(event) => setAnimalForm((current) => ({ ...current, currency: event.target.value as MoneyCurrency }))}
                >
                  {Object.entries(currencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="span-2">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={animalForm.notes}
              onChange={(event) => setAnimalForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          {isCommercialAnimalMovement ? (
            <div className="projection-card span-2">
              <span>Monto neto proyectado</span>
              <strong>{formatMoney(projectedAnimalTotal, animalForm.currency)}</strong>
              <small className="projection-formula">{buildAnimalTotalFormula(animalForm, projectedAnimalTotal)}</small>
              {animalForm.kind === "sale" ? (
                <small>
                  Pendiente de cobro{" "}
                  {formatMoney(Math.max(0, projectedAnimalTotal - (parseDecimalInput(animalForm.collectedAmount) || 0)), animalForm.currency)}
                </small>
              ) : null}
            </div>
          ) : null}
          <div className="action-row span-2">
            <button type="submit" className="primary-button">
              {editingAnimalMovementId ? "Guardar cambios" : "Guardar"}
            </button>
            {editingAnimalMovementId ? (
              <button type="button" className="ghost-button" onClick={resetAnimalForm}>
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
      </article>

      {/* La planilla que corresponde al Movimiento elegido en el formulario
          pasa primera -- Correccion de stock -> Planilla de stock,
          Traslado/Nacimiento/Muerte -> Planilla de movimientos de campo,
          cualquier otro -> Planilla de animales (la completa, con
          compra/venta/etc). */}
      {isCorrectionAnimalMovement ? (
        <>
          {planillaDeStockPanel}
          {planillaDeAnimalesPanel}
          {planillaDeMovimientosCampoPanel}
        </>
      ) : isTransferMovement || animalForm.kind === "birth" || animalForm.kind === "death" ? (
        <>
          {planillaDeMovimientosCampoPanel}
          {planillaDeAnimalesPanel}
          {planillaDeStockPanel}
        </>
      ) : (
        <>
          {planillaDeAnimalesPanel}
          {planillaDeMovimientosCampoPanel}
          {planillaDeStockPanel}
        </>
      )}

      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Movimientos recientes</h2>
            <p>Compras, ventas, traslados, nacimientos, muertes y faltantes, sin importar el campo filtrado arriba -- para ver ambas puntas de un traslado entre establecimientos sin tener que cambiar el filtro. Las correcciones de stock estan en su propia Planilla de stock, arriba.</p>
          </div>
        </div>
        <div className="table-wrap floating-scroll-host">
          <table className="animal-ledger-table">
            <thead>
              <tr>
                <th className="cell-date">Fecha</th>
                <th className="cell-kind">Movimiento</th>
                <th className="cell-field">Campo origen</th>
                <th className="cell-field">Potrero origen</th>
                <th className="cell-field">Campo destino</th>
                <th className="cell-field">Potrero destino</th>
                <th className="cell-description">Descripcion</th>
                <th className="cell-number">Cantidad</th>
                <th className="cell-category">Categoria</th>
                <th className="cell-tag">Caravana</th>
                <th className="cell-number">Peso</th>
                <th className="cell-money">Precio</th>
                <th className="cell-money">Flete</th>
                <th className="cell-money">Comision</th>
                <th className="cell-money">IVA</th>
                <th className="cell-money">Monto total</th>
                <th className="cell-link">Relacion contable</th>
                <th className="cell-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecentMovements.length ? (
                visibleRecentMovements.map((movement) => renderLedgerRow(movement))
              ) : (
                <tr>
                  <td className="cell-empty" colSpan={17}>
                    No hay movimientos en el rango de fechas visible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {recentMovementsWithoutCorrections.length > LEDGER_PREVIEW_COUNT ? (
          <div className="action-row">
            {visibleRecentCount < recentMovementsWithoutCorrections.length ? (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    setVisibleRecentCount((current) =>
                      Math.min(current + LEDGER_PREVIEW_STEP, recentMovementsWithoutCorrections.length)
                    )
                  }
                >
                  Ver 5 más
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setVisibleRecentCount(recentMovementsWithoutCorrections.length)}
                >
                  Ver todos ({recentMovementsWithoutCorrections.length})
                </button>
              </>
            ) : (
              <button type="button" className="ghost-button" onClick={() => setVisibleRecentCount(LEDGER_PREVIEW_COUNT)}>
                Ver menos
              </button>
            )}
          </div>
        ) : null}
      </article>
    </section>
  );
}
