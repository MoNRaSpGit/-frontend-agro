import { describe, expect, it } from "vitest";
import { AgroApiError, toAgroApiError, toAgroNetworkError } from "./agroApiError";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("toAgroApiError", () => {
  it("classifies 401 and 403 as auth errors", async () => {
    const unauthorized = await toAgroApiError(jsonResponse(401, { message: "Token invalido" }), "fallback");
    const forbidden = await toAgroApiError(jsonResponse(403, { message: "Sin permiso" }), "fallback");

    expect(unauthorized.kind).toBe("auth");
    expect(unauthorized.message).toBe("Token invalido");
    expect(forbidden.kind).toBe("auth");
  });

  it("classifies 409 as a conflict error", async () => {
    const conflict = await toAgroApiError(jsonResponse(409, { message: "Otro dispositivo ya guardo" }), "fallback");
    expect(conflict.kind).toBe("conflict");
    expect(conflict.status).toBe(409);
  });

  it("classifies 400 and 422 as validation errors", async () => {
    const badRequest = await toAgroApiError(jsonResponse(400, { message: "Falta un dato" }), "fallback");
    const unprocessable = await toAgroApiError(jsonResponse(422, { message: "Dato invalido" }), "fallback");

    expect(badRequest.kind).toBe("validation");
    expect(unprocessable.kind).toBe("validation");
  });

  it("classifies 5xx as server errors", async () => {
    const serverError = await toAgroApiError(jsonResponse(500, { message: "Boom" }), "fallback");
    expect(serverError.kind).toBe("server");
  });

  it("classifies anything else as unknown", async () => {
    const teapot = await toAgroApiError(jsonResponse(418, { message: "Soy una tetera" }), "fallback");
    expect(teapot.kind).toBe("unknown");
  });

  it("joins array-shaped validation messages into one string", async () => {
    const error = await toAgroApiError(jsonResponse(400, { message: ["Falta el nombre", "Falta la fecha"] }), "fallback");
    expect(error.message).toBe("Falta el nombre Falta la fecha");
  });

  it("falls back to the provided message when the body has no usable message", async () => {
    const noMessage = await toAgroApiError(jsonResponse(500, {}), "Fallback especifico");
    expect(noMessage.message).toBe("Fallback especifico");
  });

  it("falls back to the provided message when the body is not valid json", async () => {
    const invalidJson = new Response("<html>not json</html>", { status: 500 });
    const error = await toAgroApiError(invalidJson, "Fallback especifico");
    expect(error.message).toBe("Fallback especifico");
  });
});

describe("toAgroNetworkError", () => {
  it("builds a network-kind error with no HTTP status", () => {
    const error = toAgroNetworkError("Sin conexion");
    expect(error).toBeInstanceOf(AgroApiError);
    expect(error.kind).toBe("network");
    expect(error.status).toBeUndefined();
    expect(error.message).toBe("Sin conexion");
  });
});
