import React from "react";
import ReactDOM from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { App } from "./app/App";
import { AppUpdateNotice } from "./shared/components/AppUpdateNotice";
import "./styles/global.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Installability should not block app boot if registration fails.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <>
      <App />
      <AppUpdateNotice />
      <ToastContainer
        position="bottom-right"
        hideProgressBar
        newestOnTop
        closeButton
        pauseOnFocusLoss={false}
        pauseOnHover
        draggable={false}
        theme="light"
      />
    </>
  </React.StrictMode>
);
