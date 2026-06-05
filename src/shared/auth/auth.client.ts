import { buildApiUrl } from "../config/api";

export type AuthSession = {
  user: {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
  };
  tenantContext: {
    tenant: {
      id: number;
      name: string;
      slug: string;
      status: string;
    };
    membership: {
      role: string;
      status: string;
      isDefault: boolean;
    };
    billing: {
      status: "active" | "grace_period" | "pending_manual_block" | "blocked";
      paidUntil: string | null;
      graceUntil: string | null;
      blockedReason: string | null;
    };
    modules: string[];
    products: Array<{
      key: string;
      label: string;
      frontend: string;
    }>;
    preferredFrontend: string | null;
  } | null;
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    accessTtl: string;
    refreshTtl: string;
  };
};

export async function loginWithAccount(identifier: string, password: string) {
  const response = await fetch(buildApiUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      identifier,
      password
    })
  });

  if (!response.ok) {
    throw new Error(await readAuthError(response, "Cuenta o contrasena incorrecta."));
  }

  return (await response.json()) as AuthSession;
}

export async function changeAccountPassword(accessToken: string, currentPassword: string, newPassword: string) {
  const response = await fetch(buildApiUrl("/auth/change-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      currentPassword,
      newPassword
    })
  });

  if (!response.ok) {
    throw new Error(await readAuthError(response, "No se pudo actualizar la contrasena."));
  }

  return (await response.json()) as { success: boolean };
}

async function readAuthError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(". ");
    }

    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}
