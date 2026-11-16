import type { AuthSession } from "./auth.client";
import { buildApiUrl } from "../config/api";
import { AgroApiError, toAgroNetworkError } from "../errors/agroApiError";
import { readJsonStorage, removeStorageItem, writeJsonStorage } from "../lib/persistence";

export const AGRO_ACCESS_MODE_STORAGE_KEY = "frontend-agro.access-mode.v1";
export const AGRO_AUTH_SESSION_STORAGE_KEY = "frontend-agro.auth-session.v1";

export function clearAgroSessionStorage() {
  removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
  removeStorageItem(AGRO_ACCESS_MODE_STORAGE_KEY);
}

const SESSION_REPLACED_FLAG_KEY = "frontend-agro.session-replaced";

async function isSessionReplacedResponse(response: Response) {
  try {
    const payload = (await response.clone().json()) as { message?: string };
    return payload.message === "SESSION_REPLACED";
  } catch {
    return false;
  }
}

function markSessionReplaced() {
  try {
    sessionStorage.setItem(SESSION_REPLACED_FLAG_KEY, "1");
  } catch {
    // sin storage: el login no muestra el motivo, nada mas
  }
}

// Lo lee (y borra) la pantalla de login para explicar por que se cerro.
export function consumeSessionReplacedFlag() {
  try {
    const value = sessionStorage.getItem(SESSION_REPLACED_FLAG_KEY) === "1";
    sessionStorage.removeItem(SESSION_REPLACED_FLAG_KEY);
    return value;
  } catch {
    return false;
  }
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
    throw new AgroApiError("La sesion de agro no esta disponible.", "auth");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };
}

// El refresh token del backend es de un solo uso: al canjearlo se invalida y
// se emite uno nuevo. Si dos pedidos (misma pestana en paralelo, u otra
// pestana abierta con la misma sesion) intentan refrescar casi al mismo
// tiempo, el segundo va a fallar porque el token que tenia ya fue canjeado
// por el primero - eso cerraba la sesion sin motivo real. Este candado hace
// que, dentro de esta pestana, todos esperen el mismo refresh en curso en
// vez de pedir cada uno el suyo.
let refreshInFlight: Promise<AuthSession | null> | null = null;

async function refreshAgroSession(): Promise<AuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = performAgroSessionRefresh();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function performAgroSessionRefresh(): Promise<AuthSession | null> {
  const session = readAgroAuthSession();
  const refreshToken = session?.tokens.refreshToken?.trim();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildApiUrl("/agro/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    // Una sola sesion por usuario (17/11/2026): si alguien entro con esta
    // misma cuenta en otro dispositivo, el servidor responde SESSION_REPLACED.
    // Se deja una marca para que el login lo explique; lo que no estaba
    // guardado en este dispositivo se descarta (pedido explicito).
    if (await isSessionReplacedResponse(response)) {
      markSessionReplaced();
      clearAgroSessionStorage();
      return null;
    }

    // El refresh pudo fallar porque OTRA pestana con la misma sesion ya uso
    // y roto este mismo refresh token un instante antes. Antes de cerrar la
    // sesion, nos fijamos si mientras tanto ya quedo guardada una sesion mas
    // nueva (la que genero esa otra pestana) para adoptarla en vez de perderla.
    const latestSession = readAgroAuthSession();
    if (latestSession && latestSession.tokens.refreshToken?.trim() !== refreshToken) {
      return latestSession;
    }

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
    throw new AgroApiError("La sesion de agro no esta disponible.", "auth");
  }

  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  // Si fetch tira (sin conexion, DNS, servidor caido, etc.) lo distinguimos
  // de un error de validacion o de servidor: el pedido nunca llego a viajar.
  async function doRequest() {
    try {
      return await fetch(input, { ...init, headers });
    } catch {
      throw toAgroNetworkError("No se pudo conectar con el servidor. Revisa tu conexion a internet e intenta de nuevo.");
    }
  }

  let response = await doRequest();

  if (response.status !== 401) {
    return response;
  }

  // Puede que mientras esperabamos la respuesta, otra pestana/pedido ya haya
  // renovado la sesion: si el token guardado ya cambio, lo usamos directo en
  // vez de pedir otro refresh (que invalidaria el que recien se genero).
  const latestSessionBeforeRefresh = readAgroAuthSession();
  const latestAccessTokenBeforeRefresh = latestSessionBeforeRefresh?.tokens.accessToken?.trim();

  let nextAccessToken: string | undefined;

  if (latestAccessTokenBeforeRefresh && latestAccessTokenBeforeRefresh !== accessToken) {
    nextAccessToken = latestAccessTokenBeforeRefresh;
  } else {
    const refreshedSession = await refreshAgroSession();
    nextAccessToken = refreshedSession?.tokens.accessToken?.trim();
  }

  if (!nextAccessToken) {
    return response;
  }

  headers.set("Authorization", `Bearer ${nextAccessToken}`);
  response = await doRequest();
  return response;
}

// Chequeo liviano de sesion (17/11/2026). true = sigue valida; false = se
// cerro (por ejemplo, alguien entro con la misma cuenta en otro dispositivo).
// Sin conexion no se considera cerrada: se reintenta en el proximo chequeo.
export async function checkAgroSession(): Promise<boolean> {
  try {
    const response = await fetchWithAgroAuth(buildApiUrl("/agro/auth/check"));
    return response.status !== 401;
  } catch (error) {
    return !(error instanceof AgroApiError && error.kind === "auth");
  }
}

// Usuario de la cuenta conectada ("rosendo", "administrador"...), para dejar
// registrado quien hizo cada cosa (17/11/2026).
export function getCurrentAgroUsername(): string | undefined {
  return readAgroAuthSession()?.user.email?.trim().toLowerCase() || undefined;
}
