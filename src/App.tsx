import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Sidebar, { type NavTab } from "./components/Sidebar";
import TemplateList from "./components/TemplateList";
import TagManager from "./components/TagManager";
import VariablePackageManager from "./components/VariablePackageManager";
import ImportExport from "./components/ImportExport";
import Settings from "./components/Settings";
import Onboarding from "./components/Onboarding";
import { ToastProvider } from "./components/Toast";
import { isOnboarded, seedSampleData } from "./desktop";
import "./styles.css";

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<NavTab>("templates");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const checkOnboarding = useCallback(async () => {
    setBootstrapError(null);
    const r = await isOnboarded();
    const dismissed = localStorage.getItem("onboarding_done");
    if (r.ok) {
      if (r.data === false && !dismissed) {
        setShowOnboarding(true);
      }
    } else if (r.reason === "not_tauri") {
      // Browser preview without Tauri — skip onboarding gate
    } else if (r.reason === "invoke_failed") {
      setBootstrapError(t("app.dataLoadFailed"));
    }
    setReady(true);
  }, [t]);

  // Apply saved theme + check onboarding on mount
  useEffect(() => {
    const savedMode = localStorage.getItem("themeMode") || "system";
    const resolved = savedMode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : savedMode;
    document.documentElement.setAttribute("data-theme", resolved);

    const savedFontSize = localStorage.getItem("fontSize");
    if (savedFontSize && savedFontSize !== "medium") {
      document.documentElement.setAttribute("data-font-size", savedFontSize);
    }

    checkOnboarding();
  }, [checkOnboarding]);

  const handleLoadSamples = async () => {
    setSampleError(null);
    const r = await seedSampleData();
    if (!r.ok) {
      setSampleError(t("onboarding.seedFailed"));
      return;
    }
    localStorage.setItem("onboarding_done", "1");
    setShowOnboarding(false);
  };

  const handleSkipOnboarding = () => {
    localStorage.setItem("onboarding_done", "1");
    setShowOnboarding(false);
  };

  if (!ready) return null;

  if (bootstrapError) {
    return (
      <div className="app-bootstrap-error">
        <p>{bootstrapError}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            setReady(false);
            await checkOnboarding();
          }}
        >
          {t("app.retryLoad")}
        </button>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onLoadSamples={handleLoadSamples}
        onSkip={handleSkipOnboarding}
        sampleError={sampleError}
      />
    );
  }

  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="main-content">
          {activeTab === "templates" && <TemplateList />}
          {activeTab === "tags" && <TagManager />}
          {activeTab === "packages" && <VariablePackageManager />}
          {activeTab === "importExport" && <ImportExport />}
          {activeTab === "settings" && <Settings />}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
