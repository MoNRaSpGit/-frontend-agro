import { AgroSpecies, AnimalMovementKind, AnimalPricingMode, IncomeConcept } from "./agro.types";

export function deriveMovementDirection(kind: AnimalMovementKind) {
  return kind === "purchase" || kind === "birth" || kind === "transfer_in" || kind === "correction_in"
    ? "entry"
    : "exit";
}

// "kilo": el bruto es peso individual x cantidad x precio (precio por
// kilo). "unidad": el bruto es cantidad x precio (precio por cabeza), el
// peso no interviene. En una venta, comision e IVA se restan del bruto
// (nunca se suman); en una compra se suman junto con el flete.
export function calculateAnimalTotal(
  kind: AnimalMovementKind,
  pricingMode: AnimalPricingMode,
  quantity: number,
  weightKg: number,
  unitPrice: number,
  commissionAmount: number,
  taxAmount: number,
  freightAmount: number
) {
  const grossAmount = pricingMode === "kilo" ? weightKg * quantity * unitPrice : quantity * unitPrice;

  if (kind === "sale") {
    return grossAmount - commissionAmount - taxAmount;
  }

  return grossAmount + commissionAmount + taxAmount + freightAmount;
}

export function getIncomeConceptForSpecies(species: AgroSpecies): IncomeConcept {
  if (species === "ovinos") {
    return "venta_ovinos";
  }

  if (species === "equinos") {
    return "venta_equinos";
  }

  return "venta_vacunos";
}

export function requiresEarTag(kind: AnimalMovementKind, species: AgroSpecies) {
  return kind === "death" && species === "vacunos";
}
