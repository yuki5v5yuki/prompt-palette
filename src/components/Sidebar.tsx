import { useTranslation } from "react-i18next";
import { emitTo } from "@tauri-apps/api/event";
import { FileText, Tag, Variable, ArrowUpDown, Settings, type LucideIcon } from "lucide-react";
import { setSetting } from "../desktop";

export type NavTab = "templates" | "tags" | "packages" | "importExport" | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { t, i18n } = useTranslation();

  const tabs: { key: NavTab; label: string; icon: LucideIcon }[] = [
    { key: "templates", label: t("nav.templates"), icon: FileText },
    { key: "tags", label: t("nav.tags"), icon: Tag },
    { key: "packages", label: t("nav.packages"), icon: Variable },
    { key: "importExport", label: t("nav.importExport"), icon: ArrowUpDown },
    { key: "settings", label: t("nav.settings"), icon: Settings },
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
            <span className="sidebar-nav-icon">
              <tab.icon size={18} strokeWidth={activeTab === tab.key ? 2.2 : 1.8} />
            </span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="lang-switcher-small">
          <button
            className={`lang-btn-small ${i18n.language === "ja" ? "active" : ""}`}
            onClick={() => { i18n.changeLanguage("ja"); void setSetting("language", "ja"); emitTo("launcher", "language-changed", "ja"); }}
          >
            JP
          </button>
          <button
            className={`lang-btn-small ${i18n.language === "en" ? "active" : ""}`}
            onClick={() => { i18n.changeLanguage("en"); void setSetting("language", "en"); emitTo("launcher", "language-changed", "en"); }}
          >
            EN
          </button>
        </div>
      </div>
    </aside>
  );
}
