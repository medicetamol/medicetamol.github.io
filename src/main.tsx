import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { installAutoRefresh } from "./lib/autoRefresh";
import { installViewportLock } from "./lib/lockZoom";
import "./lib/pwa"; // starts listening for the browser install prompt immediately
import "./theme.css";
import "./index.css";

installAutoRefresh(); // reload after 6h+ away (pull-to-refresh is off)
installViewportLock(); // no page zoom / rubber-band pull (iOS ignores user-scalable=no)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

// Service worker — makes the app installable (no caching, so updates always load fresh).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // not fatal: the site still works, it just can't be installed
    });
  });
}
