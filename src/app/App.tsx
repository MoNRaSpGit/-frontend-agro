import { FormEvent, useState } from "react";
import { AgroWorkspace } from "../features/agro/AgroWorkspace";
import { AgroPersistenceMode } from "../features/agro/agro.client";
import {
  AGRO_ACCESS_MODE_STORAGE_KEY,
  AGRO_AUTH_SESSION_STORAGE_KEY,
  clearAgroSessionStorage
} from "../shared/auth/agroSession";
import { changeAccountPassword, loginWithAccount } from "../shared/auth/auth.client";
import { removeStorageItem, writeJsonStorage } from "../shared/lib/persistence";

const AGRO_DIRECT_ACCOUNT = "rosendo";
const AGRO_DIRECT_PASSWORD = "lamilagrosa";
const AGRO_DEMO_ACCOUNT = "agrodemo";
const AGRO_DEMO_EMAIL = "agrodemo@saaspro.local";
const AGRO_DEMO_PASSWORD = "demo12345";

type AgroAccessMode = "demo-local" | "backend";

export function App() {
  const [accessMode, setAccessMode] = useState<AgroAccessMode | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState(AGRO_DIRECT_ACCOUNT);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState(AGRO_DIRECT_PASSWORD);
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  function handleSignOut() {
    clearAgroSessionStorage();
    setAccessMode(null);
    setLoginError(null);
  }

  async function authenticateWithCredentials(identifier: string, secret: string) {
    const session = await loginWithAccount(identifier, secret);
    writeJsonStorage(AGRO_AUTH_SESSION_STORAGE_KEY, session);
    writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, "backend");
    return session;
  }

  async function loginWithCredentials(identifier: string, secret: string) {
    setLoginPending(true);
    setLoginError(null);

    try {
      await authenticateWithCredentials(identifier, secret);
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
          await authenticateWithCredentials(attempt.identifier, attempt.password);
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

  async function handleDirectLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginWithCredentials(loginIdentifier, loginPassword);
  }

  async function handleDemoLogin() {
    clearAgroSessionStorage();
    removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
    writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, "demo-local");
    setLoginError(null);
    setAccessMode("demo-local");
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordNext.trim().length < 4) {
      setPasswordError("La nueva contrasena debe tener al menos 4 caracteres.");
      return;
    }

    if (passwordNext !== passwordConfirm) {
      setPasswordError("La confirmacion no coincide con la nueva contrasena.");
      return;
    }

    setPasswordPending(true);

    try {
      const session = await authenticateWithCredentials(loginIdentifier, passwordCurrent);
      const accessToken = session?.tokens.accessToken?.trim();

      if (!accessToken) {
        throw new Error("No se pudo validar la sesion para actualizar la contrasena.");
      }

      await changeAccountPassword(accessToken, passwordCurrent, passwordNext);
      clearAgroSessionStorage();
      setAccessMode(null);
      setLoginPassword(passwordNext);
      setPasswordCurrent(passwordNext);
      setPasswordNext("");
      setPasswordConfirm("");
      setPasswordPanelOpen(false);
      setPasswordSuccess("Contrasena actualizada. Ahora entra con el mismo usuario y tu nueva clave.");
    } catch (error) {
      clearAgroSessionStorage();
      setAccessMode(null);
      setPasswordError(error instanceof Error ? error.message : "No se pudo actualizar la contrasena.");
    } finally {
      setPasswordPending(false);
    }
  }

  if (!accessMode) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <span className="eyebrow">Agro</span>
          <h1>Ingreso cliente</h1>
          <p>Rosendo mantiene el mismo usuario y sus mismos datos. Ahora puede entrar con su propia contrasena.</p>

          <form className="access-login-form" onSubmit={(event) => void handleDirectLogin(event)}>
            <label className="access-field">
              <span>Usuario</span>
              <input value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} autoComplete="username" />
            </label>

            <label className="access-field">
              <span>Contrasena</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <div className="access-login-actions">
              <button type="submit" className="access-submit-button" disabled={loginPending || passwordPending}>
                {loginPending ? "Ingresando..." : "Entrar"}
              </button>
              <button
                type="button"
                className="access-demo-button"
                disabled={loginPending || passwordPending}
                onClick={() => {
                  void handleDemoLogin();
                }}
              >
                Demo
              </button>
            </div>
          </form>

          <div className="access-secondary-actions">
            <button
              type="button"
              className="access-text-button"
              disabled={loginPending || passwordPending}
              onClick={() => {
                setPasswordPanelOpen((current) => !current);
                setPasswordError(null);
                setPasswordSuccess(null);
              }}
            >
              {passwordPanelOpen ? "Cancelar cambio de contrasena" : "Definir nueva contrasena para Rosendo"}
            </button>
          </div>

          {passwordPanelOpen ? (
            <form className="access-password-panel" onSubmit={(event) => void handlePasswordChange(event)}>
              <p className="access-helper">
                Esto actualiza la misma cuenta `rosendo`. No cambia el usuario ni toca los datos guardados.
              </p>

              <label className="access-field">
                <span>Contrasena actual</span>
                <input
                  type="password"
                  value={passwordCurrent}
                  onChange={(event) => setPasswordCurrent(event.target.value)}
                  autoComplete="current-password"
                />
              </label>

              <label className="access-field">
                <span>Nueva contrasena</span>
                <input
                  type="password"
                  value={passwordNext}
                  onChange={(event) => setPasswordNext(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <label className="access-field">
                <span>Confirmar nueva contrasena</span>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <button type="submit" className="access-submit-button" disabled={loginPending || passwordPending}>
                {passwordPending ? "Actualizando..." : "Guardar nueva contrasena"}
              </button>
            </form>
          ) : null}

          {loginError ? <p className="access-error">{loginError}</p> : null}
          {passwordError ? <p className="access-error">{passwordError}</p> : null}
          {passwordSuccess ? <p className="access-success">{passwordSuccess}</p> : null}
        </section>
      </main>
    );
  }

  return <AgroWorkspace persistenceMode={accessMode as AgroPersistenceMode} onSignOut={handleSignOut} />;
}
