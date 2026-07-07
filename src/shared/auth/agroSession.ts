import type { AuthSession } from "./auth.client";
import { buildApiUrl } from "../config/api";
import { readJsonStorage, removeStorageItem, writeJsonStorage } from "../lib/persistence";

export const AGRO_ACCESS_MODE_STORAGE_KEY = "frontend-agro.access-mode.v1";
export const AGRO_AUTH_SESSION_STORAGE_KEY = "frontend-agro.auth-session.v1";

export function clearAgroSessionStorage() {
  removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
  removeStorageItem(AGRO_ACCESS_MODE_STORAGE_KEY);
}

export function readAgroAuthSession() {
  return readJsonStorage<AuthSession | null>(AGRO_AUTH_SESSION_STORAGE_KEY, null);
}

function writeAgroAuthSession(session: AuthSession) {
  writeJsonStorage(AGRO_AUTH_SESSION_STORAGE_KEY, session);
}

export function getAgroAuthHeaders() {
  const session = readAgroAuthSession();
  const accessToken = session?.tokens.accessToken?.trim();

  if (!accessToken) {
    throw new Error("La sesion de agro no esta disponible.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };
}

async function refreshAgroSession() {
  const session = readAgroAuthSession();
  const refreshToken = session?.tokens.refreshToken?.trim();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildApiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    clearAgroSessionStorage();
    return null;
  }

  const nextSession = (await response.json()) as AuthSession;
  writeAgroAuthSession(nextSession);
  writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, "backend");
  return nextSession;
}

export async function fetchWithAgroAuth(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  const session = readAgroAuthSession();
  const accessToken = session?.tokens.accessToken?.trim();

  if (!accessToken) {
    throw new Error("La sesion de agro no esta disponible.");
  }

  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const doRequest = () => fetch(input, { ...init, headers });
  let response = await doRequest();

  if (response.status !== 401) {
    return response;
  }

  const refreshedSession = await refreshAgroSession();
  const refreshedAccessToken = refreshedSession?.tokens.accessToken?.trim();

  if (!refreshedAccessToken) {
    return response;
  }

  headers.set("Authorization", `Bearer ${refreshedAccessToken}`);
  response = await doRequest();
  return response;
}
