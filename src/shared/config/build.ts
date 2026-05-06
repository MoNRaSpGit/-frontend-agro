export const buildMeta = {
  productKey: "agro",
  productName: "SaasPro Agro",
  mode: import.meta.env.MODE,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000/api/v1"
} as const;
