import { useState } from "react";
import Sidebar, { type NavTab } from "./components/Sidebar";
import TemplateList from "./components/TemplateList";
import CategoryManager from "./components/CategoryManager";
import TagManager from "./components/TagManager";
import "./styles.css";

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("templates");

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content">
        {activeTab === "templates" && <TemplateList />}
        {activeTab === "categories" && <CategoryManager />}
        {activeTab === "tags" && <TagManager />}
      </main>
    </div>
  );
}

export default App;
