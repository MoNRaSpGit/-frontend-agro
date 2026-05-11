import { useEffect, useState, type CSSProperties } from "react";
import { fetchPublishedFrontendBuildMeta, FRONTEND_BUILD_INFO } from "../config/build";

const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 1000;

export function AppUpdateNotice() {
  const [show, setShow] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkForUpdates() {
      try {
        const published = await fetchPublishedFrontendBuildMeta();
        if (!mounted) {
          return;
        }

        setShow(Boolean(published.releaseSha && published.releaseSha !== FRONTEND_BUILD_INFO.releaseSha));
      } catch {
        if (mounted) {
          setShow(false);
        }
      }
    }

    void checkForUpdates();

    const intervalId = window.setInterval(() => {
      void checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdates();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);

  function handleUpdate() {
    setIsUpdating(true);
    window.setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  if (!show && !isUpdating) {
    return null;
  }

  return (
    <aside role="status" aria-live="polite" style={noticeStyle}>
      <strong>{isUpdating ? "Actualizando..." : "Hay una version nueva disponible"}</strong>
      {!isUpdating ? (
        <button type="button" onClick={handleUpdate} style={buttonStyle}>
          Actualizar
        </button>
      ) : null}
    </aside>
  );
}

const noticeStyle: CSSProperties = {
  position: "fixed",
  left: 16,
  bottom: 16,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "min(390px, calc(100vw - 32px))",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid rgba(21, 92, 63, 0.2)",
  background: "#f7fff9",
  color: "#163225",
  boxShadow: "0 14px 34px rgba(19, 45, 33, 0.16)"
};

const buttonStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid rgba(21, 92, 63, 0.2)",
  background: "#2b7a57",
  color: "#f8fffb",
  fontWeight: 800,
  cursor: "pointer"
};
