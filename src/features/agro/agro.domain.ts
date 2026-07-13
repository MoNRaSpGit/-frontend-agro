import { AgroSpecies, AnimalMovementKind, IncomeConcept } from "./agro.types";

export function deriveMovementDirection(kind: AnimalMovementKind) {
  return kind === "purchase" || kind === "birth" || kind === "transfer_in" ? "entry" : "exit";
}

export function calculateAnimalTotal(
  kind: AnimalMovementKind,
  quantity: number,
  unitPrice: number,
  commissionAmount: number,
  taxAmount: number,
  freightAmount: number
) {
  const grossAmount = quantity * unitPrice;

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
