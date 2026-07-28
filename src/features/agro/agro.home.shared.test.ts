import { describe, expect, it } from "vitest";
import type { AccountingEntry, AnimalMovementRecord, Establishment, FieldUnit, RainfallRecord } from "./agro.types";
import {
  formatCategoryLabel,
  formatMoney,
  formatShortDate,
  formatYearMonth,
  getAlternativeFieldId,
  getFieldIdForEstablishmentFrom,
  getFirstFieldIdForEstablishment,
  getEstablishmentFlowDirection,
  getFiscalYearToDateRange,
  getIncomeCollectedAmount,
  getIncomeCollectionStatus,
  getIncomeExpectedAmount,
  getIncomePendingAmount,
  getMovementDirection,
  getNetAmount,
  getVisibleMonthRange,
  getYearMonth,
  isDateOnOrBefore,
  isDateWithinRange,
  isLivestockPurchaseEntry,
  isTransferMovementKind,
  normalizeAccountingEntry,
  normalizeAnimalMovementRecord,
  normalizeFieldUnits,
  normalizeRainfallRecord,
  normalizeSanitaryRecord,
  parseDecimalInput,
  sumFieldHectares,
  summarizeExpenses,
  summarizeRangeData
} from "./agro.home.shared";

const establishments: Establishment[] = [{ id: "est-1", name: "La Fortuna", location: "Rocha", hectares: 500 }];
const fields: FieldUnit[] = [{ id: "field-1", establishmentId: "est-1", name: "Potrero Norte", hectares: 120, notes: "" }];

function makeMovement(overrides: Partial<AnimalMovementRecord> = {}): AnimalMovementRecord {
  return {
    id: "mov-1",
    date: "2024-03-10",
    establishmentId: "est-1",
    fieldId: "field-1",
    species: "vacunos",
    categoryCode: "1",
    kind: "purchase",
    quantity: 5,
    notes: "",
    ...overrides
  };
}

function makeAccountingEntry(overrides: Partial<AccountingEntry> = {}): AccountingEntry {
  return {
    id: "acc-1",
    date: "2024-03-10",
    establishmentId: "est-1",
    fieldId: "field-1",
    type: "income",
    concept: "venta_vacunos",
    currency: "USD",
    grossAmount: 1000,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 1000,
    notes: "",
    ...overrides
  };
}

describe("date range helpers", () => {
  it("builds the visible month range with a human label", () => {
    expect(getVisibleMonthRange("2024", "03")).toEqual({
      startDate: "2024-03-01",
      endDate: "2024-03-31",
      label: "Marzo 2024"
    });
  });

  it("resolves the fiscal year to date range crossing the July boundary", () => {
    // Marzo cae en el ejercicio que arranco en julio del ano anterior.
    expect(getFiscalYearToDateRange("2024", "03")).toEqual({
      startDate: "2023-07-01",
      endDate: "2024-03-31",
      label: "Ejercicio 2023/24 hasta Marzo 2024"
    });
  });

  it("starts a new fiscal year exactly on july", () => {
    expect(getFiscalYearToDateRange("2024", "07")).toEqual({
      startDate: "2024-07-01",
      endDate: "2024-07-31",
      label: "Ejercicio 2024/25 hasta Julio 2024"
    });
  });

  it("checks whether a date falls within a range (inclusive)", () => {
    expect(isDateWithinRange("2024-03-15", "2024-03-01", "2024-03-31")).toBe(true);
    expect(isDateWithinRange("2024-03-01", "2024-03-01", "2024-03-31")).toBe(true);
    expect(isDateWithinRange("2024-03-31", "2024-03-01", "2024-03-31")).toBe(true);
    expect(isDateWithinRange("2024-04-01", "2024-03-01", "2024-03-31")).toBe(false);
  });

  it("checks whether a date is on or before another date", () => {
    expect(isDateOnOrBefore("2024-03-01", "2024-03-01")).toBe(true);
    expect(isDateOnOrBefore("2024-02-28", "2024-03-01")).toBe(true);
    expect(isDateOnOrBefore("2024-03-02", "2024-03-01")).toBe(false);
  });
});

describe("normalization helpers", () => {
  it("fills in missing field hectares from the parent establishment", () => {
    const rawFields: FieldUnit[] = [{ id: "field-2", establishmentId: "est-1", name: "Potrero Sur", hectares: undefined as unknown as number, notes: "" }];
    expect(normalizeFieldUnits(rawFields, establishments)).toEqual([{ ...rawFields[0], hectares: 500 }]);
  });

  it("resolves establishmentId for an animal movement missing it", () => {
    const movement = makeMovement({ establishmentId: "" });
    expect(normalizeAnimalMovementRecord(movement, fields).establishmentId).toBe("est-1");
  });

  it("falls back to an empty establishmentId when the field is unknown anywhere", () => {
    const movement = makeMovement({ establishmentId: "", fieldId: "does-not-exist" });
    expect(normalizeAnimalMovementRecord(movement, fields).establishmentId).toBe("");
  });

  it("defaults an accounting entry's collected amount to the expected amount when missing", () => {
    const entry = makeAccountingEntry({ expectedAmount: undefined, collectedAmount: undefined, netAmount: 750 });
    const normalized = normalizeAccountingEntry(entry, fields);
    expect(normalized.expectedAmount).toBe(750);
    expect(normalized.collectedAmount).toBe(750);
  });

  it("normalizes a rainfall record's fieldId without touching millimeters", () => {
    const record: RainfallRecord = { id: "rain-1", date: "2024-03-10", fieldId: "field-1", millimeters: 45, notes: "" };
    expect(normalizeRainfallRecord(record, fields)).toEqual(record);
  });

  it("defaults a sanitary record's species to vacunos when missing", () => {
    const normalized = normalizeSanitaryRecord(
      {
        id: "san-1",
        date: "2024-03-10",
        establishmentId: "",
        fieldId: "field-1",
        species: undefined as unknown as "vacunos",
        quantity: 10,
        treatment: "Vacuna aftosa",
        notes: ""
      },
      fields
    );
    expect(normalized.species).toBe("vacunos");
    expect(normalized.establishmentId).toBe("est-1");
  });
});

describe("income amount helpers", () => {
  it("computes expected/collected/pending for a partially collected income entry", () => {
    const entry = makeAccountingEntry({ expectedAmount: 1000, collectedAmount: 600 });
    expect(getIncomeExpectedAmount(entry)).toBe(1000);
    expect(getIncomeCollectedAmount(entry)).toBe(600);
    expect(getIncomePendingAmount(entry)).toBe(400);
    expect(getIncomeCollectionStatus(entry)).toBe("Parcial");
  });

  it("reports Pendiente when nothing was collected yet", () => {
    const entry = makeAccountingEntry({ expectedAmount: 1000, collectedAmount: 0 });
    expect(getIncomeCollectionStatus(entry)).toBe("Pendiente");
  });

  it("reports Cobrado when fully collected", () => {
    const entry = makeAccountingEntry({ expectedAmount: 1000, collectedAmount: 1000 });
    expect(getIncomeCollectionStatus(entry)).toBe("Cobrado");
  });

  it("clamps a collected amount that somehow exceeds the expected amount", () => {
    const entry = makeAccountingEntry({ expectedAmount: 1000, collectedAmount: 5000 });
    expect(getIncomeCollectedAmount(entry)).toBe(1000);
    expect(getIncomePendingAmount(entry)).toBe(0);
  });

  it("treats expense entries as having no income amounts", () => {
    const entry = makeAccountingEntry({ type: "expense", concept: "sanidad" });
    expect(getIncomeExpectedAmount(entry)).toBe(0);
    expect(getIncomeCollectedAmount(entry)).toBe(0);
    expect(getIncomeCollectionStatus(entry)).toBeNull();
  });
});

describe("movement direction helpers", () => {
  it("derives entry/exit direction from the movement kind", () => {
    expect(getMovementDirection(makeMovement({ kind: "purchase" }))).toBe("entry");
    expect(getMovementDirection(makeMovement({ kind: "sale" }))).toBe("exit");
  });

  it("treats the initial stock load adjustment as an entry regardless of kind mapping", () => {
    const initialLoad = makeMovement({ kind: "adjustment", notes: "Carga inicial: stock de arranque" });
    expect(getMovementDirection(initialLoad)).toBe("entry");
  });

  it("identifies every transfer movement kind", () => {
    expect(isTransferMovementKind("transfer")).toBe(true);
    expect(isTransferMovementKind("transfer_internal")).toBe(true);
    expect(isTransferMovementKind("transfer_in")).toBe(true);
    expect(isTransferMovementKind("transfer_out")).toBe(true);
    expect(isTransferMovementKind("purchase")).toBe(false);
  });
});

describe("getEstablishmentFlowDirection", () => {
  // Reproduce el bug reportado: un traslado entre dos potreros del MISMO
  // establecimiento genera un transfer_out y un transfer_in pareados. A
  // nivel de establecimiento eso no es ni entrada ni salida (el animal
  // nunca salio del rodeo), aunque a nivel de potrero si se movio.
  it("excludes an internal transfer (same establishment) from entries and exits", () => {
    const transferOut = makeMovement({
      id: "out-1",
      kind: "transfer_out",
      establishmentId: "est-1",
      fieldId: "field-1",
      pairedTransferMovementId: "in-1"
    });
    const transferIn = makeMovement({
      id: "in-1",
      kind: "transfer_in",
      establishmentId: "est-1",
      fieldId: "field-2",
      pairedTransferMovementId: "out-1"
    });
    const allMovements = [transferOut, transferIn];

    expect(getEstablishmentFlowDirection(transferOut, allMovements)).toBe("none");
    expect(getEstablishmentFlowDirection(transferIn, allMovements)).toBe("none");
  });

  it("still counts a transfer between two DIFFERENT establishments as exit/entry", () => {
    const transferOut = makeMovement({
      id: "out-1",
      kind: "transfer_out",
      establishmentId: "est-1",
      fieldId: "field-1",
      pairedTransferMovementId: "in-1"
    });
    const transferIn = makeMovement({
      id: "in-1",
      kind: "transfer_in",
      establishmentId: "est-2",
      fieldId: "field-3",
      pairedTransferMovementId: "out-1"
    });
    const allMovements = [transferOut, transferIn];

    expect(getEstablishmentFlowDirection(transferOut, allMovements)).toBe("exit");
    expect(getEstablishmentFlowDirection(transferIn, allMovements)).toBe("entry");
  });

  it("falls back to the normal entry/exit classification for non-transfer kinds", () => {
    expect(getEstablishmentFlowDirection(makeMovement({ kind: "purchase" }), [])).toBe("entry");
    expect(getEstablishmentFlowDirection(makeMovement({ kind: "sale" }), [])).toBe("exit");
  });
});

describe("field lookup helpers", () => {
  const multiFields: FieldUnit[] = [
    { id: "field-1", establishmentId: "est-1", name: "Norte", hectares: 100, notes: "" },
    { id: "field-2", establishmentId: "est-1", name: "Sur", hectares: 80, notes: "" },
    { id: "field-3", establishmentId: "est-2", name: "Este", hectares: 60, notes: "" }
  ];

  it("finds the first field for an establishment", () => {
    expect(getFieldIdForEstablishmentFrom(multiFields, "est-1")).toBe("field-1");
    expect(getFirstFieldIdForEstablishment(multiFields, "est-1")).toBe("field-1");
  });

  it("returns an empty string when the establishment has no fields", () => {
    expect(getFieldIdForEstablishmentFrom(multiFields, "est-missing")).toBe("");
  });

  it("finds an alternative field in the same establishment excluding one", () => {
    expect(getAlternativeFieldId(multiFields, "est-1", "field-1")).toBe("field-2");
    expect(getAlternativeFieldId(multiFields, "est-1", "field-2")).toBe("field-1");
  });

  it("has no alternative when the establishment only has one field", () => {
    expect(getAlternativeFieldId(multiFields, "est-2", "field-3")).toBe("");
  });

  it("sums the hectares of every field in an establishment", () => {
    expect(sumFieldHectares(multiFields, "est-1")).toBe(180);
    expect(sumFieldHectares(multiFields, "est-2")).toBe(60);
  });

  it("excludes one field from the sum, for validating an edit against the rest", () => {
    expect(sumFieldHectares(multiFields, "est-1", "field-1")).toBe(80);
  });

  it("returns 0 for an establishment with no fields", () => {
    expect(sumFieldHectares(multiFields, "est-missing")).toBe(0);
  });
});

describe("summarizeExpenses", () => {
  it("splits livestock purchase expenses from operational expenses per currency", () => {
    const entries: AccountingEntry[] = [
      makeAccountingEntry({ id: "e1", type: "expense", concept: "compra_animales", currency: "USD", netAmount: 300 }),
      makeAccountingEntry({ id: "e2", type: "expense", concept: "sanidad", currency: "USD", netAmount: 50 }),
      makeAccountingEntry({ id: "e3", type: "expense", concept: "sanidad", currency: "UYU", netAmount: 4000, date: "2024-03-05" }),
      makeAccountingEntry({ id: "e4", type: "income" }) // ignorado, no es gasto
    ];

    const summary = summarizeExpenses(entries, { "2024-03": 40 });

    expect(summary.livestockPurchase.usd).toBe(300);
    expect(summary.operational.usd).toBe(50);
    expect(summary.operational.uyu).toBe(4000);
    expect(summary.operational.uyuDollarized).toBe(100);
  });

  it("skips dollarization when there is no exchange rate for the month", () => {
    const entries: AccountingEntry[] = [
      makeAccountingEntry({ type: "expense", concept: "sanidad", currency: "UYU", netAmount: 4000, date: "2024-05-05" })
    ];

    const summary = summarizeExpenses(entries, {});
    expect(summary.operational.uyu).toBe(4000);
    expect(summary.operational.uyuDollarized).toBe(0);
  });
});

describe("summarizeRangeData", () => {
  const movements: AnimalMovementRecord[] = [
    makeMovement({ id: "m-in-range", kind: "purchase", quantity: 5, date: "2024-03-10" }),
    makeMovement({ id: "m-out-of-range", kind: "purchase", quantity: 99, date: "2024-01-01" }),
    makeMovement({ id: "m-sale", kind: "sale", quantity: 3, date: "2024-03-15" })
  ];
  const entries: AccountingEntry[] = [
    makeAccountingEntry({ id: "income-1", expectedAmount: 1000, collectedAmount: 600, date: "2024-03-10" }),
    makeAccountingEntry({
      id: "expense-1",
      type: "expense",
      concept: "sanidad",
      currency: "UYU",
      netAmount: 4000,
      date: "2024-03-05"
    })
  ];
  const rainfallRecords: RainfallRecord[] = [{ id: "rain-1", date: "2024-03-12", fieldId: "field-1", millimeters: 45, notes: "" }];

  it("aggregates entries, exits, income, pending income, expenses and rainfall within the range", () => {
    const summary = summarizeRangeData(movements, entries, rainfallRecords, { "2024-03": 40 }, "2024-03-01", "2024-03-31");

    expect(summary.entries).toBe(5);
    expect(summary.exits).toBe(3);
    expect(summary.incomeUsd).toBe(600);
    expect(summary.pendingIncomeUsd).toBe(400);
    expect(summary.operationalExpenseUyu).toBe(4000);
    expect(summary.operationalExpenseUyuDollarized).toBe(100);
    expect(summary.rainfallTotal).toBe(45);
  });

  it("filters by fieldIds when provided", () => {
    const summary = summarizeRangeData(
      movements,
      entries,
      rainfallRecords,
      {},
      "2024-03-01",
      "2024-03-31",
      new Set(["other-field"])
    );

    expect(summary.entries).toBe(0);
    expect(summary.exits).toBe(0);
    expect(summary.rainfallTotal).toBe(0);
  });

  it("does not count an internal transfer (same establishment) as either an entry or an exit", () => {
    const movementsWithInternalTransfer: AnimalMovementRecord[] = [
      ...movements,
      makeMovement({
        id: "transfer-out-1",
        kind: "transfer_out",
        establishmentId: "est-1",
        fieldId: "field-1",
        quantity: 10,
        date: "2024-03-12",
        pairedTransferMovementId: "transfer-in-1"
      }),
      makeMovement({
        id: "transfer-in-1",
        kind: "transfer_in",
        establishmentId: "est-1",
        fieldId: "field-1",
        quantity: 10,
        date: "2024-03-12",
        pairedTransferMovementId: "transfer-out-1"
      })
    ];

    const summary = summarizeRangeData(movementsWithInternalTransfer, entries, rainfallRecords, {}, "2024-03-01", "2024-03-31");

    // Los mismos totales que sin el traslado interno: no debe sumar nada.
    expect(summary.entries).toBe(5);
    expect(summary.exits).toBe(3);
  });

  it("counts a transfer between two different establishments as a real exit + entry", () => {
    const movementsWithCrossEstablishmentTransfer: AnimalMovementRecord[] = [
      ...movements,
      makeMovement({
        id: "transfer-out-2",
        kind: "transfer_out",
        establishmentId: "est-1",
        fieldId: "field-1",
        quantity: 7,
        date: "2024-03-12",
        pairedTransferMovementId: "transfer-in-2"
      }),
      makeMovement({
        id: "transfer-in-2",
        kind: "transfer_in",
        establishmentId: "est-2",
        fieldId: "field-3",
        quantity: 7,
        date: "2024-03-12",
        pairedTransferMovementId: "transfer-out-2"
      })
    ];

    const summary = summarizeRangeData(movementsWithCrossEstablishmentTransfer, entries, rainfallRecords, {}, "2024-03-01", "2024-03-31");

    expect(summary.entries).toBe(5 + 7);
    expect(summary.exits).toBe(3 + 7);
  });
});

describe("parseDecimalInput", () => {
  it("parses plain integers and decimals with a dot", () => {
    expect(parseDecimalInput("100")).toBe(100);
    expect(parseDecimalInput("100.5")).toBe(100.5);
  });

  it("parses uruguayan-style numbers using comma as decimal separator", () => {
    expect(parseDecimalInput("1.234,56")).toBe(1234.56);
    expect(parseDecimalInput("1234,56")).toBe(1234.56);
  });

  it("parses english-style numbers using comma as thousands separator", () => {
    expect(parseDecimalInput("1,234.56")).toBe(1234.56);
  });

  it("returns NaN for empty input", () => {
    expect(parseDecimalInput("")).toBeNaN();
    expect(parseDecimalInput("   ")).toBeNaN();
  });
});

describe("small formatting/money helpers", () => {
  it("formats money with the right currency symbol", () => {
    expect(formatMoney(1234.5, "USD")).toContain("1.234,50");
    expect(formatMoney(1234.5, "UYU")).toContain("1.234,50");
  });

  it("formats a short date as d/m/yy", () => {
    expect(formatShortDate("2024-03-05")).toBe("5/3/24");
  });

  it("extracts the year-month prefix from a date", () => {
    expect(getYearMonth("2024-03-05")).toBe("2024-03");
    expect(getYearMonth("")).toBe("");
  });

  it("formats a year-month as a human label", () => {
    expect(formatYearMonth("2024-03")).toBe("Marzo 2024");
  });

  it("strips a leading numbered prefix from a category label", () => {
    expect(formatCategoryLabel("1) Toros")).toBe("Toros");
    expect(formatCategoryLabel("Vaquillonas")).toBe("Vaquillonas");
  });

  it("computes net amount: income subtracts commission/tax, expense adds them", () => {
    expect(getNetAmount("income", 1000, 50, 20)).toBe(930);
    expect(getNetAmount("expense", 1000, 50, 20)).toBe(1070);
  });

  it("flags livestock purchase entries", () => {
    expect(isLivestockPurchaseEntry(makeAccountingEntry({ type: "expense", concept: "compra_animales" }))).toBe(true);
    expect(isLivestockPurchaseEntry(makeAccountingEntry({ type: "expense", concept: "sanidad" }))).toBe(false);
    expect(isLivestockPurchaseEntry(makeAccountingEntry({ type: "income" }))).toBe(false);
  });
});
