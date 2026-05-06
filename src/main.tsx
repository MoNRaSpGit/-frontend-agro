import React from "react";
import ReactDOM from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { App } from "./app/App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <>
      <App />
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
