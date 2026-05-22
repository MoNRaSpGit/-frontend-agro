import { removeStorageItem } from "../lib/persistence";

export const AGRO_ACCESS_MODE_STORAGE_KEY = "frontend-agro.access-mode.v1";
export const AGRO_AUTH_SESSION_STORAGE_KEY = "frontend-agro.auth-session.v1";

export function clearAgroSessionStorage() {
  removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
  removeStorageItem(AGRO_ACCESS_MODE_STORAGE_KEY);
}
