import { describe, expect, it } from "vitest";
import { categoryCatalog, discoveryQuestions, refinementQuestions } from "../../features/agro/agro.demo.data";
import { buildMeta } from "../config/build";

describe("frontend agro smoke", () => {
  it("exposes frontend build information", () => {
    expect(buildMeta.productKey).toBe("agro");
    expect(buildMeta.productName.length).toBeGreaterThan(0);
    expect(buildMeta.apiBaseUrl.length).toBeGreaterThan(0);
  });

  it("keeps seeded question rounds available", () => {
    expect(discoveryQuestions.length).toBeGreaterThan(0);
    expect(refinementQuestions.length).toBeGreaterThan(0);
  });

  it("keeps category catalogs for supported species", () => {
    expect(categoryCatalog.vacunos.length).toBeGreaterThan(0);
    expect(categoryCatalog.ovinos.length).toBeGreaterThan(0);
    expect(categoryCatalog.equinos.length).toBeGreaterThan(0);
  });
});
