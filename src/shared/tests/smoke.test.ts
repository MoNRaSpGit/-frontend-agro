import { describe, expect, it } from "vitest";
import { categoryCatalog, establishments, fields } from "../../features/agro/agro.demo.data";
import { buildMeta } from "../config/build";

describe("frontend agro smoke", () => {
  it("exposes frontend build information", () => {
    expect(buildMeta.productKey).toBe("agro");
    expect(buildMeta.productName.length).toBeGreaterThan(0);
    expect(buildMeta.apiBaseUrl.length).toBeGreaterThan(0);
  });

  it("keeps seeded establishments and fields available", () => {
    expect(establishments.length).toBeGreaterThan(0);
    expect(fields.length).toBeGreaterThan(0);
  });

  it("keeps category catalogs for supported species", () => {
    expect(categoryCatalog.vacunos.length).toBeGreaterThan(0);
    expect(categoryCatalog.ovinos.length).toBeGreaterThan(0);
    expect(categoryCatalog.equinos.length).toBeGreaterThan(0);
  });
});
