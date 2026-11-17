import { FormEvent, useState } from "react";
import { AgroWorkspace } from "../features/agro/AgroWorkspace";
import { AgroPersistenceMode } from "../features/agro/agro.client";
import {
  AGRO_ACCESS_MODE_STORAGE_KEY,
  AGRO_AUTH_SESSION_STORAGE_KEY,
  clearAgroSessionStorage,
  consumeSessionReplacedFlag,
  readAgroAuthSession
} from "../shared/auth/agroSession";

// Una sola sesion por cuenta (17/11/2026): si alguien entra con la misma
// cuenta en otro dispositivo, este vuelve al login con este aviso.
const SESSION_REPLACED_MESSAGE =
  "Se ingreso con esta cuenta desde otro dispositivo y esta sesion se cerro. Lo que no estaba guardado se descarto.";
import { changeAccountPassword, loginWithAccount } from "../shared/auth/auth.client";
import { readJsonStorage, removeStorageItem, writeJsonStorage } from "../shared/lib/persistence";

// "Recordar mi cuenta" (17/11/2026): ahora hay mas de un usuario (Rosendo y el
// contador). Cada dispositivo recuerda el ULTIMO usuario que marco la casilla,
// asi solo hay que escribir la contrasena. Se guarda solo el nombre de usuario,
// nunca la contrasena.
const REMEMBERED_ACCOUNT_STORAGE_KEY = "agro.rememberedAccount";

// La contrasena NUNCA se recuerda (pedido explicito 17/11/2026). Los
// navegadores ofrecen guardarla y autocompletarla por su cuenta cuando ven un
// campo type="password", asi que el campo de contrasena del login se dibuja
// como texto con los puntitos por CSS: el navegador ya no lo trata como una
// contrasena. Si el navegador no soporta ese CSS, queda el campo normal con
// autocomplete="new-password" (que evita que autocomplete la guardada).
const MASKED_TEXT_SUPPORTED = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("-webkit-text-security", "disc");

// Pedido explicito (26/09/2026): el cliente quiere ver/escribir "Rosendo"
// con mayuscula en el login. Es solo visual -- el usuario real en la BDD
// sigue en minuscula, por eso se normaliza a minuscula justo antes de
// autenticar (ver authenticateWithCredentials), sin tocar nada mas.
const AGRO_DIRECT_ACCOUNT = "Rosendo";

type AgroAccessMode = "demo-local" | "backend";

// Antes esto arrancaba siempre en null, mandando al login de cero en
// cada F5 -- aunque la sesion (access mode + tokens) ya estuviera guardada
// en localStorage desde antes (agroSession.ts la escribe ahi, sobrevive un
// refresh sin problema). El estado de React nunca la volvia a leer al
// arrancar. Ahora se hidrata del storage: si habia una sesion de backend
// con token guardado, se retoma tal cual sin pedir contrasena de nuevo; si
// el token vencio de verdad, el resto del flujo ya sabe mandarlo al login
// (ver AgroHomePage.tsx, "No cerrar sesion sola").
function readStoredAccessMode(): AgroAccessMode | null {
  const storedMode = readJsonStorage<AgroAccessMode | null>(AGRO_ACCESS_MODE_STORAGE_KEY, null);

  if (storedMode === "backend") {
    const session = readAgroAuthSession();
    return session?.tokens.accessToken?.trim() ? "backend" : null;
  }

  // El modo "Demo" se saco (17/11/2026): un acceso viejo guardado vuelve al login.
  return null;
}

export function App() {
  const [accessMode, setAccessMode] = useState<AgroAccessMode | null>(readStoredAccessMode);
  const [rememberedAccount] = useState(() => {
    const stored = readJsonStorage<string | null>(REMEMBERED_ACCOUNT_STORAGE_KEY, null);
    return typeof stored === "string" && stored.trim() ? stored.trim() : null;
  });
  const [loginIdentifier, setLoginIdentifier] = useState(rememberedAccount ?? AGRO_DIRECT_ACCOUNT);
  const [rememberAccount, setRememberAccount] = useState(Boolean(rememberedAccount));
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(() => (consumeSessionReplacedFlag() ? SESSION_REPLACED_MESSAGE : null));
  const [loginPending, setLoginPending] = useState(false);
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Ninguna contrasena queda en la memoria de la pantalla: se borran al entrar y al
  // salir, asi el login vuelve a salir solo con el usuario (pedido 17/11/2026).
  function clearTypedPasswords() {
    setLoginPassword("");
    setPasswordCurrent("");
    setPasswordNext("");
    setPasswordConfirm("");
  }

  function handleSignOut() {
    clearAgroSessionStorage();
    clearTypedPasswords();
    setPasswordPanelOpen(false);
    setPasswordError(null);
    setPasswordSuccess(null);
    setAccessMode(null);
    setLoginError(consumeSessionReplacedFlag() ? SESSION_REPLACED_MESSAGE : null);
  }

  async function authenticateWithCredentials(identifier: string, secret: string) {
    const session = await loginWithAccount(identifier.trim().toLowerCase(), secret);
    writeJsonStorage(AGRO_AUTH_SESSION_STORAGE_KEY, session);
    writeJsonStorage(AGRO_ACCESS_MODE_STORAGE_KEY, "backend");
    return session;
  }

  async function loginWithCredentials(identifier: string, secret: string) {
    setLoginPending(true);
    setLoginError(null);

    try {
      await authenticateWithCredentials(identifier, secret);
      // Solo se recuerda si el login salio bien (nunca un usuario mal escrito).
      if (rememberAccount) writeJsonStorage(REMEMBERED_ACCOUNT_STORAGE_KEY, identifier.trim());
      else removeStorageItem(REMEMBERED_ACCOUNT_STORAGE_KEY);
      clearTypedPasswords();
      setAccessMode("backend");
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
      clearTypedPasswords();
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
          <div className="access-brand-row">
            <img src={`${import.meta.env.BASE_URL}LogoRosendo.jpeg`} alt="" className="access-logo" />
            <span className="eyebrow">Agro</span>
          </div>
          <h1>Ingreso cliente</h1>

          <form className="access-login-form" onSubmit={(event) => void handleDirectLogin(event)}>
            <label className="access-field">
              <span>Usuario</span>
              <input
                value={loginIdentifier}
                onChange={(event) => setLoginIdentifier(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>

            <label className="access-field">
              <span>Contrasena</span>
              <input
                type={MASKED_TEXT_SUPPORTED ? "text" : "password"}
                className={MASKED_TEXT_SUPPORTED ? "access-masked-input" : undefined}
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete={MASKED_TEXT_SUPPORTED ? "off" : "new-password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus={Boolean(rememberedAccount)}
              />
            </label>

            <label className="access-remember">
              <input type="checkbox" checked={rememberAccount} onChange={(event) => setRememberAccount(event.target.checked)} />
              <span>Recordar mi cuenta</span>
            </label>

            <div className="access-login-actions">
              <button type="submit" className="access-submit-button" disabled={loginPending || passwordPending}>
                {loginPending ? "Ingresando..." : "Entrar"}
              </button>
            </div>
          </form>

          <div className="access-secondary-actions">
            <button
              type="button"
              className="access-demo-button"
              disabled={loginPending || passwordPending}
              onClick={() => {
                setPasswordPanelOpen((current) => !current);
                setPasswordError(null);
                setPasswordSuccess(null);
              }}
            >
              {passwordPanelOpen ? "Cancelar cambio de contrasena" : "Definir nueva contrasena"}
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
