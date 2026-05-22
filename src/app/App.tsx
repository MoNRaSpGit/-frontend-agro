import { FormEvent, useState } from "react";
import { AgroWorkspace } from "../features/agro/AgroWorkspace";
import { AgroPersistenceMode } from "../features/agro/agro.client";
import { AuthSession, loginWithAccount } from "../shared/auth/auth.client";
import { readJsonStorage, removeStorageItem, writeJsonStorage } from "../shared/lib/persistence";

const AGRO_ACCESS_MODE_STORAGE_KEY = "frontend-agro.access-mode.v1";
const AGRO_AUTH_SESSION_STORAGE_KEY = "frontend-agro.auth-session.v1";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginPending(true);
    setLoginError(null);

    try {
      const session = await loginWithAccount(account, password);
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

  if (!accessMode) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <span className="eyebrow">Agro</span>
          <h1>Ingreso cliente</h1>
          <p>Entrá con tu cuenta y contrasena para abrir el workspace actual del establecimiento.</p>

          <form className="access-login-form" onSubmit={handleSubmit}>
            <label className="access-field">
              <span>Cuenta</span>
              <input
                type="text"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="lamilagrosa"
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
                placeholder="1994"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError ? <p className="access-error">{loginError}</p> : null}

            <div className="access-login-actions">
              <button type="submit" className="access-submit-button" disabled={loginPending}>
                {loginPending ? "Ingresando..." : "Entrar cliente actual"}
              </button>
              <button type="button" className="access-demo-button" onClick={() => handleSelectMode("demo-local")}>
                Entrar demo local
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <AgroWorkspace persistenceMode={accessMode as AgroPersistenceMode} />
    </>
  );
}
