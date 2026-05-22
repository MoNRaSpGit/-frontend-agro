import { useState } from "react";
import { AgroWorkspace } from "../features/agro/AgroWorkspace";
import { AgroPersistenceMode } from "../features/agro/agro.client";
import { AGRO_AUTH_SESSION_STORAGE_KEY, AGRO_ACCESS_MODE_STORAGE_KEY, clearAgroSessionStorage } from "../shared/auth/agroSession";
import { loginWithAccount } from "../shared/auth/auth.client";
import { writeJsonStorage } from "../shared/lib/persistence";
const AGRO_DIRECT_ACCOUNT = "Rosendo";
const AGRO_DIRECT_PASSWORD = "lamilagrosa";
const AGRO_DEMO_ACCOUNT = "agrodemo";
const AGRO_DEMO_GATE_PASSWORD = "123";

type AgroAccessMode = "demo-local" | "backend";

export function App() {
  const [accessMode, setAccessMode] = useState<AgroAccessMode | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [demoPassword, setDemoPassword] = useState("");

  function handleSignOut() {
    clearAgroSessionStorage();
    setAccessMode(null);
    setLoginError(null);
    setShowDemoPassword(false);
    setDemoPassword("");
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

  async function handleDirectLogin() {
    await loginWithCredentials(AGRO_DIRECT_ACCOUNT, AGRO_DIRECT_PASSWORD);
  }

  async function handleDemoLogin() {
    if (demoPassword.trim() !== AGRO_DEMO_GATE_PASSWORD) {
      setLoginError("Contrasena demo incorrecta.");
      return;
    }

    await loginWithCredentials(AGRO_DEMO_ACCOUNT, demoPassword);
  }

  function handleOpenDemoModal() {
    setLoginError(null);
    setDemoPassword("");
    setShowDemoPassword(true);
  }

  function handleCloseDemoModal() {
    setLoginError(null);
    setDemoPassword("");
    setShowDemoPassword(false);
  }

  if (!accessMode) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <span className="eyebrow">Agro</span>
          <h1>Ingreso cliente</h1>
          <p>Entrar directo con Rosendo o usar el acceso demo con clave separada.</p>

          <div className="access-login-actions">
            <button type="button" className="access-submit-button" disabled={loginPending} onClick={handleDirectLogin}>
              {loginPending ? "Ingresando..." : "Rosendo"}
            </button>
            <button
              type="button"
              className="access-demo-button"
              disabled={loginPending}
              onClick={handleOpenDemoModal}
            >
              Demo
            </button>
          </div>

          {showDemoPassword ? (
            <div className="confirm-modal-backdrop" role="presentation" onClick={handleCloseDemoModal}>
              <form
                className="confirm-modal"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleDemoLogin();
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="confirm-modal-copy">
                  <strong>Ingrese contrasena</strong>
                </div>

                <label className="access-field">
                  <input
                    type="password"
                    value={demoPassword}
                    onChange={(event) => {
                      setDemoPassword(event.target.value);
                      setLoginError(null);
                    }}
                    autoComplete="current-password"
                    required
                    autoFocus
                  />
                </label>

                {loginError ? <p className="access-error">{loginError}</p> : null}

                <div className="action-row">
                  <button type="submit" className="primary-button" disabled={loginPending || !demoPassword.trim()}>
                    {loginPending ? "Ingresando..." : "Entrar"}
                  </button>
                  <button type="button" className="ghost-button" disabled={loginPending} onClick={handleCloseDemoModal}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {!showDemoPassword && loginError ? <p className="access-error">{loginError}</p> : null}
        </section>
      </main>
    );
  }

  return <AgroWorkspace persistenceMode={accessMode as AgroPersistenceMode} onSignOut={handleSignOut} />;
}
