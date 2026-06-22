import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { registerServiceWorker } from "./lib/registerServiceWorker.js";
import { initCapacitorAuth } from "./lib/initCapacitorAuth.js";

registerServiceWorker();
initCapacitorAuth();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
