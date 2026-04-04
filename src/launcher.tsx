import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import Launcher from "./components/Launcher";
import "./launcher.css";

// Apply saved theme & font size before first render
const savedMode = localStorage.getItem("themeMode") || "system";
const resolved =
  savedMode === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : savedMode;
document.documentElement.setAttribute("data-theme", resolved);

const savedFontSize = localStorage.getItem("fontSize");
if (savedFontSize && savedFontSize !== "medium") {
  document.documentElement.setAttribute("data-font-size", savedFontSize);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Launcher />
  </React.StrictMode>
);
