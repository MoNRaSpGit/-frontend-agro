import { useState } from "react";
import { AgroWorkspace } from "../features/agro/AgroWorkspace";
import { AgroPersistenceMode } from "../features/agro/agro.client";
import { AGRO_AUTH_SESSION_STORAGE_KEY, AGRO_ACCESS_MODE_STORAGE_KEY, clearAgroSessionStorage } from "../shared/auth/agroSession";
import { loginWithAccount } from "../shared/auth/auth.client";
import { writeJsonStorage } from "../shared/lib/persistence";
const AGRO_DIRECT_ACCOUNT = "Rosendo";
const AGRO_DIRECT_PASSWORD = "lamilagrosa";
const AGRO_DEMO_ACCOUNT = "agrodemo";
const AGRO_DEMO_EMAIL = "agrodemo@saaspro.local";
const AGRO_DEMO_PASSWORD = "demo12345";

type AgroAccessMode = "demo-local" | "backend";

export function App() {
  const [accessMode, setAccessMode] = useState<AgroAccessMode | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  function handleSignOut() {
    clearAgroSessionStorage();
    setAccessMode(null);
    setLoginError(null);
  }

  async function loginWithCredentials(identifier: string, secret: string) {
    setLoginPending(true);
    setLoginError(null);

    try {
      const session = await loginWithAccount(identifier, secret);
      writeJsonStorage(AGRO_AUTH_SESSION_STORAGE_KEY, session);
      writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, "backend");
      setAccessMode("backend");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setLoginPending(false);
    }
  }

  async function loginWithCredentialFallback(
    attempts: Array<{
      identifier: string;
      password: string;
    }>
  ) {
    setLoginPending(true);
    setLoginError(null);

    try {
      let lastError: unknown = null;

      for (const attempt of attempts) {
        try {
          const session = await loginWithAccount(attempt.identifier, attempt.password);
          writeJsonStorage(AGRO_AUTH_SESSION_STORAGE_KEY, session);
          writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, "backend");
          setAccessMode("backend");
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error("No se pudo iniciar sesion.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setLoginPending(false);
    }
  }

  async function handleDirectLogin() {
    await loginWithCredentials(AGRO_DIRECT_ACCOUNT, AGRO_DIRECT_PASSWORD);
  }

  async function handleDemoLogin() {
    await loginWithCredentialFallback([
      { identifier: AGRO_DEMO_ACCOUNT, password: AGRO_DEMO_PASSWORD },
      { identifier: AGRO_DEMO_EMAIL, password: AGRO_DEMO_PASSWORD }
    ]);
  }

  if (!accessMode) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <span className="eyebrow">Agro</span>
          <h1>Ingreso cliente</h1>
          <p>Entrar directo con Rosendo o abrir la cuenta demo sin pasos extra.</p>

          <div className="access-login-actions">
            <button type="button" className="access-submit-button" disabled={loginPending} onClick={handleDirectLogin}>
              {loginPending ? "Ingresando..." : "Rosendo"}
            </button>
            <button
              type="button"
              className="access-demo-button"
              disabled={loginPending}
              onClick={() => {
                void handleDemoLogin();
              }}
            >
              Demo
            </button>
          </div>
          {loginError ? <p className="access-error">{loginError}</p> : null}
        </section>
      </main>
    );
  }

  return <AgroWorkspace persistenceMode={accessMode as AgroPersistenceMode} onSignOut={handleSignOut} />;
}
