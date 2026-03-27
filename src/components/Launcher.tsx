import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Fuse from "fuse.js";
import type { TemplateWithTags, VariableFormField, Category } from "../types";
import {
  listTemplatesByFrequency,
  listCategories,
  recordTemplateUse,
  getTemplateFormSchema,
  interpolateTemplate,
  appendVariableOption,
} from "../desktop";

const fuseOptions = {
  keys: [
    { name: "title", weight: 1.0 },
    { name: "tags.name", weight: 0.7 },
    { name: "body", weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
};

type LauncherStep = "search" | "variables";

export default function Launcher() {
  const { t } = useTranslation();
  const [step, setStep] = useState<LauncherStep>("search");
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<TemplateWithTags[]>([]);
  const [results, setResults] = useState<TemplateWithTags[]>([]);
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
  const formRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadTemplates = useCallback(async () => {
    try {
      const tpls = await listTemplatesByFrequency();
      const list = tpls ?? [];
      setTemplates(list);
      setResults(list);
      fuseRef.current = new Fuse(list, fuseOptions);
    } catch {}
    try {
      const cats = await listCategories();
      setCategories(cats ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    loadTemplates();
    inputRef.current?.focus();
  }, [loadTemplates]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(templates);
      setSelectedIndex(0);
      return;
    }
    if (fuseRef.current) {
      const fuseResults = fuseRef.current.search(query);
      setResults(fuseResults.map((r) => r.item));
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
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const hideLauncher = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch {}
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
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("paste_template", { text });
    } catch {
      try {
        const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
        await writeText(text);
      } catch {
        navigator.clipboard.writeText(text);
      }
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
      // Check if template has variables
      const schema = await getTemplateFormSchema(template.id);
      const fields = schema ?? [];

      if (fields.length > 0) {
        // Has variables — show variable input form
        setSelectedTemplate(template);
        setFormFields(fields);
        const initial: Record<string, string> = {};
        for (const f of fields) {
          initial[f.key] = f.defaultValue ?? "";
        }
        setFormValues(initial);
        setActiveFieldIndex(0);
        setStep("variables");
      } else {
        // No variables — direct paste
        await recordTemplateUse(template.id);
        await pasteText(template.body);
        resetLauncher();
      }
    },
    [pasteText, resetLauncher]
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

    await recordTemplateUse(selectedTemplate.id);

    // Interpolate template with values
    const text = await interpolateTemplate({
      templateId: selectedTemplate.id,
      values: formValues,
    });

    // Save input history
    await saveInputHistory(formFields, formValues);

    await pasteText(text ?? selectedTemplate.body);
    resetLauncher();
  }, [selectedTemplate, formFields, formValues, pasteText, resetLauncher, saveInputHistory]);

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
                {cat.icon && <span className="launcher-category-icon">{cat.icon}</span>}
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
              <div className="launcher-item-title">{tpl.title}</div>
              {tpl.tags.length > 0 && (
                <div className="launcher-item-tags">
                  {tpl.tags.map((tag) => (
                    <span key={tag.id} className="launcher-tag">{tag.name}</span>
                  ))}
                </div>
              )}
              <div className="launcher-item-preview">
                {tpl.body.slice(0, 100)}{tpl.body.length > 100 ? "..." : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Variable Input Step ---

  // Build a short preview showing where variables appear in the body
  const buildBodyPreview = () => {
    if (!selectedTemplate) return null;
    const body = selectedTemplate.body;
    // Truncate to ~120 chars and highlight {{variables}}
    const truncated = body.length > 120 ? body.slice(0, 120) + "..." : body;
    const parts = truncated.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{[^}]+\}\}$/.test(part)) {
        return <span key={i} className="launcher-preview-var">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="launcher" onKeyDown={handleVariableKeyDown}>
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
                <input
                  ref={(el) => { formRefs.current[idx] = el; }}
                  type="text"
                  className="launcher-var-input"
                  value={formValues[field.key] ?? ""}
                  onChange={(e) =>
                    updateFormValue(field.key, e.target.value)
                  }
                  onFocus={() => setActiveFieldIndex(idx)}
                  placeholder={field.defaultValue || t("launcher.comboHint")}
                />
                <div className="launcher-option-list">
                  {field.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`launcher-option-item ${formValues[field.key] === opt ? "selected" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        updateFormValue(field.key, opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
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
