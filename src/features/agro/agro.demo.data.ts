import {
  AccountingEntry,
  AnimalMovementRecord,
  CategoryDefinition,
  Establishment,
  FieldUnit,
  MonthlyExchangeRate,
  RainfallRecord,
  SanitaryRecord,
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

export const initialStock: StockSnapshot[] = [];

export const initialAnimalMovements: AnimalMovementRecord[] = [];

export const initialAccountingEntries: AccountingEntry[] = [];

export const initialRainfallRecords: RainfallRecord[] = [];

export const initialMonthlyExchangeRates: MonthlyExchangeRate[] = [];

export const initialSanitaryRecords: SanitaryRecord[] = [];
