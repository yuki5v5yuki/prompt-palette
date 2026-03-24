import { useTranslation } from "react-i18next";

export type NavTab = "templates" | "tags" | "packages" | "importExport" | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { t, i18n } = useTranslation();

  const tabs: { key: NavTab; label: string; icon: string }[] = [
    { key: "templates", label: t("nav.templates"), icon: "📝" },
    { key: "tags", label: t("nav.tags"), icon: "🏷️" },
    { key: "packages", label: t("nav.packages"), icon: "📦" },
    { key: "importExport", label: t("nav.importExport"), icon: "📤" },
    { key: "settings", label: t("nav.settings"), icon: "⚙️" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">{t("app.name")}</h1>
        <span className="sidebar-version">{t("app.version")}</span>
      </div>

      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`sidebar-nav-item ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            <span className="sidebar-nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="lang-switcher-small">
          <button
            className={`lang-btn-small ${i18n.language === "ja" ? "active" : ""}`}
            onClick={() => i18n.changeLanguage("ja")}
          >
            JP
          </button>
          <button
            className={`lang-btn-small ${i18n.language === "en" ? "active" : ""}`}
            onClick={() => i18n.changeLanguage("en")}
          >
            EN
          </button>
        </div>
      </div>
    </aside>
  );
}
