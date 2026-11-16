import {
  expenseConceptLabels,
  formatMoney,
  formatNumber,
  formatShortDate,
  getIncomeCollectedAmount,
  getIncomePendingAmount,
  incomeConceptLabels
} from "./agro.home.shared";
import { getCurrentAgroUsername } from "../../shared/auth/agroSession";
import type {
  AccountingAuditAction,
  AccountingAuditSource,
  AccountingEntry,
  AgroAccountingAuditEntry,
  AnimalMovementRecord
} from "./agro.types";

// Auditoria contable reforzada (16/11/2026). Solo ARMA texto y registros: no
// calcula ni cambia ningun numero de la contabilidad (esa logica sigue en
// agro.home.shared.ts / agro.domain.ts), asi que no puede alterar totales.

function conceptLabel(entry: AccountingEntry) {
  const labels = (entry.type === "income" ? incomeConceptLabels : expenseConceptLabels) as Record<string, string>;
  return labels[entry.concept] ?? entry.concept;
}

// La cuenta que dio el monto, en palabras. Ej:
//  "Venta de vacunos (ingreso) · 100 animales × 417 kg × USD 2,54 por kilo = bruto USD 105.834,60 · − comision USD 0,00 − IVA USD 0,00 = neto USD 105.834,60 · cobrado USD 0,00, pendiente USD 105.834,60"
export function describeAccountingBreakdown(entry: AccountingEntry, movement?: AnimalMovementRecord | null): string {
  const money = (value: number) => formatMoney(value, entry.currency);
  const parts: string[] = [`${conceptLabel(entry)} (${entry.type === "income" ? "ingreso" : "egreso"}, ${formatShortDate(entry.date)})`];

  if (movement && movement.unitPrice !== undefined && movement.pricingMode) {
    if (movement.pricingMode === "kilo") {
      parts.push(
        `${formatNumber(movement.quantity, 0)} animales × ${formatNumber(movement.weightKg ?? 0)} kg × ${money(movement.unitPrice)} por kilo`
      );
    } else {
      parts.push(`${formatNumber(movement.quantity, 0)} animales × ${money(movement.unitPrice)} por cabeza`);
    }
  }

  const freight = movement?.kind === "purchase" ? movement.freightAmount ?? 0 : 0;
  if (entry.type === "income") {
    parts.push(`bruto ${money(entry.grossAmount)} − comisión ${money(entry.commissionAmount)} − IVA ${money(entry.taxAmount)} = neto ${money(entry.netAmount)}`);
  } else {
    const freightText = freight > 0 ? ` + flete ${money(freight)}` : "";
    parts.push(
      `bruto ${money(entry.grossAmount)} + comisión ${money(entry.commissionAmount)} + IVA ${money(entry.taxAmount)}${freightText} = neto ${money(entry.netAmount)}`
    );
  }

  if (entry.type === "income") {
    parts.push(`cobrado ${money(getIncomeCollectedAmount(entry))}, pendiente ${money(getIncomePendingAmount(entry))}`);
    if (entry.clientName) parts.push(`cliente ${entry.clientName}`);
    if (entry.dueDate) parts.push(`vence ${formatShortDate(entry.dueDate)}`);
  }

  return parts.join(" · ");
}

// Lista de cambios campo por campo ("Neto: USD 100,00 → USD 120,00").
export function describeAccountingChanges(before: AccountingEntry, after: AccountingEntry): string[] {
  const changes: string[] = [];
  const moneyBefore = (value: number) => formatMoney(value, before.currency);
  const moneyAfter = (value: number) => formatMoney(value, after.currency);
  const push = (label: string, from: string, to: string) => {
    if (from !== to) changes.push(`${label}: ${from} → ${to}`);
  };

  push("Fecha", formatShortDate(before.date), formatShortDate(after.date));
  push("Rubro", conceptLabel(before), conceptLabel(after));
  push("Moneda", before.currency, after.currency);
  push("Bruto", moneyBefore(before.grossAmount), moneyAfter(after.grossAmount));
  push("Comisión", moneyBefore(before.commissionAmount), moneyAfter(after.commissionAmount));
  push("IVA", moneyBefore(before.taxAmount), moneyAfter(after.taxAmount));
  push("Neto", moneyBefore(before.netAmount), moneyAfter(after.netAmount));
  if (before.type === "income" || after.type === "income") {
    push("Cobrado", moneyBefore(getIncomeCollectedAmount(before)), moneyAfter(getIncomeCollectedAmount(after)));
  }
  push("Vencimiento", before.dueDate ? formatShortDate(before.dueDate) : "sin fecha", after.dueDate ? formatShortDate(after.dueDate) : "sin fecha");
  push("Cliente", before.clientName ?? "sin cliente", after.clientName ?? "sin cliente");
  push("Establecimiento", before.establishmentId, after.establishmentId);
  push("Campo", before.fieldId, after.fieldId);
  push("Notas", before.notes || "(vacías)", after.notes || "(vacías)");

  return changes;
}

const ACTION_TEXT: Record<AccountingAuditAction, string> = {
  create: "Alta",
  edit: "Edición",
  delete: "Borrado"
};

// Arma el registro completo para accountingAuditLog. "movement" es el
// movimiento de animales vinculado (si lo hay), para explicar la cuenta de
// una venta/compra por kilo o por cabeza.
export function buildAccountingAuditEntry(params: {
  action: AccountingAuditAction;
  before: AccountingEntry | null;
  after: AccountingEntry | null;
  source: AccountingAuditSource;
  movement?: AnimalMovementRecord | null;
  now?: number;
  by?: string;
}): AgroAccountingAuditEntry {
  const { action, before, after, source, movement } = params;
  const now = params.now ?? Date.now();
  const subject = after ?? before;
  if (!subject) {
    throw new Error("Un registro de auditoria contable necesita al menos un asiento (antes o despues).");
  }

  let detail: string;
  if (action === "edit" && before && after) {
    const changes = describeAccountingChanges(before, after);
    detail = `${changes.length > 0 ? `Cambios: ${changes.join("; ")}` : "Sin cambios de importes"} | Quedó: ${describeAccountingBreakdown(after, movement)}`;
  } else if (action === "delete" && before) {
    detail = `Se eliminó: ${describeAccountingBreakdown(before, movement)}`;
  } else if (after) {
    detail = describeAccountingBreakdown(after, movement);
  } else {
    detail = "";
  }

  return {
    id: `audit-acc-${now}-${subject.id}`,
    action,
    entryId: subject.id,
    before,
    after,
    at: new Date(now).toISOString(),
    source,
    explanation: `${ACTION_TEXT[action]}: ${detail}`,
    by: params.by ?? getCurrentAgroUsername()
  };
}
