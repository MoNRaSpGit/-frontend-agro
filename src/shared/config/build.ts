declare const __APP_VERSION__: string;
declare const __APP_RELEASE_SHA__: string;
declare const __APP_RELEASE_CREATED_AT__: string | null;

export type FrontendBuildMeta = {
  version: string;
  releaseSha: string;
  releaseCreatedAt: string | null;
  environment: string;
};

export const FRONTEND_BUILD_INFO: FrontendBuildMeta = {
  version: __APP_VERSION__,
  releaseSha: __APP_RELEASE_SHA__,
  releaseCreatedAt: __APP_RELEASE_CREATED_AT__,
  environment: import.meta.env.MODE
};

export const buildMeta = {
  productKey: "agro",
  productName: "SaasPro Agro",
  mode: import.meta.env.MODE,
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (import.meta.env.PROD ? "https://saasproback.onrender.com/api/v1" : "http://localhost:3000/api/v1")
} as const;

export async function fetchPublishedFrontendBuildMeta() {
  const response = await fetch(`${import.meta.env.BASE_URL}app-build.json?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar metadata del frontend");
  }

  return (await response.json()) as FrontendBuildMeta;
}
