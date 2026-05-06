import { AgroDiscoveryResponseDraft, AgroDiscoveryResponseRecord } from "./agro.discovery.types";
import { buildApiUrl } from "../../shared/config/api";

export interface AgroDiscoveryClientContract {
  saveDraft(input: AgroDiscoveryResponseDraft): Promise<AgroDiscoveryResponseRecord>;
  getLatest(): Promise<AgroDiscoveryResponseRecord | null>;
}

export const AGRO_DISCOVERY_ACCESS_TOKEN_KEY = "saaspro_agro_access_token";

export const agroDiscoveryEndpointNotes = {
  suggestedBasePath: "/agro/discovery",
  suggestedRoutes: {
    saveDraft: "POST /agro/discovery",
    getLatest: "GET /agro/discovery/latest"
  }
} as const;

export const agroDiscoveryApiUrls = {
  saveDraft: buildApiUrl("/agro/discovery"),
  getLatest: buildApiUrl("/agro/discovery/latest")
} as const;

function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AGRO_DISCOVERY_ACCESS_TOKEN_KEY);
}

function buildAuthHeaders() {
  const accessToken = getStoredAccessToken();
  if (!accessToken) {
    throw new Error("Falta token de acceso para sync backend de discovery.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };
}

async function parseDiscoveryResponse(response: Response) {
  if (response.ok) {
    return (await response.json()) as AgroDiscoveryResponseRecord | null;
  }

  let message = "No se pudo sincronizar discovery con backend.";

  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) {
      message = payload.message;
    }
  } catch {
    message = `${message} HTTP ${response.status}`;
  }

  throw new Error(message);
}

export function saveAgroDiscoveryAccessToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedToken = token.trim();
  if (!normalizedToken) {
    window.localStorage.removeItem(AGRO_DISCOVERY_ACCESS_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(AGRO_DISCOVERY_ACCESS_TOKEN_KEY, normalizedToken);
}

export function loadAgroDiscoveryAccessToken() {
  return getStoredAccessToken() || "";
}

export async function saveAgroDiscoveryDraft(input: AgroDiscoveryResponseDraft) {
  const response = await fetch(agroDiscoveryApiUrls.saveDraft, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(input)
  });

  return parseDiscoveryResponse(response) as Promise<AgroDiscoveryResponseRecord>;
}

export async function getLatestAgroDiscoveryDraft() {
  const response = await fetch(agroDiscoveryApiUrls.getLatest, {
    method: "GET",
    headers: buildAuthHeaders()
  });

  return parseDiscoveryResponse(response);
}
