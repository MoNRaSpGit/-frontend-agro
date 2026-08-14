import { describe, expect, it } from "vitest";
import { calculateAnimalTotal, deriveMovementDirection, getIncomeConceptForSpecies, requiresEarTag } from "./agro.domain";

describe("agro functional round", () => {
  it("maps sales to the expected income concept by species", () => {
    expect(getIncomeConceptForSpecies("vacunos")).toBe("venta_vacunos");
    expect(getIncomeConceptForSpecies("ovinos")).toBe("venta_ovinos");
    expect(getIncomeConceptForSpecies("equinos")).toBe("venta_equinos");
  });

  it("calculates sale totals by kilo, subtracting commission and iva", () => {
    // 10 cabezas x 200kg c/u x $4.5/kg = 9000 bruto, -100 comision -50 iva
    expect(calculateAnimalTotal("sale", "kilo", 10, 200, 4.5, 100, 50, 25)).toBe(8850);
  });

  it("calculates sale totals by unidad (no peso), subtracting commission and iva", () => {
    expect(calculateAnimalTotal("sale", "unidad", 10, 0, 450, 100, 50, 25)).toBe(4350);
  });

  it("calculates purchase totals adding freight, commission and iva", () => {
    expect(calculateAnimalTotal("purchase", "kilo", 10, 200, 4.5, 100, 50, 25)).toBe(9175);
  });

  it("derives stock direction from movement kind", () => {
    expect(deriveMovementDirection("purchase")).toBe("entry");
    expect(deriveMovementDirection("birth")).toBe("entry");
    expect(deriveMovementDirection("transfer_in")).toBe("entry");
    expect(deriveMovementDirection("sale")).toBe("exit");
    expect(deriveMovementDirection("death")).toBe("exit");
    expect(deriveMovementDirection("transfer_out")).toBe("exit");
    expect(deriveMovementDirection("shortage")).toBe("exit");
    expect(deriveMovementDirection("correction_in")).toBe("entry");
    expect(deriveMovementDirection("correction_out")).toBe("exit");
  });

  it("requires ear tag only for cattle deaths", () => {
    expect(requiresEarTag("death", "vacunos")).toBe(true);
    expect(requiresEarTag("death", "ovinos")).toBe(false);
    expect(requiresEarTag("sale", "vacunos")).toBe(false);
  });
});
