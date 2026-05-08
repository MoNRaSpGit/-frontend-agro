import { AgroSpecies, AnimalMovementKind, IncomeConcept } from "./agro.types";

export function deriveMovementDirection(kind: AnimalMovementKind) {
  return kind === "purchase" || kind === "birth" ? "entry" : "exit";
}

export function calculateAnimalTotal(
  quantity: number,
  unitPrice: number,
  commissionAmount: number,
  taxAmount: number,
  freightAmount: number
) {
  return quantity * unitPrice + commissionAmount + taxAmount + freightAmount;
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
