import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./providers/ThemeProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { WalletProvider } from "./providers/WalletProvider";
import { RegistryProvider } from "./providers/RegistryProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <ThemeProvider>
        <ToastProvider>
          <WalletProvider>
            <RegistryProvider>
              <App />
            </RegistryProvider>
          </WalletProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
