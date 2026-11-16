import { describe, expect, it } from "vitest";
import { buildAccountingAuditEntry, describeAccountingBreakdown, describeAccountingChanges } from "./agro.accountingAudit";
import type { AccountingEntry, AnimalMovementRecord } from "./agro.types";

function makeEntry(overrides: Partial<AccountingEntry> = {}): AccountingEntry {
  return {
    id: "acc-1",
    date: "2026-11-13",
    establishmentId: "est-1",
    fieldId: "field-1",
    type: "income",
    concept: "venta_vacunos",
    currency: "USD",
    grossAmount: 1000,
    commissionAmount: 50,
    taxAmount: 10,
    netAmount: 940,
    expectedAmount: 940,
    collectedAmount: 400,
    notes: "",
    ...overrides
  };
}

function makeKiloSale(): AnimalMovementRecord {
  return {
    id: "anm-1",
    date: "2026-11-13",
    establishmentId: "est-1",
    fieldId: "field-1",
    species: "vacunos",
    categoryCode: "novillo",
    kind: "sale",
    quantity: 100,
    pricingMode: "kilo",
    weightKg: 417,
    unitPrice: 2.538,
    commissionAmount: 0,
    taxAmount: 0,
    totalAmount: 105834.6,
    currency: "USD",
    linkedAccountingEntryId: "acc-1",
    notes: ""
  };
}

describe("describeAccountingBreakdown", () => {
  it("explains an income as gross minus commission and tax, with collected and pending", () => {
    const text = describeAccountingBreakdown(makeEntry());
    expect(text).toContain("Venta de vacunos (ingreso");
    expect(text).toContain("bruto");
    expect(text).toContain("− comisión");
    expect(text).toContain("= neto");
    expect(text).toContain("cobrado");
    expect(text).toContain("pendiente");
  });

  it("explains an expense adding commission, tax and freight", () => {
    const entry = makeEntry({ type: "expense", concept: "compra_animales", collectedAmount: undefined, expectedAmount: undefined });
    const purchase: AnimalMovementRecord = { ...makeKiloSale(), kind: "purchase", freightAmount: 25 };
    const text = describeAccountingBreakdown(entry, purchase);
    expect(text).toContain("(egreso");
    expect(text).toContain("+ comisión");
    expect(text).toContain("+ flete");
    expect(text).not.toContain("cobrado");
  });

  it("shows quantity x weight x price for a sale by kilo", () => {
    const text = describeAccountingBreakdown(makeEntry(), makeKiloSale());
    expect(text).toMatch(/100 animales × 417,00 kg/);
    expect(text).toContain("por kilo");
  });
});

describe("describeAccountingChanges", () => {
  it("lists only the fields that changed", () => {
    const before = makeEntry();
    const after = makeEntry({ collectedAmount: 940, dueDate: "2026-12-01", clientName: "Juan" });
    const changes = describeAccountingChanges(before, after);
    expect(changes.some((line) => line.startsWith("Cobrado:"))).toBe(true);
    expect(changes.some((line) => line.startsWith("Vencimiento:"))).toBe(true);
    expect(changes.some((line) => line.startsWith("Cliente:"))).toBe(true);
    expect(changes.some((line) => line.startsWith("Bruto:"))).toBe(false);
  });

  it("returns nothing when nothing changed", () => {
    expect(describeAccountingChanges(makeEntry(), makeEntry())).toEqual([]);
  });
});

describe("buildAccountingAuditEntry", () => {
  it("records a create with no 'before', a timestamp, source and explanation", () => {
    const entry = buildAccountingAuditEntry({ action: "create", before: null, after: makeEntry(), source: "animales", movement: makeKiloSale(), now: 1000 });
    expect(entry.action).toBe("create");
    expect(entry.before).toBeNull();
    expect(entry.entryId).toBe("acc-1");
    expect(entry.source).toBe("animales");
    expect(entry.at).toBe(new Date(1000).toISOString());
    expect(entry.explanation).toMatch(/^Alta: /);
    expect(entry.explanation).toContain("100 animales");
  });

  it("records an edit with the field changes and the resulting breakdown", () => {
    const before = makeEntry();
    const after = makeEntry({ collectedAmount: 940 });
    const entry = buildAccountingAuditEntry({ action: "edit", before, after, source: "cobro", now: 2000 });
    expect(entry.explanation).toMatch(/^Edición: Cambios: Cobrado:/);
    expect(entry.explanation).toContain("| Quedó:");
    expect(entry.before).toBe(before);
    expect(entry.after).toBe(after);
  });

  it("records a delete keeping the removed entry in 'before'", () => {
    const before = makeEntry();
    const entry = buildAccountingAuditEntry({ action: "delete", before, after: null, source: "borrado-animales", now: 3000 });
    expect(entry.explanation).toMatch(/^Borrado: Se eliminó: /);
    expect(entry.after).toBeNull();
    expect(entry.id).toBe("audit-acc-3000-acc-1");
  });

  it("refuses to build a record with no entry at all", () => {
    expect(() => buildAccountingAuditEntry({ action: "create", before: null, after: null, source: "contabilidad" })).toThrow();
  });
});
