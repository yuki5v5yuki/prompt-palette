import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import Fuse, { type FuseResultMatch } from "fuse.js";
import type { TemplateWithTags, VariableFormField, Category } from "../types";
import { ICON_MAP, CategoryIcon } from "./CategoryIcon";
import {
  listTemplatesByFrequency,
  listCategories,
  recordTemplateUse,
  getTemplateFormSchema,
  interpolateTemplate,
  appendVariableOption,
  pasteTemplate,
} from "../desktop";

const fuseOptions = {
  keys: [
    { name: "title", weight: 1.0 },
    { name: "tags.name", weight: 0.7 },
    { name: "body", weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
};

// Highlight matched ranges in a string
function highlightMatches(text: string, indices: readonly [number, number][] | undefined): ReactNode {
  if (!indices || indices.length === 0) return text;
  const result: ReactNode[] = [];
  let lastEnd = 0;
  for (const [start, end] of indices) {
    if (start > lastEnd) result.push(text.slice(lastEnd, start));
    result.push(<mark key={start} className="search-highlight">{text.slice(start, end + 1)}</mark>);
    lastEnd = end + 1;
  }
  if (lastEnd < text.length) result.push(text.slice(lastEnd));
  return result;
}

type LauncherStep = "search" | "variables";

export default function Launcher() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<LauncherStep>("search");
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<TemplateWithTags[]>([]);
  const [results, setResults] = useState<TemplateWithTags[]>([]);
  const [matchMap, setMatchMap] = useState<Map<string, FuseResultMatch[]>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<Fuse<TemplateWithTags> | null>(null);

  // Category filter state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Variable input state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithTags | null>(null);
  const [formFields, setFormFields] = useState<VariableFormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [comboFreeText, setComboFreeText] = useState<Record<string, boolean>>({});
  const formRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadError(null);
    const tplRes = await listTemplatesByFrequency();
    const catRes = await listCategories();
    if (!tplRes.ok || !catRes.ok) {
      setLoadError(t("launcher.loadFailed"));
      setTemplates([]);
      setResults([]);
      fuseRef.current = null;
      setCategories(catRes.ok ? (catRes.data ?? []) : []);
      return;
    }
    const list = tplRes.data ?? [];
    setTemplates(list);
    setResults(list);
    fuseRef.current = new Fuse(list, fuseOptions);
    setCategories(catRes.data ?? []);
  }, [t]);

  useEffect(() => {
    loadTemplates();
    inputRef.current?.focus();
  }, [loadTemplates]);

  // Listen for language changes from main window
  useEffect(() => {
    const unlisten = listen<string>("language-changed", (event) => {
      i18n.changeLanguage(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [i18n]);

  // Listen for theme changes from main window
  useEffect(() => {
    const unlisten = listen<string>("theme-changed", (event) => {
      document.documentElement.setAttribute("data-theme", event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen for font size changes from main window
  useEffect(() => {
    const unlisten = listen<string>("font-size-changed", (event) => {
      if (event.payload === "medium") {
        document.documentElement.removeAttribute("data-font-size");
      } else {
        document.documentElement.setAttribute("data-font-size", event.payload);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("paste-keystroke-failed", () => {
      setPasteWarning(t("launcher.pasteKeystrokeFailed"));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [t]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(templates);
      setMatchMap(new Map());
      setSelectedIndex(0);
      return;
    }
    if (fuseRef.current) {
      const fuseResults = fuseRef.current.search(query);
      setResults(fuseResults.map((r) => r.item));
      const newMatchMap = new Map<string, FuseResultMatch[]>();
      for (const r of fuseResults) {
        if (r.matches) newMatchMap.set(r.item.id, [...r.matches]);
      }
      setMatchMap(newMatchMap);
      setSelectedIndex(0);
    }
  }, [query, templates]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Focus first variable input when entering variable step
  useEffect(() => {
    if (step === "variables" && formRefs.current[0]) {
      formRefs.current[0].focus();
    }
  }, [step]);

  // Filter results by selected category
  const displayedResults = useMemo(() => {
    if (selectedCategoryId === null) return results;
    return results.filter((t) => t.categoryId === selectedCategoryId);
  }, [results, selectedCategoryId]);

  const resetLauncher = useCallback(() => {
    setStep("search");
    setQuery("");
    setSelectedCategoryId(null);
    setSelectedTemplate(null);
    setFormFields([]);
    setFormValues({});
    setActiveFieldIndex(0);
    setValidationErrors(new Set());
    setPasteWarning(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const hideLauncher = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch (e) {
      console.error("[Launcher] hide failed:", e);
    }
    resetLauncher();
  }, [resetLauncher]);

  // Close launcher when window loses focus (click outside)
  useEffect(() => {
    const onBlur = () => {
      hideLauncher();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [hideLauncher]);

  const pasteText = useCallback(async (text: string) => {
    setPasteWarning(null);
    const r = await pasteTemplate(text);
    if (r.ok) return;
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
    } catch {
      void navigator.clipboard.writeText(text);
    }
  }, []);

  const updateFormValue = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const saveInputHistory = useCallback(async (fields: VariableFormField[], values: Record<string, string>) => {
    for (const f of fields) {
      if (!f.variableId) continue;
      const inputValue = values[f.key];
      if (inputValue && inputValue.trim()) {
        await appendVariableOption(f.variableId, inputValue.trim());
      }
    }
  }, []);

  const selectTemplate = useCallback(
    async (template: TemplateWithTags) => {
      const schemaRes = await getTemplateFormSchema(template.id);
      if (!schemaRes.ok) {
        setLoadError(t("launcher.loadFailed"));
        return;
      }
      const fields = schemaRes.data ?? [];

      if (fields.length > 0) {
        // Has variables — show variable input form
        setSelectedTemplate(template);
        setFormFields(fields);
        const initial: Record<string, string> = {};
        for (const f of fields) {
          initial[f.key] = f.defaultValue ?? "";
        }
        setFormValues(initial);
        setComboFreeText({});
        setActiveFieldIndex(0);
        setStep("variables");
      } else {
        const useRes = await recordTemplateUse(template.id);
        if (!useRes.ok) {
          setLoadError(t("launcher.loadFailed"));
          return;
        }
        await pasteText(template.body);
        resetLauncher();
      }
    },
    [pasteText, resetLauncher, t]
  );

  const submitVariables = useCallback(async () => {
    if (!selectedTemplate) return;

    // Validate required fields
    const errors = new Set<string>();
    for (const f of formFields) {
      if (f.required && !(formValues[f.key] ?? "").trim()) {
        errors.add(f.key);
      }
    }
    if (errors.size > 0) {
      setValidationErrors(errors);
      // Focus first error field
      const firstErrorIdx = formFields.findIndex((f) => errors.has(f.key));
      if (firstErrorIdx >= 0) {
        setActiveFieldIndex(firstErrorIdx);
        formRefs.current[firstErrorIdx]?.focus();
      }
      return;
    }
    setValidationErrors(new Set());

    const useRes = await recordTemplateUse(selectedTemplate.id);
    if (!useRes.ok) {
      setLoadError(t("launcher.loadFailed"));
      return;
    }

    const intRes = await interpolateTemplate({
      templateId: selectedTemplate.id,
      values: formValues,
    });
    const text = intRes.ok ? (intRes.data ?? selectedTemplate.body) : selectedTemplate.body;

    await saveInputHistory(formFields, formValues);

    await pasteText(text);
    resetLauncher();
  }, [selectedTemplate, formFields, formValues, pasteText, resetLauncher, saveInputHistory, t]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, displayedResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (displayedResults[selectedIndex]) {
            selectTemplate(displayedResults[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          hideLauncher();
          break;
      }
    },
    [displayedResults, selectedIndex, selectTemplate, hideLauncher]
  );

  const handleVariableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        resetLauncher();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeFieldIndex < formFields.length - 1) {
          // Move to next field
          const nextIdx = activeFieldIndex + 1;
          setActiveFieldIndex(nextIdx);
          formRefs.current[nextIdx]?.focus();
        } else {
          // Last field — submit
          submitVariables();
        }
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        if (activeFieldIndex < formFields.length - 1) {
          const nextIdx = activeFieldIndex + 1;
          setActiveFieldIndex(nextIdx);
          formRefs.current[nextIdx]?.focus();
        }
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        if (activeFieldIndex > 0) {
          const prevIdx = activeFieldIndex - 1;
          setActiveFieldIndex(prevIdx);
          formRefs.current[prevIdx]?.focus();
        }
      }
    },
    [activeFieldIndex, formFields.length, submitVariables, resetLauncher]
  );

  // --- Search Step ---
  if (step === "search") {
    return (
      <div className="launcher" onKeyDown={handleSearchKeyDown}>
        {loadError && (
          <div className="launcher-banner launcher-banner-error" role="alert">
            <span>{loadError}</span>
            <button type="button" className="launcher-banner-retry" onClick={() => void loadTemplates()}>
              {t("launcher.retry")}
            </button>
          </div>
        )}
        {pasteWarning && (
          <div className="launcher-banner launcher-banner-warn" role="status">
            {pasteWarning}
          </div>
        )}
        <div className="launcher-search">
          <input
            ref={inputRef}
            type="text"
            className="launcher-input"
            placeholder={t("launcher.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {categories.length > 0 && (
          <div className="launcher-categories">
            <button
              className={`launcher-category-chip ${selectedCategoryId === null ? "active" : ""}`}
              onClick={() => { setSelectedCategoryId(null); setSelectedIndex(0); }}
            >
              {t("launcher.allCategories")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`launcher-category-chip ${selectedCategoryId === cat.id ? "active" : ""}`}
                onClick={() => { setSelectedCategoryId(cat.id); setSelectedIndex(0); }}
              >
                {cat.icon && ICON_MAP[cat.icon] && (
                  <span className="launcher-category-icon">
                    <CategoryIcon name={cat.icon} size={13} />
                  </span>
                )}
                {cat.name}
              </button>
            ))}
          </div>
        )}
        <div className="launcher-results" ref={listRef}>
          {displayedResults.length === 0 && (
            <div className="launcher-empty">{t("launcher.noResults")}</div>
          )}
          {displayedResults.map((tpl, index) => (
            <div
              key={tpl.id}
              className={`launcher-item ${index === selectedIndex ? "selected" : ""}`}
              onClick={() => selectTemplate(tpl)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="launcher-item-title">
                {(() => {
                  const matches = matchMap.get(tpl.id);
                  const titleMatch = matches?.find((m) => m.key === "title");
                  return titleMatch ? highlightMatches(tpl.title, titleMatch.indices as unknown as [number, number][]) : tpl.title;
                })()}
              </div>
              {tpl.tags.length > 0 && (
                <div className="launcher-item-tags">
                  {tpl.tags.map((tag) => (
                    <span key={tag.id} className="launcher-tag">{tag.name}</span>
                  ))}
                </div>
              )}
              <div className="launcher-item-preview">
                {(() => {
                  const preview = tpl.body.slice(0, 100) + (tpl.body.length > 100 ? "..." : "");
                  const matches = matchMap.get(tpl.id);
                  const bodyMatch = matches?.find((m) => m.key === "body");
                  if (bodyMatch) {
                    // Only highlight indices within the preview range
                    const clampedIndices = (bodyMatch.indices as unknown as [number, number][])
                      .filter(([s]) => s < 100)
                      .map(([s, e]) => [s, Math.min(e, 99)] as [number, number]);
                    return highlightMatches(preview, clampedIndices);
                  }
                  return preview;
                })()}
              </div>
            </div>
          ))}
        </div>
        <div className="launcher-hints">
          <span className="launcher-hint-item"><kbd>Esc</kbd> {t("launcher.hintClose")}</span>
          <span className="launcher-hint-item"><kbd>&uarr;&darr;</kbd> {t("launcher.hintNavigate")}</span>
          <span className="launcher-hint-item"><kbd>Enter</kbd> {t("launcher.hintSelect")}</span>
        </div>
      </div>
    );
  }

  // --- Variable Input Step ---

  // Build a live preview showing where variables appear in the body
  const buildBodyPreview = () => {
    if (!selectedTemplate) return null;
    const body = selectedTemplate.body;
    const parts = body.split(/(\{\{[^}]+\}\})/g);
    const activeKey = formFields[activeFieldIndex]?.key;

    return parts.map((part, i) => {
      const match = part.match(/^\{\{([^}|]+)(?:\|[^}]+)?\}\}$/);
      if (match) {
        const key = match[1];
        const value = formValues[key];
        const isActive = key === activeKey;
        const isFilled = !!value;
        const classes = [
          "launcher-preview-var",
          isFilled && "filled",
          isActive && "active",
        ].filter(Boolean).join(" ");
        return <span key={i} className={classes}>{isFilled ? value : part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="launcher" onKeyDown={handleVariableKeyDown}>
      {pasteWarning && (
        <div className="launcher-banner launcher-banner-warn" role="status">
          {pasteWarning}
        </div>
      )}
      <div className="launcher-var-header">
        <button className="launcher-back-btn" onClick={resetLauncher}>
          &larr;
        </button>
        <span className="launcher-var-title">{selectedTemplate?.title}</span>
      </div>
      {selectedTemplate && (
        <div className="launcher-body-preview">
          <span className="launcher-body-preview-label">{t("launcher.templatePreviewLabel")}</span>
          <span className="launcher-body-preview-text">{buildBodyPreview()}</span>
        </div>
      )}
      <div className="launcher-var-form">
        {formFields.map((field, idx) => (
          <div key={field.key} className={`launcher-var-field ${validationErrors.has(field.key) ? "launcher-var-field-error" : ""}`}>
            <label className="launcher-var-label">
              {field.label}
              {field.required && <span className="launcher-required-mark"> *</span>}
            </label>
            {field.options && field.options.length > 0 && !field.allowFreeText ? (
              <select
                ref={(el) => { formRefs.current[idx] = el as unknown as HTMLInputElement; }}
                className="launcher-var-input"
                value={formValues[field.key] ?? ""}
                onChange={(e) =>
                  updateFormValue(field.key, e.target.value)
                }
                onFocus={() => setActiveFieldIndex(idx)}
              >
                <option value="">{t("launcher.inputPlaceholder")}</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.options && field.options.length > 0 ? (
              <div className="combobox-wrapper">
                <div className="combobox-tabs">
                  <button
                    type="button"
                    className={`combobox-tab ${!comboFreeText[field.key] ? "active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setComboFreeText((prev) => ({ ...prev, [field.key]: false }));
                    }}
                  >
                    {t("launcher.comboSelectTab")}
                  </button>
                  <button
                    type="button"
                    className={`combobox-tab ${comboFreeText[field.key] ? "active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setComboFreeText((prev) => ({ ...prev, [field.key]: true }));
                      updateFormValue(field.key, "");
                      setTimeout(() => formRefs.current[idx]?.focus(), 0);
                    }}
                  >
                    {t("launcher.comboFreeTab")}
                  </button>
                </div>
                {comboFreeText[field.key] ? (
                  <input
                    ref={(el) => { formRefs.current[idx] = el; }}
                    type="text"
                    className="launcher-var-input"
                    value={formValues[field.key] ?? ""}
                    onChange={(e) =>
                      updateFormValue(field.key, e.target.value)
                    }
                    onFocus={() => setActiveFieldIndex(idx)}
                    placeholder={t("launcher.comboFreeHint")}
                  />
                ) : (
                  <div className="launcher-option-list">
                    {field.options.map((opt) => (
                      <button
                        ref={idx === 0 && opt === field.options![0] ? (el) => { formRefs.current[idx] = el as unknown as HTMLInputElement; } : undefined}
                        key={opt}
                        type="button"
                        className={`launcher-option-item ${formValues[field.key] === opt ? "selected" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          updateFormValue(field.key, opt);
                        }}
                        onFocus={() => setActiveFieldIndex(idx)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                ref={(el) => { formRefs.current[idx] = el; }}
                type="text"
                className="launcher-var-input"
                value={formValues[field.key] ?? ""}
                onChange={(e) =>
                  updateFormValue(field.key, e.target.value)
                }
                onFocus={() => setActiveFieldIndex(idx)}
                placeholder={field.defaultValue || t("launcher.inputPlaceholder")}
              />
            )}
          </div>
        ))}
      </div>
      <div className="launcher-var-actions">
        <button className="launcher-var-submit" onClick={submitVariables}>
          {t("launcher.submit")}
        </button>
      </div>
    </div>
  );
}
