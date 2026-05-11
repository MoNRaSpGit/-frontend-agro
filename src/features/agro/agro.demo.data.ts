import {
  AccountingEntry,
  AnimalMovementRecord,
  CategoryDefinition,
  Establishment,
  FieldUnit,
  RainfallRecord,
  StockSnapshot
} from "./agro.types";

export const speciesLabels = {
  vacunos: "Vacunos",
  ovinos: "Ovinos",
  equinos: "Equinos"
} as const;

export const movementKindLabels = {
  purchase: "Compra",
  sale: "Venta",
  birth: "Nacimiento",
  death: "Muerte",
  adjustment: "Ajuste"
} as const;

export const currencyLabels = {
  USD: "USD",
  UYU: "UYU"
} as const;

export const establishments: Establishment[] = [
  { id: "est-1", name: "Santa Clara", location: "Durazno", hectares: 1240 },
  { id: "est-2", name: "El Ombu", location: "Flores", hectares: 860 }
];

export const fields: FieldUnit[] = [
  { id: "field-est-1", establishmentId: "est-1", name: "Santa Clara", notes: "Operacion consolidada del establecimiento." },
  { id: "field-est-2", establishmentId: "est-2", name: "El Ombu", notes: "Operacion consolidada del establecimiento." }
];

const legacyFieldEstablishmentMap: Record<string, string> = {
  "field-1": "est-1",
  "field-2": "est-1",
  "field-3": "est-1",
  "field-4": "est-2",
  "field-5": "est-2",
  "field-est-1": "est-1",
  "field-est-2": "est-2"
};

export function getFieldIdForEstablishment(establishmentId: string) {
  return fields.find((field) => field.establishmentId === establishmentId)?.id ?? "";
}

export function getEstablishmentIdFromFieldId(fieldId: string) {
  return legacyFieldEstablishmentMap[fieldId] ?? fields.find((field) => field.id === fieldId)?.establishmentId ?? "";
}

export const categoryCatalog: Record<string, CategoryDefinition[]> = {
  vacunos: [
    { code: "1", label: "1) Toros", ug: 1.25 },
    { code: "2", label: "2) Vacas de cria (entoradas)", ug: 1.03 },
    { code: "3", label: "3) Vacas de invernada", ug: 1 },
    { code: "4", label: "4) Novillos de mas de 3 anos", ug: 1.15 },
    { code: "5", label: "5) Novillos de 2 a 3 anos", ug: 0.9 },
    { code: "6", label: "6) Novillos de 1 a 2 anos", ug: 0.8 },
    { code: "7", label: "7) Vaquillonas de mas de 2 anos sin entorar", ug: 0.9 },
    { code: "8", label: "8) Vaquillonas de 1 a 2 anos", ug: 0.7 },
    { code: "9", label: "9) Terneros/terneras", ug: 0.5 }
  ],
  ovinos: [
    { code: "1", label: "1) Carneros", ug: 0.17 },
    { code: "2", label: "2) Ovejas de cria (encarneradas)", ug: 0.17 },
    { code: "3", label: "3) Ovejas de descarte (consumo)", ug: 0.15 },
    { code: "4", label: "4) Capones", ug: 0.15 },
    { code: "5", label: "5) Borregas 2 a 4 dientes sin encarnerar", ug: 0.13 },
    { code: "6", label: "6) Corderas diente de leche", ug: 0.11 },
    { code: "7", label: "7) Corderos diente de leche", ug: 0.11 },
    { code: "8", label: "8) Corderos/as mamones", ug: 0.08 }
  ],
  equinos: [
    { code: "1", label: "1) Padrillos", ug: 1.2 },
    { code: "2", label: "2) Yeguas", ug: 1.2 },
    { code: "3", label: "3) Caballos", ug: 1.2 },
    { code: "4", label: "4) Potrillos/potrancas", ug: 1.2 },
    { code: "5", label: "5) Potrillos/potrancas al pie de la madre", ug: 1.2 }
  ]
};

export const initialStock: StockSnapshot[] = [
  { fieldId: "field-est-1", species: "vacunos", categoryCode: "2", quantity: 124 },
  { fieldId: "field-est-1", species: "vacunos", categoryCode: "9", quantity: 48 },
  { fieldId: "field-est-1", species: "ovinos", categoryCode: "2", quantity: 210 },
  { fieldId: "field-est-1", species: "ovinos", categoryCode: "8", quantity: 64 },
  { fieldId: "field-est-1", species: "equinos", categoryCode: "3", quantity: 9 },
  { fieldId: "field-est-2", species: "vacunos", categoryCode: "6", quantity: 87 },
  { fieldId: "field-est-2", species: "ovinos", categoryCode: "5", quantity: 92 }
];

export const initialAnimalMovements: AnimalMovementRecord[] = [
  {
    id: "anm-1",
    date: "2026-05-02",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    species: "vacunos",
    categoryCode: "9",
    kind: "birth",
    quantity: 12,
    commissionAmount: 0,
    taxAmount: 0,
    notes: "Paricion de abril."
  },
  {
    id: "anm-2",
    date: "2026-05-03",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    species: "ovinos",
    categoryCode: "7",
    kind: "sale",
    quantity: 18,
    weightKg: 920,
    unitPrice: 3.2,
    commissionAmount: 88,
    taxAmount: 42,
    totalAmount: 2814,
    currency: "USD",
    linkedAccountingEntryId: "acc-2",
    notes: "Venta registrada en Santa Clara."
  },
  {
    id: "anm-3",
    date: "2026-05-04",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    species: "vacunos",
    categoryCode: "6",
    kind: "purchase",
    quantity: 24,
    weightKg: 1680,
    unitPrice: 4.05,
    freightAmount: 115,
    commissionAmount: 64,
    taxAmount: 21,
    totalAmount: 7004,
    currency: "USD",
    linkedAccountingEntryId: "acc-3",
    notes: "Recria de invierno."
  },
  {
    id: "anm-4",
    date: "2026-05-04",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    species: "equinos",
    categoryCode: "4",
    kind: "birth",
    quantity: 2,
    commissionAmount: 0,
    taxAmount: 0,
    notes: "Potrillos registrados en Santa Clara."
  },
  {
    id: "anm-5",
    date: "2026-05-05",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    species: "ovinos",
    categoryCode: "8",
    kind: "death",
    quantity: 3,
    commissionAmount: 0,
    taxAmount: 0,
    notes: "Baja puntual de El Ombu."
  },
  {
    id: "anm-6",
    date: "2026-05-06",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    species: "vacunos",
    categoryCode: "5",
    kind: "sale",
    quantity: 9,
    weightKg: 1460,
    unitPrice: 4.25,
    commissionAmount: 186,
    taxAmount: 74,
    totalAmount: 5945,
    currency: "USD",
    linkedAccountingEntryId: "acc-5",
    notes: "Salida de novillos para negocio de mayo."
  },
  {
    id: "anm-7",
    date: "2026-05-06",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    species: "ovinos",
    categoryCode: "2",
    kind: "purchase",
    quantity: 16,
    weightKg: 690,
    unitPrice: 2.95,
    freightAmount: 43,
    commissionAmount: 22,
    taxAmount: 0,
    totalAmount: 2100,
    currency: "USD",
    linkedAccountingEntryId: "acc-7",
    notes: "Ingreso para reforzar vientres."
  }
];

export const initialAccountingEntries: AccountingEntry[] = [
  {
    id: "acc-1",
    date: "2026-05-01",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    type: "income",
    concept: "venta_vacunos",
    currency: "USD",
    grossAmount: 15662,
    commissionAmount: 470,
    taxAmount: 225,
    netAmount: 14967,
    notes: "Remate consignataria mayo."
  },
  {
    id: "acc-2",
    date: "2026-05-02",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    type: "income",
    concept: "venta_ovinos",
    currency: "USD",
    grossAmount: 2944,
    commissionAmount: 88,
    taxAmount: 42,
    netAmount: 2814,
    linkedAnimalMovementId: "anm-2",
    notes: "Venta de ovinos de Santa Clara."
  },
  {
    id: "acc-3",
    date: "2026-05-04",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    type: "expense",
    concept: "compra_animales",
    currency: "USD",
    grossAmount: 6919,
    commissionAmount: 64,
    taxAmount: 21,
    netAmount: 7004,
    linkedAnimalMovementId: "anm-3",
    notes: "Compra de recria de invierno."
  },
  {
    id: "acc-4",
    date: "2026-05-05",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    type: "expense",
    concept: "sanidad",
    currency: "UYU",
    grossAmount: 8250,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 8250,
    notes: "Vacunas y antiparasitarios."
  },
  {
    id: "acc-5",
    date: "2026-05-06",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    type: "income",
    concept: "venta_vacunos",
    currency: "USD",
    grossAmount: 6205,
    commissionAmount: 186,
    taxAmount: 74,
    netAmount: 5945,
    linkedAnimalMovementId: "anm-6",
    notes: "Venta complementaria de El Ombu."
  },
  {
    id: "acc-6",
    date: "2026-05-06",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    type: "expense",
    concept: "alimentacion",
    currency: "UYU",
    grossAmount: 1260,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 1260,
    notes: "Racion para ovinos."
  },
  {
    id: "acc-7",
    date: "2026-05-06",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    type: "expense",
    concept: "compra_animales",
    currency: "USD",
    grossAmount: 2078,
    commissionAmount: 22,
    taxAmount: 0,
    netAmount: 2100,
    linkedAnimalMovementId: "anm-7",
    notes: "Compra de vientres ovinos."
  },
  {
    id: "acc-8",
    date: "2026-05-07",
    establishmentId: "est-1",
    fieldId: "field-est-1",
    type: "expense",
    concept: "combustible",
    currency: "UYU",
    grossAmount: 980,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 980,
    notes: "Combustible de recorrida."
  },
  {
    id: "acc-9",
    date: "2026-05-07",
    establishmentId: "est-2",
    fieldId: "field-est-2",
    type: "expense",
    concept: "mantenimiento",
    currency: "UYU",
    grossAmount: 740,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 740,
    notes: "Arreglo menor de alambrado."
  }
];

export const initialRainfallRecords: RainfallRecord[] = [
  { id: "rain-1", date: "2026-05-01", fieldId: "field-est-1", millimeters: 18, notes: "Lluvia pareja en Santa Clara." },
  { id: "rain-2", date: "2026-05-03", fieldId: "field-est-1", millimeters: 12, notes: "Aporte corto en Santa Clara." },
  { id: "rain-3", date: "2026-05-04", fieldId: "field-est-2", millimeters: 25, notes: "Buen evento para verdeos en El Ombu." },
  { id: "rain-4", date: "2026-05-06", fieldId: "field-est-2", millimeters: 9, notes: "Lluvia liviana en El Ombu." }
];
