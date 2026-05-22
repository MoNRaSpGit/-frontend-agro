import { FormEvent, useState } from "react";
import { AgroWorkspace } from "../features/agro/AgroWorkspace";
import { AgroPersistenceMode } from "../features/agro/agro.client";
import { AuthSession, loginWithAccount } from "../shared/auth/auth.client";
import { readJsonStorage, removeStorageItem, writeJsonStorage } from "../shared/lib/persistence";

const AGRO_ACCESS_MODE_STORAGE_KEY = "frontend-agro.access-mode.v1";
const AGRO_AUTH_SESSION_STORAGE_KEY = "frontend-agro.auth-session.v1";
const AGRO_DIRECT_ACCOUNT = "Rosendo";
const AGRO_DIRECT_PASSWORD = "lamilagrosa";

type AgroAccessMode = "demo-local" | "backend";

export function App() {
  const initialAccessMode = readJsonStorage<AgroAccessMode | null>(AGRO_ACCESS_MODE_STORAGE_KEY, null);
  const initialAuthSession = readJsonStorage<AuthSession | null>(AGRO_AUTH_SESSION_STORAGE_KEY, null);
  const [accessMode, setAccessMode] = useState<AgroAccessMode | null>(
    initialAccessMode === "backend" && !initialAuthSession ? null : initialAccessMode
  );
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  function handleSelectMode(mode: AgroAccessMode) {
    if (mode === "demo-local") {
      removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
    }

    writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, mode);
    setAccessMode(mode);
  }

  function handleSignOut() {
    removeStorageItem(AGRO_AUTH_SESSION_STORAGE_KEY);
    removeStorageItem(AGRO_ACCESS_MODE_STORAGE_KEY);
    setAccessMode(null);
    setAccount("");
    setPassword("");
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
      setPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setLoginPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginWithCredentials(account, password);
  }

  async function handleDirectLogin() {
    setAccount(AGRO_DIRECT_ACCOUNT);
    setPassword(AGRO_DIRECT_PASSWORD);
    await loginWithCredentials(AGRO_DIRECT_ACCOUNT, AGRO_DIRECT_PASSWORD);
  }

  if (!accessMode) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <span className="eyebrow">Agro</span>
          <h1>Ingreso cliente</h1>
          <p>Entrar directo con el cliente actual o usar el acceso manual si necesitás probar otra cuenta.</p>

          <div className="access-login-actions">
            <button type="button" className="access-submit-button" disabled={loginPending} onClick={handleDirectLogin}>
              {loginPending ? "Ingresando..." : "Entrar Rosendo"}
            </button>
            <button type="button" className="access-demo-button" onClick={() => handleSelectMode("demo-local")}>
              Entrar demo local
            </button>
          </div>

          <form className="access-login-form" onSubmit={handleSubmit}>
            <label className="access-field">
              <span>Cuenta</span>
              <input
                type="text"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="Rosendo"
                autoComplete="username"
                required
              />
            </label>

            <label className="access-field">
              <span>Contrasena</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="lamilagrosa"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError ? <p className="access-error">{loginError}</p> : null}

            <button type="submit" className="access-demo-button" disabled={loginPending}>
              Usar otra cuenta
            </button>
          </form>
        </section>
      </main>
    );
  }

  return <AgroWorkspace persistenceMode={accessMode as AgroPersistenceMode} onSignOut={handleSignOut} />;
}
