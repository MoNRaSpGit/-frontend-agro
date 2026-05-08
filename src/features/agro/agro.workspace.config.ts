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
    description: "Vista general del establecimiento",
    persistence: "local"
  },
  {
    key: "animals",
    label: "Animales",
    description: "Entradas, salidas y control de existencias",
    persistence: "local"
  },
  {
    key: "accounting",
    label: "Contabilidad",
    description: "Caja por moneda, rubro y campo",
    persistence: "local"
  },
  {
    key: "rainfall",
    label: "Lluvia",
    description: "Carga y bitacora de lluvias por campo",
    persistence: "local"
  },
  {
    key: "summary",
    label: "Resumen",
    description: "Control por campo, categorias y alertas",
    persistence: "future"
  }
];
