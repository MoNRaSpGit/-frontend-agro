import { buildApiUrl } from "../../shared/config/api";
import { toAgroApiError } from "../../shared/errors/agroApiError";
import { readJsonStorage, writeJsonStorage } from "../../shared/lib/persistence";
import { fetchWithAgroAuth } from "../../shared/auth/agroSession";
import {
  AccountingEntry,
  AgroAccountingAuditEntry,
  AgroAuditEntry,
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
    auditLog: AgroAuditEntry[];
    accountingAuditLog: AgroAccountingAuditEntry[];
  };
  updatedAt: string | null;
  rowVersion: number;
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
      monthlyExchangeRates: [],
      auditLog: [],
      accountingAuditLog: []
    },
    updatedAt: null,
    rowVersion: 0
  };
}

export async function fetchAgroWorkspace(mode: AgroPersistenceMode) {
  if (mode === "demo-local") {
    return readJsonStorage<AgroWorkspaceSnapshot>(AGRO_DEMO_WORKSPACE_STORAGE_KEY, createDefaultDemoSnapshot());
  }

  const response = await fetchWithAgroAuth(buildApiUrl("/agro/workspace"));

  if (!response.ok) {
    throw await toAgroApiError(response, "No se pudo cargar el workspace de agro.");
  }

  return (await response.json()) as AgroWorkspaceSnapshot;
}

export async function saveAgroWorkspace(
  mode: AgroPersistenceMode,
  snapshot: AgroWorkspaceSnapshot["data"],
  expectedRowVersion: number | null
) {
  if (mode === "demo-local") {
    const nextSnapshot: AgroWorkspaceSnapshot = {
      workspaceKey: "public",
      version: "v1",
      data: snapshot,
      updatedAt: new Date().toISOString(),
      rowVersion: (expectedRowVersion ?? 0) + 1
    };

    writeJsonStorage(AGRO_DEMO_WORKSPACE_STORAGE_KEY, nextSnapshot);
    return nextSnapshot;
  }

  const response = await fetchWithAgroAuth(buildApiUrl("/agro/workspace"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceKey: "public",
      version: "v1",
      expectedRowVersion,
      ...snapshot
    })
  });

  if (!response.ok) {
    throw await toAgroApiError(response, "No se pudo guardar el workspace de agro.");
  }

  return (await response.json()) as AgroWorkspaceSnapshot;
}

// Debug TEMPORAL (30/09/2026) para el bug de transcript duplicado en
// Android: manda al backend lo que se escucho crudo para poder leerlo
// desde ahi con scripts/read-voice-debug-log.js, en vez de depender de
// que el usuario transcriba capturas de pantalla a mano. Se traga
// cualquier error (nunca debe romper el flujo de voz por esto) y solo
// aplica en modo "backend" (en demo-local no hay sesion real).
export async function sendVoiceDebugLog(
  mode: AgroPersistenceMode,
  transcript: string,
  rawResults: { index: number; isFinal: boolean; text: string }[]
) {
  if (mode !== "backend") return;

  try {
    await fetchWithAgroAuth(buildApiUrl("/agro/voice-debug-log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAgent: navigator.userAgent, transcript, rawResults })
    });
  } catch {
    // debug best-effort, no bloquea el flujo de voz.
  }
}
