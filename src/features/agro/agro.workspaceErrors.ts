import { AgroApiError } from "../../shared/errors/agroApiError";

// Id fijo para el toast de error de guardado: asi, si un guardado posterior
// tiene exito, se puede cerrar puntualmente ese aviso en vez de dejarlo
// colgado en pantalla diciendo "no se guardo" cuando en realidad si se guardo.
export const AGRO_WORKSPACE_SAVE_ERROR_TOAST_ID = "agro-workspace-save-error";

export function friendlyAgroToastMessage(message: string, kind: "success" | "error") {
  const normalized = message.trim().toLowerCase();

  if (kind === "error") {
    if (normalized.includes("potrero destino") && normalized.includes("distinto")) {
      return "El potrero destino tiene que ser distinto del origen.";
    }
    if (normalized.includes("solo hay")) {
      return message;
    }
  }

  if (kind === "success") {
    if (normalized.includes("potreros fusionados")) {
      return "Traslado de potreros realizado.";
    }
    if (normalized.includes("potrero eliminado")) {
      return "Potrero eliminado correctamente.";
    }
    if (normalized.includes("movimiento de animales guardado")) {
      return "Movimiento de animales guardado.";
    }
    if (normalized.includes("movimiento de animales actualizado")) {
      return "Movimiento de animales actualizado.";
    }
    if (normalized.includes("movimiento contable guardado")) {
      return "Movimiento contable guardado.";
    }
    if (normalized.includes("movimiento contable actualizado")) {
      return "Movimiento contable actualizado.";
    }
    if (normalized.includes("registro de lluvia guardado")) {
      return "Registro de lluvia guardado.";
    }
    if (normalized.includes("registro de lluvia actualizado")) {
      return "Registro de lluvia actualizado.";
    }
    if (normalized.includes("tratamiento sanitario guardado")) {
      return "Tratamiento sanitario guardado.";
    }
    if (normalized.includes("tratamiento sanitario actualizado")) {
      return "Tratamiento sanitario actualizado.";
    }
    if (normalized.includes("tipo de cambio guardado")) {
      return "Tipo de cambio guardado.";
    }
    if (normalized.includes("tipo de cambio actualizado")) {
      return "Tipo de cambio actualizado.";
    }
    if (normalized.includes("stock inicial cargado")) {
      return "Carga inicial guardada.";
    }
  }

  return message;
}

// Convierte el error real de una carga/guardado del workspace en un mensaje
// especifico segun la causa, en vez de un unico "no se pudo guardar"
// generico que no distinguia error humano de error de servidor/programacion.
export function describeAgroWorkspaceError(error: unknown, action: "guardar" | "cargar") {
  if (error instanceof AgroApiError) {
    switch (error.kind) {
      case "network":
        return `No se pudo ${action} el campo o potrero: sin conexion con el servidor. Revisa tu internet e intenta de nuevo.`;
      case "auth":
        return `No se pudo ${action}: tu sesion vencio. Volve a iniciar sesion para seguir cargando datos.`;
      case "server":
        return `No se pudo ${action}: hubo un error en el servidor. Intenta de nuevo en unos minutos.`;
      case "validation":
        return `No se pudo ${action}: ${error.message}`;
      case "conflict":
        return `No se pudo ${action}: otro dispositivo ya guardo cambios mas nuevos. Recarga la pagina (F5) antes de seguir editando.`;
      default:
        return `No se pudo ${action} el campo o potrero (${error.message}).`;
    }
  }

  return error instanceof Error ? error.message : `No se pudo ${action} el campo o potrero.`;
}
