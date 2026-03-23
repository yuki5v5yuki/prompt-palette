import { useState } from "react";
import { useTranslation } from "react-i18next";
import { healthCheck, getDbStatus } from "./desktop";
import type { HealthCheckResponse, DbStatusResponse } from "./types";
import "./styles.css";

function App() {
  const { t, i18n } = useTranslation();
  const [ipcResult, setIpcResult] = useState<HealthCheckResponse | null>(null);
  const [dbResult, setDbResult] = useState<DbStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestIpc = async () => {
    setError(null);
    const result = await healthCheck();
    if (result) {
      setIpcResult(result);
    } else {
      setError("IPC call failed (not running in Tauri?)");
    }
  };

  const handleTestDb = async () => {
    setError(null);
    const result = await getDbStatus();
    if (result) {
      setDbResult(result);
    } else {
      setError("DB call failed (not running in Tauri?)");
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">{t("app.name")}</h1>
        <p className="app-version">{t("app.version")}</p>
        <p className="app-description">{t("app.description")}</p>
      </header>

      <section className="section">
        <h2 className="section-title">{t("phase0.title")}</h2>

        <div className="test-buttons">
          <button className="btn btn-primary" onClick={handleTestIpc}>
            {t("phase0.testIpc")}
          </button>
          <button className="btn btn-primary" onClick={handleTestDb}>
            {t("phase0.testDb")}
          </button>
        </div>

        <div className="result-box">
          {error && (
            <div>
              <span className="label">{t("phase0.status")}: </span>
              <span className="value error">{error}</span>
            </div>
          )}
          {ipcResult && (
            <div>
              <span className="label">{t("phase0.status")}: </span>
              <span className="value success">
                {ipcResult.status} ({ipcResult.version})
              </span>
            </div>
          )}
          {dbResult && (
            <div>
              <span className="label">{t("phase0.schemaVersion")}: </span>
              <span className="value success">{dbResult.schemaVersion}</span>
              <br />
              <span className="label">{t("phase0.tableCount")}: </span>
              <span className="value success">{dbResult.tableCount}</span>
            </div>
          )}
          {!error && !ipcResult && !dbResult && (
            <span className="label">{t("phase0.waiting")}</span>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t("common.language")}</h2>
        <div className="lang-switcher">
          <button
            className={`lang-btn ${i18n.language === "ja" ? "active" : ""}`}
            onClick={() => changeLanguage("ja")}
          >
            {t("common.japanese")}
          </button>
          <button
            className={`lang-btn ${i18n.language === "en" ? "active" : ""}`}
            onClick={() => changeLanguage("en")}
          >
            {t("common.english")}
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
