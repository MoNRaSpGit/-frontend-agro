export type AgroApiErrorKind = "network" | "auth" | "validation" | "server" | "conflict" | "unknown";

// Permite distinguir "el usuario cargo mal un dato" (validation, con el
// mensaje real del backend) de "se corto la conexion" (network), "la sesion
// vencio" (auth) o "se rompio el servidor" (server) - antes todo caia en un
// unico mensaje generico y no se sabia si era error humano o de programacion.
export class AgroApiError extends Error {
  readonly kind: AgroApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: AgroApiErrorKind, status?: number) {
    super(message);
    this.name = "AgroApiError";
    this.kind = kind;
    this.status = status;
  }
}

export async function toAgroApiError(response: Response, fallbackMessage: string): Promise<AgroApiError> {
  let backendMessage: string | undefined;

  try {
    const body = (await response.json()) as { message?: string | string[] };
    const rawMessage = body?.message;
    backendMessage = Array.isArray(rawMessage) ? rawMessage.join(" ") : typeof rawMessage === "string" ? rawMessage : undefined;
  } catch {
    // El cuerpo no era JSON valido (o ya se consumio): seguimos con el fallback.
  }

  const status = response.status;
  const kind: AgroApiErrorKind =
    status === 401 || status === 403
      ? "auth"
      : status === 409
        ? "conflict"
        : status === 400 || status === 422
          ? "validation"
          : status >= 500
            ? "server"
            : "unknown";

  return new AgroApiError(backendMessage || fallbackMessage, kind, status);
}

export function toAgroNetworkError(fallbackMessage: string) {
  return new AgroApiError(fallbackMessage, "network");
}
