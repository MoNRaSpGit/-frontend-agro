import { buildApiUrl } from "../../shared/config/api";
import { readJsonStorage, writeJsonStorage } from "../../shared/lib/persistence";
import { getAgroAuthHeaders } from "../../shared/auth/agroSession";
import {
  AccountingEntry,
  AnimalMovementRecord,
  Establishment,
  FieldUnit,
  MonthlyExchangeRate,
  RainfallRecord,
  SanitaryRecord
} from "./agro.types";
import { establishments as demoEstablishments, fields as demoFields } from "./agro.demo.data";

export type AgroPersistenceMode = "backend" | "demo-local";

const AGRO_DEMO_WORKSPACE_STORAGE_KEY = "frontend-agro.demo-workspace.v1";

export type AgroWorkspaceSnapshot = {
  workspaceKey: "public";
  version: "v1";
  data: {
    establishments: Establishment[];
    fields: FieldUnit[];
    animalMovements: AnimalMovementRecord[];
    accountingEntries: AccountingEntry[];
    rainfallRecords: RainfallRecord[];
    sanitaryRecords: SanitaryRecord[];
    monthlyExchangeRates: MonthlyExchangeRate[];
  };
  updatedAt: string | null;
};

function createDefaultDemoSnapshot(): AgroWorkspaceSnapshot {
  return {
    workspaceKey: "public",
    version: "v1",
    data: {
      establishments: demoEstablishments,
      fields: demoFields,
      animalMovements: [],
      accountingEntries: [],
      rainfallRecords: [],
      sanitaryRecords: [],
      monthlyExchangeRates: []
    },
    updatedAt: null
  };
}

export async function fetchAgroWorkspace(mode: AgroPersistenceMode) {
  if (mode === "demo-local") {
    return readJsonStorage<AgroWorkspaceSnapshot>(AGRO_DEMO_WORKSPACE_STORAGE_KEY, createDefaultDemoSnapshot());
  }

  const response = await fetch(buildApiUrl("/agro/workspace"), {
    headers: getAgroAuthHeaders()
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el workspace de agro.");
  }

  return (await response.json()) as AgroWorkspaceSnapshot;
}

export async function saveAgroWorkspace(mode: AgroPersistenceMode, snapshot: AgroWorkspaceSnapshot["data"]) {
  if (mode === "demo-local") {
    const nextSnapshot: AgroWorkspaceSnapshot = {
      workspaceKey: "public",
      version: "v1",
      data: snapshot,
      updatedAt: new Date().toISOString()
    };

    writeJsonStorage(AGRO_DEMO_WORKSPACE_STORAGE_KEY, nextSnapshot);
    return nextSnapshot;
  }

  const response = await fetch(buildApiUrl("/agro/workspace"), {
    method: "PUT",
    headers: getAgroAuthHeaders(),
    body: JSON.stringify({
      workspaceKey: "public",
      version: "v1",
      ...snapshot
    })
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar el workspace de agro.");
  }

  return (await response.json()) as AgroWorkspaceSnapshot;
}
