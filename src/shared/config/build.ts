export const buildMeta = {
  productKey: "agro",
  productName: "SaasPro Agro",
  mode: import.meta.env.MODE,
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (import.meta.env.PROD ? "https://saasproback.onrender.com/api/v1" : "http://localhost:3000/api/v1")
} as const;
