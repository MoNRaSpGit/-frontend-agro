import type { AuthSession } from "./auth.client";
import { readJsonStorage, removeStorageItem } from "../lib/persistence";

export const AGRO_ACCESS_MODE_STORAGE_KEY = "frontend-agro.access-mode.v1";
export const AGRO_AUTH_SESSION_STORAGE_KEY = "frontend-agro.auth-session.v1";

export function clearAgroSessionStorage() {
  removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
  removeStorageItem(AGRO_ACCESS_MODE_STORAGE_KEY);
}

export function readAgroAuthSession() {
  return readJsonStorage<AuthSession | null>(AGRO_AUTH_SESSION_STORAGE_KEY, null);
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
