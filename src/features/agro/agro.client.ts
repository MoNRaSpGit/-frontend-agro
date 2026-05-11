import { buildApiUrl } from "../../shared/config/api";
import {
  AccountingEntry,
  AnimalMovementRecord,
  MonthlyExchangeRate,
  RainfallRecord,
  SanitaryRecord
} from "./agro.types";

export type AgroWorkspaceSnapshot = {
  workspaceKey: "public";
  version: "v1";
  data: {
    animalMovements: AnimalMovementRecord[];
    accountingEntries: AccountingEntry[];
    rainfallRecords: RainfallRecord[];
    sanitaryRecords: SanitaryRecord[];
    monthlyExchangeRates: MonthlyExchangeRate[];
  };
  updatedAt: string | null;
};

export async function fetchAgroWorkspace() {
  const response = await fetch(buildApiUrl("/agro/workspace/public"), {
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el workspace de agro.");
  }

  return (await response.json()) as AgroWorkspaceSnapshot;
}

export async function saveAgroWorkspace(snapshot: AgroWorkspaceSnapshot["data"]) {
  const response = await fetch(buildApiUrl("/agro/workspace/public"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
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
