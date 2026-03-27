import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getSetting, setGlobalHotkey } from "../desktop";

/** Convert a KeyboardEvent.code to a Tauri-compatible key name */
function codeToKeyName(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "num" + code.slice(6).toLowerCase();
  if (code.startsWith("Arrow")) return code.slice(5).toLowerCase();
  if (code.startsWith("F") && /^F\d{1,2}$/.test(code)) return code.toLowerCase();

  const map: Record<string, string> = {
    Space: "space", Enter: "enter", Escape: "escape",
    Backspace: "backspace", Tab: "tab", Delete: "delete",
    Insert: "insert", Home: "home", End: "end",
    PageUp: "pageup", PageDown: "pagedown",
    BracketLeft: "[", BracketRight: "]",
    Semicolon: ";", Quote: "'", Backquote: "`",
    Backslash: "\\", Comma: ",", Period: ".", Slash: "/",
    Minus: "-", Equal: "=",
  };
  return map[code] ?? null;
}

/** Convert a KeyboardEvent to a Tauri shortcut string like "ctrl+shift+p" */
function keyEventToShortcut(e: KeyboardEvent): string | null {
  const modifierCodes = new Set([
    "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight",
    "AltLeft", "AltRight", "MetaLeft", "MetaRight",
  ]);
  if (modifierCodes.has(e.code)) return null; // modifier-only, incomplete

  const keyName = codeToKeyName(e.code);
  if (!keyName) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("super");

  if (parts.length === 0) return null; // require at least one modifier

  parts.push(keyName);
  return parts.join("+");
}

/** Render a shortcut string as <kbd> elements */
function ShortcutDisplay({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split("+").map((p) => {
    const display: Record<string, string> = {
      ctrl: "Ctrl", alt: "Alt", shift: "Shift", super: "Win",
      space: "Space", enter: "Enter", escape: "Esc",
      backspace: "Backspace", tab: "Tab", delete: "Del",
      up: "↑", down: "↓", left: "←", right: "→",
    };
    return display[p] ?? p.toUpperCase();
  });
  return (
    <span className="settings-hotkey-display">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="settings-hotkey-separator">+</span>}
          <kbd>{p}</kbd>
        </span>
      ))}
    </span>
  );
}

type ThemeMode = "system" | "light" | "dark";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("themeMode") as ThemeMode) || "system";
  });

  const [hotkey, setHotkey] = useState("ctrl+space");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingHotkey, setPendingHotkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const recorderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(themeMode);
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (themeMode === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  // Load saved hotkey on mount
  useEffect(() => {
    getSetting("global_hotkey").then((val) => {
      if (val) setHotkey(val);
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();
      e.stopPropagation();

      const shortcut = keyEventToShortcut(e);
      if (shortcut) {
        setPendingHotkey(shortcut);
        setIsRecording(false);
        setError(null);
      }
    },
    [isRecording]
  );

  useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [isRecording, handleKeyDown]);

  // Focus recorder when recording starts
  useEffect(() => {
    if (isRecording && recorderRef.current) {
      recorderRef.current.focus();
    }
  }, [isRecording]);

  const handleSave = async () => {
    if (!pendingHotkey) return;
    setSaving(true);
    setError(null);
    try {
      const result = await setGlobalHotkey(pendingHotkey);
      if (result === null) {
        setError(t("settings.hotkeyError"));
      } else {
        setHotkey(pendingHotkey);
        setPendingHotkey(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError(t("settings.hotkeyError"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingHotkey(null);
    setIsRecording(false);
    setError(null);
  };

  return (
    <div className="manager-page">
      <div className="panel-header">
        <h2 className="panel-title">{t("settings.title")}</h2>
      </div>
      <div className="settings-content">
        {/* Theme */}
        <div className="settings-section">
          <h3 className="settings-section-title">{t("settings.appearance")}</h3>
          <div className="form-group">
            <label className="form-label">{t("settings.theme")}</label>
            <div className="settings-toggle-group">
              <button
                className={`btn btn-sm ${themeMode === "system" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setThemeMode("system")}
              >
                {t("settings.themeSystem", "システム")}
              </button>
              <button
                className={`btn btn-sm ${themeMode === "light" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setThemeMode("light")}
              >
                {t("settings.themeLight")}
              </button>
              <button
                className={`btn btn-sm ${themeMode === "dark" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setThemeMode("dark")}
              >
                {t("settings.themeDark")}
              </button>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="settings-section">
          <h3 className="settings-section-title">{t("settings.language")}</h3>
          <div className="form-group">
            <label className="form-label">{t("settings.languageSelect")}</label>
            <div className="settings-toggle-group">
              <button
                className={`btn btn-sm ${i18n.language === "ja" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => i18n.changeLanguage("ja")}
              >
                {t("common.japanese")}
              </button>
              <button
                className={`btn btn-sm ${i18n.language === "en" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => i18n.changeLanguage("en")}
              >
                {t("common.english")}
              </button>
            </div>
          </div>
        </div>

        {/* Hotkey */}
        <div className="settings-section">
          <h3 className="settings-section-title">{t("settings.hotkey")}</h3>
          <div className="form-group">
            <label className="form-label">{t("settings.globalHotkey")}</label>

            {isRecording ? (
              <div
                ref={recorderRef}
                className="settings-hotkey-recorder recording"
                tabIndex={0}
              >
                {t("settings.hotkeyRecording")}
              </div>
            ) : pendingHotkey ? (
              <div className="settings-hotkey-recorder">
                <ShortcutDisplay shortcut={pendingHotkey} />
                <div className="settings-hotkey-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {t("settings.hotkeySave")}
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleCancel}
                  >
                    {t("settings.hotkeyCancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="settings-hotkey-recorder">
                <ShortcutDisplay shortcut={hotkey} />
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setIsRecording(true);
                    setError(null);
                    setSaved(false);
                  }}
                >
                  {t("settings.hotkeyChange")}
                </button>
              </div>
            )}

            {error && <p className="settings-hotkey-error">{error}</p>}
            {saved && <p className="settings-hotkey-success">{t("settings.hotkeySaved")}</p>}
            <p className="settings-hint">{t("settings.hotkeyHint")}</p>
          </div>
        </div>

        {/* About */}
        <div className="settings-section">
          <h3 className="settings-section-title">{t("settings.about")}</h3>
          <div className="settings-about">
            <p><strong>{t("app.name")}</strong> {t("app.version")}</p>
            <p className="settings-hint">{t("app.description")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
