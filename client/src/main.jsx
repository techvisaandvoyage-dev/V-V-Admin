// ============================================================
//  main.jsx — Application Entry Point
//  Mounts the React app to the DOM.
//  StrictMode enabled for development warnings.
// ============================================================
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Mount the React app to the #root div in index.html
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
