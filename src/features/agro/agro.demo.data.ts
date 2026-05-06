import {
  AccountingEntry,
  CategoryDefinition,
  Establishment,
  FieldUnit,
  MultipleChoiceQuestion,
  StockMovement,
  StockSnapshot
} from "./agro.types";

export const speciesLabels = {
  vacunos: "Vacunos",
  ovinos: "Ovinos",
  equinos: "Equinos"
} as const;

export const establishments: Establishment[] = [
  { id: "est-1", name: "Santa Clara", location: "Durazno", hectares: 1240 },
  { id: "est-2", name: "El Ombu", location: "Flores", hectares: 860 }
];

export const fields: FieldUnit[] = [
  { id: "field-1", establishmentId: "est-1", name: "Potrero Norte", notes: "Campo de cria y destete." },
  { id: "field-2", establishmentId: "est-1", name: "Potrero Bajo", notes: "Campo de ovejas y reserva." },
  { id: "field-3", establishmentId: "est-1", name: "Casco", notes: "Caballada y animales de apoyo." },
  { id: "field-4", establishmentId: "est-2", name: "Lote 7", notes: "Campo mixto con foco en recria." },
  { id: "field-5", establishmentId: "est-2", name: "Lote 12", notes: "Campo liviano para ovinos." }
];

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
  { fieldId: "field-1", species: "vacunos", categoryCode: "2", quantity: 124 },
  { fieldId: "field-1", species: "vacunos", categoryCode: "9", quantity: 48 },
  { fieldId: "field-2", species: "ovinos", categoryCode: "2", quantity: 210 },
  { fieldId: "field-2", species: "ovinos", categoryCode: "8", quantity: 64 },
  { fieldId: "field-3", species: "equinos", categoryCode: "3", quantity: 9 },
  { fieldId: "field-4", species: "vacunos", categoryCode: "6", quantity: 87 },
  { fieldId: "field-5", species: "ovinos", categoryCode: "5", quantity: 92 }
];

export const initialMovements: StockMovement[] = [
  {
    id: "mov-1",
    date: "2026-05-02",
    establishmentId: "est-1",
    fieldId: "field-1",
    species: "vacunos",
    categoryCode: "9",
    direction: "in",
    reason: "nacimiento",
    quantity: 12,
    notes: "Paricion de abril."
  },
  {
    id: "mov-2",
    date: "2026-05-03",
    establishmentId: "est-1",
    fieldId: "field-2",
    species: "ovinos",
    categoryCode: "7",
    direction: "out",
    reason: "venta",
    quantity: 18,
    notes: "Venta por lote chico."
  },
  {
    id: "mov-3",
    date: "2026-05-04",
    establishmentId: "est-2",
    fieldId: "field-4",
    species: "vacunos",
    categoryCode: "6",
    direction: "in",
    reason: "compra",
    quantity: 24,
    notes: "Recria de invierno."
  },
  {
    id: "mov-4",
    date: "2026-05-04",
    establishmentId: "est-1",
    fieldId: "field-3",
    species: "equinos",
    categoryCode: "4",
    direction: "in",
    reason: "nacimiento",
    quantity: 2,
    notes: "Potrillos del casco."
  },
  {
    id: "mov-5",
    date: "2026-05-05",
    establishmentId: "est-2",
    fieldId: "field-5",
    species: "ovinos",
    categoryCode: "8",
    direction: "out",
    reason: "muerte",
    quantity: 3,
    notes: "Baja puntual del lote."
  },
  {
    id: "mov-6",
    date: "2026-05-05",
    establishmentId: "est-1",
    fieldId: "field-1",
    species: "vacunos",
    categoryCode: "6",
    direction: "out",
    reason: "ajuste",
    quantity: 4,
    notes: "Ajuste de recuento."
  },
  {
    id: "mov-7",
    date: "2026-05-06",
    establishmentId: "est-2",
    fieldId: "field-4",
    species: "vacunos",
    categoryCode: "5",
    direction: "out",
    reason: "venta",
    quantity: 9,
    notes: "Salida de novillos para negocio de mayo."
  },
  {
    id: "mov-8",
    date: "2026-05-06",
    establishmentId: "est-1",
    fieldId: "field-2",
    species: "ovinos",
    categoryCode: "2",
    direction: "in",
    reason: "compra",
    quantity: 16,
    notes: "Ingreso para reforzar vientres."
  }
];

export const initialAccountingEntries: AccountingEntry[] = [
  {
    id: "acc-1",
    date: "2026-05-01",
    establishmentId: "est-1",
    type: "income",
    concept: "venta_vacunos",
    species: "vacunos",
    kilos: 3820,
    pricePerKilo: 4.1,
    grossAmount: 15662,
    commissionAmount: 470,
    taxAmount: 225,
    netAmount: 14967,
    notes: "Remate consignataria mayo."
  },
  {
    id: "acc-2",
    date: "2026-05-02",
    establishmentId: "est-2",
    type: "income",
    concept: "venta_ovinos",
    species: "ovinos",
    kilos: 920,
    pricePerKilo: 3.2,
    grossAmount: 2944,
    commissionAmount: 88,
    taxAmount: 42,
    netAmount: 2814,
    notes: "Venta de ovinos del lote 12."
  },
  {
    id: "acc-3",
    date: "2026-05-03",
    establishmentId: "est-1",
    type: "expense",
    concept: "sanidad",
    grossAmount: 8250,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 8250,
    notes: "Vacunas y antiparasitarios."
  },
  {
    id: "acc-4",
    date: "2026-05-04",
    establishmentId: "est-2",
    type: "income",
    concept: "venta_lana",
    species: "ovinos",
    kilos: 640,
    pricePerKilo: 2.9,
    grossAmount: 1856,
    commissionAmount: 93,
    taxAmount: 37,
    netAmount: 1726,
    notes: "Lana zafra corta."
  },
  {
    id: "acc-5",
    date: "2026-05-05",
    establishmentId: "est-1",
    type: "income",
    concept: "venta_equinos",
    species: "equinos",
    kilos: 480,
    pricePerKilo: 5.6,
    grossAmount: 2688,
    commissionAmount: 80,
    taxAmount: 26,
    netAmount: 2582,
    notes: "Venta puntual de equino."
  },
  {
    id: "acc-6",
    date: "2026-05-05",
    establishmentId: "est-2",
    type: "expense",
    concept: "alimentacion",
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
    type: "expense",
    concept: "combustible",
    grossAmount: 980,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 980,
    notes: "Combustible de recorrida."
  },
  {
    id: "acc-8",
    date: "2026-05-06",
    establishmentId: "est-2",
    type: "expense",
    concept: "mantenimiento",
    grossAmount: 740,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 740,
    notes: "Arreglo menor de alambrado."
  },
  {
    id: "acc-9",
    date: "2026-05-07",
    establishmentId: "est-1",
    type: "income",
    concept: "venta_vacunos",
    species: "vacunos",
    kilos: 1460,
    pricePerKilo: 4.25,
    grossAmount: 6205,
    commissionAmount: 186,
    taxAmount: 74,
    netAmount: 5945,
    notes: "Venta complementaria de lote liviano."
  },
  {
    id: "acc-10",
    date: "2026-05-07",
    establishmentId: "est-2",
    type: "expense",
    concept: "sueldos",
    grossAmount: 1420,
    commissionAmount: 0,
    taxAmount: 0,
    netAmount: 1420,
    notes: "Jornada extra de apoyo en manga."
  }
];

export const discoveryQuestions: MultipleChoiceQuestion[] = [
  {
    id: "stock-granularity",
    title: "Como quieren controlar el stock animal",
    helper: "Definimos si el sistema arranca solo con cantidad o si tambien registra kilos.",
    options: ["Solo cantidad", "Cantidad y kilos", "Depende de la especie"]
  },
  {
    id: "sale-link",
    title: "Las ventas deben descontar stock automaticamente",
    helper: "Sirve para decidir si al cargar una venta se baja el stock en el mismo momento.",
    options: ["Si siempre", "A veces", "No por ahora"]
  },
  {
    id: "expense-split",
    title: "Quieren cargar los gastos segun el campo",
    helper: "Por ejemplo, saber si un gasto corresponde a Potrero Norte, Lote 7 u otro campo.",
    options: ["Si", "No", "Solo algunos gastos"]
  },
  {
    id: "wool-cycle",
    title: "La lana se controla por zafra o como ingreso simple",
    helper: "Esto define si la lana necesita una parte propia del sistema o si alcanza con cargarla como ingreso.",
    options: ["Por zafra", "Ingreso simple", "Todavia no sabemos"]
  },
  {
    id: "field-costing",
    title: "Quieren ver resultado economico por campo",
    helper: "Por ejemplo, saber si un campo gano o gasto mas que otro.",
    options: ["Si, por cada campo", "Solo por establecimiento", "No por ahora"]
  },
  {
    id: "deaths-register",
    title: "La muerte animal se quiere registrar con detalle",
    helper: "Definimos si alcanza con registrar la cantidad o si tambien importa guardar la causa.",
    options: ["Solo cantidad", "Cantidad y causa", "Cantidad, causa y lote"]
  },
  {
    id: "stock-history",
    title: "Quieren ver el historial de entradas y salidas de animales",
    helper: "Esto sirve para reflejar la cuenta corriente de animales que menciono el cliente.",
    options: ["Si", "No", "Solo para algunos casos"]
  }
];
