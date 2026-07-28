import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "./auth.client";

// agroSession.ts solo usa window.localStorage y fetch: se simulan los dos a
// mano (sin jsdom) para poder probar la carrera de refresh sin depender de
// un navegador real.
function createLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    }
  } satisfies Storage;
}

function makeSession(accessToken: string, refreshToken: string): AuthSession {
  return {
    user: { id: 1, email: "rosendo@test.local", fullName: "Rosendo", role: "owner" },
    tenantContext: null,
    tokens: { accessToken, refreshToken, tokenType: "Bearer", accessTtl: "15m", refreshTtl: "7d" }
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("fetchWithAgroAuth / refreshAgroSession (race condition fix)", () => {
  let localStorageStub: Storage;

  beforeEach(async () => {
    vi.resetModules();
    localStorageStub = createLocalStorageStub();
    vi.stubGlobal("window", { localStorage: localStorageStub });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the request straight through when the access token is still valid", async () => {
    const { readAgroAuthSession, fetchWithAgroAuth, AGRO_AUTH_SESSION_STORAGE_KEY } = await import("./agroSession");
    localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("access-1", "refresh-1")));

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithAgroAuth("https://api.test/agro/workspace");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readAgroAuthSession()?.tokens.accessToken).toBe("access-1");
  });

  it("refreshes once and retries after a 401, rotating both tokens", async () => {
    const { fetchWithAgroAuth, readAgroAuthSession, AGRO_AUTH_SESSION_STORAGE_KEY } = await import("./agroSession");
    localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("expired-access", "refresh-1")));

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, makeSession("new-access", "new-refresh")));
      }
      return Promise.resolve(jsonResponse(401, { message: "expired" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    // La primera llamada real (no de refresh) sale con el token vencido, pega 401,
    // y recien la SEGUNDA (el reintento) sale con el token nuevo.
    let realRequestCount = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, makeSession("new-access", "new-refresh")));
      }
      realRequestCount += 1;
      return Promise.resolve(realRequestCount === 1 ? jsonResponse(401, { message: "expired" }) : jsonResponse(200, { ok: true }));
    });

    const response = await fetchWithAgroAuth("https://api.test/agro/workspace");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 401 inicial + refresh + reintento
    expect(readAgroAuthSession()?.tokens.accessToken).toBe("new-access");
    expect(readAgroAuthSession()?.tokens.refreshToken).toBe("new-refresh");
  });

  it("dedupes concurrent refreshes: two requests failing around the same time only trigger one /auth/refresh call", async () => {
    const { fetchWithAgroAuth, AGRO_AUTH_SESSION_STORAGE_KEY } = await import("./agroSession");
    localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("expired-access", "refresh-1")));

    let refreshCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        refreshCallCount += 1;
        return Promise.resolve(jsonResponse(200, makeSession("new-access", "new-refresh")));
      }
      // Todo pedido "real" devuelve 401 la primera vez que se ve esa URL en esta
      // corrida de test (simulamos que ambos pedidos concurrentes arrancaron
      // con el token vencido).
      return Promise.resolve(jsonResponse(401, { message: "expired" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      fetchWithAgroAuth("https://api.test/agro/workspace"),
      fetchWithAgroAuth("https://api.test/agro/workspace")
    ]);

    expect(refreshCallCount).toBe(1);
  });

  it("uses a token another tab already refreshed instead of rotating it again", async () => {
    const { fetchWithAgroAuth, AGRO_AUTH_SESSION_STORAGE_KEY } = await import("./agroSession");
    localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("expired-access", "refresh-1")));

    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/refresh")) {
        throw new Error("no deberia llamar a refresh: otra pestana ya lo hizo");
      }

      const authHeader = (init?.headers as Headers)?.get?.("Authorization") ?? "";
      if (authHeader.includes("expired-access")) {
        // Justo antes de que este pedido responda 401, "otra pestana" ya
        // renovo la sesion y escribio el token nuevo en localStorage.
        localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("access-from-other-tab", "refresh-from-other-tab")));
        return Promise.resolve(jsonResponse(401, { message: "expired" }));
      }

      return Promise.resolve(jsonResponse(200, { ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithAgroAuth("https://api.test/agro/workspace");

    expect(response.status).toBe(200);
    // Nunca se llamo a /auth/refresh: se detecto el token nuevo en localStorage y se reintento directo con el.
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/refresh"));
    expect(refreshCalls).toHaveLength(0);
  });

  it("adopts a session another tab produced even if this tab's own refresh attempt gets rejected", async () => {
    const { fetchWithAgroAuth, readAgroAuthSession, AGRO_AUTH_SESSION_STORAGE_KEY } = await import("./agroSession");
    localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("expired-access", "refresh-1")));

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        // El refresh token que teniamos ya fue canjeado por otra pestana:
        // el backend lo rechaza, pero para entonces localStorage ya tiene
        // la sesion nueva que genero esa otra pestana.
        localStorageStub.setItem(
          AGRO_AUTH_SESSION_STORAGE_KEY,
          JSON.stringify(makeSession("access-from-other-tab", "refresh-from-other-tab"))
        );
        return Promise.resolve(jsonResponse(401, { message: "refresh token revoked" }));
      }
      return Promise.resolve(jsonResponse(401, { message: "expired" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithAgroAuth("https://api.test/agro/workspace");

    // No se borro la sesion: se adopto la que dejo la otra pestana.
    expect(readAgroAuthSession()?.tokens.accessToken).toBe("access-from-other-tab");
  });

  it("clears the session when the refresh genuinely fails and no newer session appears", async () => {
    const { fetchWithAgroAuth, readAgroAuthSession, AGRO_AUTH_SESSION_STORAGE_KEY } = await import("./agroSession");
    localStorageStub.setItem(AGRO_AUTH_SESSION_STORAGE_KEY, JSON.stringify(makeSession("expired-access", "refresh-1")));

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve(jsonResponse(401, { message: "refresh token expired" }));
      }
      return Promise.resolve(jsonResponse(401, { message: "expired" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithAgroAuth("https://api.test/agro/workspace");

    expect(readAgroAuthSession()).toBeNull();
  });
});
