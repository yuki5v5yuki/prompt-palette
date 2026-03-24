import { useState, useEffect } from "react";
import Sidebar, { type NavTab } from "./components/Sidebar";
import TemplateList from "./components/TemplateList";
import CategoryManager from "./components/CategoryManager";
import TagManager from "./components/TagManager";
import VariablePackageManager from "./components/VariablePackageManager";
import ImportExport from "./components/ImportExport";
import Settings from "./components/Settings";
import Onboarding from "./components/Onboarding";
import { isOnboarded, seedSampleData } from "./desktop";
import "./styles.css";

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("templates");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ready, setReady] = useState(false);

  // Apply saved theme + check onboarding on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    const checkOnboarding = async () => {
      const onboarded = await isOnboarded();
      const dismissed = localStorage.getItem("onboarding_done");
      if (onboarded === false && !dismissed) {
        setShowOnboarding(true);
      }
      setReady(true);
    };
    checkOnboarding();
  }, []);

  const handleLoadSamples = async () => {
    await seedSampleData();
    localStorage.setItem("onboarding_done", "1");
    setShowOnboarding(false);
  };

  const handleSkipOnboarding = () => {
    localStorage.setItem("onboarding_done", "1");
    setShowOnboarding(false);
  };

  if (!ready) return null;

  if (showOnboarding) {
    return <Onboarding onLoadSamples={handleLoadSamples} onSkip={handleSkipOnboarding} />;
  }

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content">
        {activeTab === "templates" && <TemplateList />}
        {activeTab === "categories" && <CategoryManager />}
        {activeTab === "tags" && <TagManager />}
        {activeTab === "packages" && <VariablePackageManager />}
        {activeTab === "importExport" && <ImportExport />}
        {activeTab === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;
