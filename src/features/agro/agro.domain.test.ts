import { describe, expect, it } from "vitest";
import { buildDiscoveryDraft } from "./agro.discovery.helpers";
import { calculateAnimalTotal, deriveMovementDirection, getIncomeConceptForSpecies, requiresEarTag } from "./agro.domain";

describe("agro functional round", () => {
  it("maps sales to the expected income concept by species", () => {
    expect(getIncomeConceptForSpecies("vacunos")).toBe("venta_vacunos");
    expect(getIncomeConceptForSpecies("ovinos")).toBe("venta_ovinos");
    expect(getIncomeConceptForSpecies("equinos")).toBe("venta_equinos");
  });

  it("calculates animal totals with freight, commission and iva", () => {
    expect(calculateAnimalTotal(10, 4.5, 100, 50, 25)).toBe(220);
  });

  it("derives stock direction from movement kind", () => {
    expect(deriveMovementDirection("purchase")).toBe("entry");
    expect(deriveMovementDirection("birth")).toBe("entry");
    expect(deriveMovementDirection("sale")).toBe("exit");
    expect(deriveMovementDirection("death")).toBe("exit");
  });

  it("requires ear tag only for cattle deaths", () => {
    expect(requiresEarTag("death", "vacunos")).toBe(true);
    expect(requiresEarTag("death", "ovinos")).toBe(false);
    expect(requiresEarTag("sale", "vacunos")).toBe(false);
  });

  it("builds the official discovery payload without empty answers", () => {
    const draft = buildDiscoveryDraft({
      "sale-link": "Si siempre",
      "field-costing": "Tambien resultado por campo",
      empty: ""
    });

    expect(draft.moduleKey).toBe("agro");
    expect(draft.version).toBe("v1");
    expect(draft.answers).toEqual([
      { questionId: "sale-link", selectedOption: "Si siempre" },
      { questionId: "field-costing", selectedOption: "Tambien resultado por campo" }
    ]);
  });
});
