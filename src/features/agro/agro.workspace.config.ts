import { AgroView } from "./agro.types";

export interface AgroWorkspaceSection {
  key: AgroView;
  label: string;
  description: string;
  persistence: "local" | "backend_candidate" | "future";
}

export const agroWorkspaceSections: AgroWorkspaceSection[] = [
  {
    key: "overview",
    label: "Inicio",
    description: "Lectura ejecutiva del demo",
    persistence: "local"
  },
  {
    key: "stock",
    label: "Stock",
    description: "Prueba rapida del flujo animal",
    persistence: "local"
  },
  {
    key: "accounting",
    label: "Contabilidad",
    description: "Lenguaje y rubros del cliente",
    persistence: "local"
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Lectura comercial del establecimiento",
    persistence: "future"
  },
  {
    key: "questions",
    label: "Preguntas",
    description: "Discovery que si vale persistir",
    persistence: "backend_candidate"
  }
];
