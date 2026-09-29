import { describe, expect, it } from "vitest";
import { categoryCatalog } from "./agro.demo.data";
import { Establishment, FieldUnit } from "./agro.types";
import { parseVoiceSummaryCommand, parseVoiceTransferCommand, VoiceTransferData } from "./agro.voice";

const establishments: Establishment[] = [
  { id: "est-milagrosa", name: "La Milagrosa", location: "", hectares: 500 },
  { id: "est-ombu", name: "El Ombu", location: "", hectares: 300 }
];

const fields: FieldUnit[] = [
  { id: "field-milagrosa-costa", establishmentId: "est-milagrosa", name: "Costa", hectares: 40, notes: "" },
  { id: "field-milagrosa-5", establishmentId: "est-milagrosa", name: "5", hectares: 30, notes: "" },
  { id: "field-ombu-1", establishmentId: "est-ombu", name: "1", hectares: 20, notes: "" },
  { id: "field-ombu-5", establishmentId: "est-ombu", name: "5", hectares: 25, notes: "" }
];

const data: VoiceTransferData = { establishments, fields, categoryCatalog };

describe("parseVoiceTransferCommand -- version tolerante (28/09/2026)", () => {
  it("no interpreta nada si no arranca con 'traslado'", () => {
    const result = parseVoiceTransferCommand("hola como estas", data);
    expect(result.status).toBe("no_intent");
  });

  it("frase completa sigue devolviendo 'ready', igual que antes (no se rompio nada)", () => {
    const result = parseVoiceTransferCommand(
      "traslado del ombu a la milagrosa del potrero 1 al potrero 5 cantidad 5 toros",
      data
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.origin.establishment.id).toBe("est-ombu");
    expect(result.origin.field.id).toBe("field-ombu-1");
    expect(result.destination.establishment.id).toBe("est-milagrosa");
    expect(result.destination.field.id).toBe("field-milagrosa-5");
    expect(result.quantity).toBe(5);
    expect(result.category.code).toBe("1"); // Toros
  });

  it("caso real probado con el usuario: falta destino y categoria (falta en el medio Y al final a la vez)", () => {
    const result = parseVoiceTransferCommand("traslado de la milagrosa del potrero costa cantidad 5", data);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;

    expect(result.slots.originEstablishment?.id).toBe("est-milagrosa");
    expect(result.slots.originField?.id).toBe("field-milagrosa-costa");
    expect(result.slots.quantity).toBe(5);

    expect(result.slots.destinationEstablishment).toBeNull();
    expect(result.slots.destinationField).toBeNull();
    expect(result.slots.category).toBeNull();

    expect(result.missing.sort()).toEqual(["category", "destinationEstablishment", "destinationField"].sort());
  });

  it("falta solo la cantidad (al final) -- se conserva todo lo demas", () => {
    const result = parseVoiceTransferCommand(
      "traslado del ombu a la milagrosa del potrero 1 al potrero 5 toros",
      data
    );
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.slots.originEstablishment?.id).toBe("est-ombu");
    expect(result.slots.destinationEstablishment?.id).toBe("est-milagrosa");
    expect(result.slots.originField?.id).toBe("field-ombu-1");
    expect(result.slots.destinationField?.id).toBe("field-milagrosa-5");
    expect(result.missing).toEqual(["quantity"]);
    // Sin la palabra "cantidad" antes, "toros" quedo pegado al final sin
    // numero -- la categoria tampoco se puede separar de forma confiable,
    // asi que tambien puede faltar (no se prueba aca a proposito: es un
    // caso limite ya conocido, la palabra "cantidad" sigue siendo
    // obligatoria para separar los dos numeros/datos finales).
  });

  it("falta el campo origen (al principio) -- igual entiende los potreros y la cantidad", () => {
    const result = parseVoiceTransferCommand("traslado del potrero 1 al potrero 5 cantidad 5 toros", data);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    // Sin campo dicho, "potrero 1" existe en dos establecimientos (Milagrosa
    // no tiene "1", pero por las dudas probamos con "El Ombu" unico) --
    // aca "potrero 1" solo existe en El Ombu, asi que se infiere solo.
    expect(result.slots.originField?.id).toBe("field-ombu-1");
    expect(result.slots.originEstablishment?.id).toBe("est-ombu");
    expect(result.slots.destinationField?.id).toBeUndefined();
    // "potrero 5" existe en AMBOS establecimientos -> ambiguo -> falta.
    expect(result.missing).toContain("destinationField");
    expect(result.slots.quantity).toBe(5);
    expect(result.slots.category?.code).toBe("1");
  });
});

describe("parseVoiceSummaryCommand (29/09/2026)", () => {
  it("no interpreta nada si no arranca con 'resumen'", () => {
    const result = parseVoiceSummaryCommand("hola como estas", { establishments, fields });
    expect(result.status).toBe("no_intent");
  });

  it("frase completa con 'del campo' -- entiende establecimiento y potrero", () => {
    const result = parseVoiceSummaryCommand("resumen del campo la milagrosa potrero 5", { establishments, fields });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.establishment.id).toBe("est-milagrosa");
    expect(result.field.id).toBe("field-milagrosa-5");
  });

  it("frase completa sin 'del campo' -- igual entiende", () => {
    const result = parseVoiceSummaryCommand("resumen el ombu potrero 1", { establishments, fields });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.establishment.id).toBe("est-ombu");
    expect(result.field.id).toBe("field-ombu-1");
  });

  it("falta el potrero -- se entiende el establecimiento igual", () => {
    const result = parseVoiceSummaryCommand("resumen del campo la milagrosa", { establishments, fields });
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.slots.establishment?.id).toBe("est-milagrosa");
    expect(result.slots.field).toBeNull();
    expect(result.missing).toEqual(["field"]);
  });

  it("falta el establecimiento pero el potrero es unico -- se infiere solo", () => {
    const result = parseVoiceSummaryCommand("resumen potrero costa", { establishments, fields });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.establishment.id).toBe("est-milagrosa");
    expect(result.field.id).toBe("field-milagrosa-costa");
  });

  it("falta el establecimiento y el potrero es ambiguo (existe en los dos campos) -- falta todo", () => {
    const result = parseVoiceSummaryCommand("resumen potrero 5", { establishments, fields });
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.missing.sort()).toEqual(["establishment", "field"].sort());
  });
});
