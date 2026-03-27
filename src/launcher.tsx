import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import Launcher from "./components/Launcher";
import "./launcher.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Launcher />
  </React.StrictMode>
);
