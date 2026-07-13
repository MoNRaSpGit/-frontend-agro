import { describe, expect, it } from "vitest";
import { calculateAnimalTotal, deriveMovementDirection, getIncomeConceptForSpecies, requiresEarTag } from "./agro.domain";

describe("agro functional round", () => {
  it("maps sales to the expected income concept by species", () => {
    expect(getIncomeConceptForSpecies("vacunos")).toBe("venta_vacunos");
    expect(getIncomeConceptForSpecies("ovinos")).toBe("venta_ovinos");
    expect(getIncomeConceptForSpecies("equinos")).toBe("venta_equinos");
  });

  it("calculates sale totals subtracting commission and iva", () => {
    expect(calculateAnimalTotal("sale", 10, 45, 100, 50, 25)).toBe(300);
  });

  it("calculates purchase totals adding freight, commission and iva", () => {
    expect(calculateAnimalTotal("purchase", 10, 4.5, 100, 50, 25)).toBe(220);
  });

  it("derives stock direction from movement kind", () => {
    expect(deriveMovementDirection("purchase")).toBe("entry");
    expect(deriveMovementDirection("birth")).toBe("entry");
    expect(deriveMovementDirection("transfer_in")).toBe("entry");
    expect(deriveMovementDirection("sale")).toBe("exit");
    expect(deriveMovementDirection("death")).toBe("exit");
    expect(deriveMovementDirection("transfer_out")).toBe("exit");
    expect(deriveMovementDirection("shortage")).toBe("exit");
  });

  it("requires ear tag only for cattle deaths", () => {
    expect(requiresEarTag("death", "vacunos")).toBe(true);
    expect(requiresEarTag("death", "ovinos")).toBe(false);
    expect(requiresEarTag("sale", "vacunos")).toBe(false);
  });
});
