import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TemplateWithTags, Category, Tag, Variable, VariablePackage, CreateTemplateInput, UpdateTemplateInput } from "../types";
import { listVariablePackages, listVariables } from "../desktop";

interface TemplateEditorProps {
  template?: TemplateWithTags;
  categories: Category[];
  tags: Tag[];
  onSave: (data: CreateTemplateInput | UpdateTemplateInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

const BUILTIN_VARS = [
  { key: "@clipboard", tooltipKey: "variable.builtinClipboard" },
  { key: "@today", tooltipKey: "variable.builtinToday" },
  { key: "@now", tooltipKey: "variable.builtinNow" },
];

export default function TemplateEditor({
  template,
  categories,
  tags,
  onSave,
  onDelete,
  onCancel,
}: TemplateEditorProps) {
  const { t } = useTranslation();
  const isEditing = !!template;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(template?.tags.map((t) => t.id) ?? [])
  );

  // Variable packages
  const [allPackages, setAllPackages] = useState<VariablePackage[]>([]);
  const [allVariables, setAllVariables] = useState<Variable[]>([]);
  const [showAllVars, setShowAllVars] = useState(false);
  const [varSearch, setVarSearch] = useState("");

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  // Extract {{variable}} tokens from body for hint display
  const bodyTokens = (body.match(/\{\{([^}]+)\}\}/g) || [])
    .map((m) => m.slice(2, -2))
    .filter((v, i, a) => a.indexOf(v) === i);

  // Load all packages
  useEffect(() => {
    (async () => {
      const pkgs = await listVariablePackages();
      setAllPackages(pkgs ?? []);
    })();
  }, []);

  // Load all variables from all packages
  useEffect(() => {
    (async () => {
      const vars: Variable[] = [];
      for (const pkg of allPackages) {
        const pkgVars = await listVariables(pkg.id);
        if (pkgVars) vars.push(...pkgVars);
      }
      setAllVariables(vars);
    })();
  }, [allPackages]);

  // Auto-show preview when variables exist
  useEffect(() => {
    if (bodyTokens.length > 0) {
      setShowPreview(true);
    }
  }, [bodyTokens.length]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    // Auto-detect packages from {{key}} tokens in body
    const usedPackageIds = new Set<string>();
    for (const token of bodyTokens) {
      const matchingVar = allVariables.find((v) => v.key === token);
      if (matchingVar) {
        usedPackageIds.add(matchingVar.packageId);
      }
    }

    const data: CreateTemplateInput | UpdateTemplateInput = {
      title: title.trim(),
      body: body.trim(),
      categoryId: categoryId || undefined,
      tagIds: Array.from(selectedTagIds),
      packageIds: Array.from(usedPackageIds),
    };
    onSave(data);
  };

  // --- Click-to-Insert ---
  const insertVariable = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const token = `{{${key}}}`;
    const newBody = body.slice(0, start) + token + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + token.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  // --- Preview renderer ---
  const renderPreview = () => {
    const parts = body.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{[^}]+\}\}$/.test(part)) {
        return (
          <span key={i} className="preview-variable">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <form className="template-editor" onSubmit={handleSubmit}>
      <div className="editor-header">
        <h3>{isEditing ? t("common.edit") : t("template.newTemplate")}</h3>
        <div className="editor-actions">
          {isEditing && onDelete && (
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
              {t("common.delete")}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t("template.titleLabel")}</label>
        <input
          type="text"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("template.placeholder.title")}
          autoFocus
        />
      </div>

      <div className="form-row">
        <div className="form-group form-group-half">
          <label className="form-label">{t("template.categoryLabel")}</label>
          <select
            className="form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("template.noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="form-group">
          <label className="form-label">{t("template.tagsLabel")}</label>
          <div className="tag-selector">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`tag-toggle ${selectedTagIds.has(tag.id) ? "active" : ""}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body Editing Area - palette + textarea + preview */}
      <div className="form-group">
        <label className="form-label">{t("template.bodyLabel")}</label>

        <div className="body-editing-area">
          {/* Variable Palette */}
          <div className="variable-palette">
            {/* Used variables — always visible */}
            {(() => {
              const usedVars = allVariables.filter((v) => bodyTokens.includes(v.key));
              const usedBuiltins = BUILTIN_VARS.filter((bv) => bodyTokens.includes(bv.key));
              if (usedVars.length > 0 || usedBuiltins.length > 0) {
                return (
                  <div className="variable-palette-row">
                    {usedVars.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="variable-chip variable-chip-active"
                        onClick={() => insertVariable(v.key)}
                        title={t("variable.insertHint")}
                      >
                        {v.label}
                      </button>
                    ))}
                    {usedBuiltins.map((bv) => (
                      <button
                        key={bv.key}
                        type="button"
                        className="variable-chip variable-chip-builtin variable-chip-active"
                        onClick={() => insertVariable(bv.key)}
                        title={t(bv.tooltipKey)}
                      >
                        {bv.key}
                      </button>
                    ))}
                  </div>
                );
              }
              return null;
            })()}

            {/* Toggle to show all variables */}
            <button
              type="button"
              className="variable-palette-toggle"
              onClick={() => setShowAllVars(!showAllVars)}
            >
              {showAllVars ? "▼" : "▶"} {t("variable.allVariables")}({allVariables.length + BUILTIN_VARS.length})
            </button>

            {/* Expandable: all variables + search */}
            {showAllVars && (
              <div className="variable-palette-expanded">
                {allVariables.length > 3 && (
                  <input
                    type="text"
                    className="variable-search"
                    value={varSearch}
                    onChange={(e) => setVarSearch(e.target.value)}
                    placeholder={t("variable.searchPlaceholder")}
                  />
                )}

                <div className="variable-palette-row">
                  {allVariables
                    .filter((v) => !varSearch || v.label.toLowerCase().includes(varSearch.toLowerCase()) || v.key.toLowerCase().includes(varSearch.toLowerCase()))
                    .map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`variable-chip ${bodyTokens.includes(v.key) ? "variable-chip-active" : ""}`}
                        onClick={() => insertVariable(v.key)}
                        title={t("variable.insertHint")}
                      >
                        {v.label}
                      </button>
                    ))}

                  {/* Built-in variables */}
                  {BUILTIN_VARS
                    .filter((bv) => !varSearch || bv.key.toLowerCase().includes(varSearch.toLowerCase()))
                    .map((bv) => (
                      <button
                        key={bv.key}
                        type="button"
                        className={`variable-chip variable-chip-builtin ${bodyTokens.includes(bv.key) ? "variable-chip-active" : ""}`}
                        onClick={() => insertVariable(bv.key)}
                        title={t(bv.tooltipKey)}
                      >
                        {bv.key}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <span className="variable-palette-hint">
              {t("variable.paletteHint")}
            </span>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="form-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("template.placeholder.body")}
            rows={10}
          />

          {/* Preview */}
          {bodyTokens.length > 0 && (
            <div className="body-preview-section">
              <button
                type="button"
                className="preview-toggle"
                onClick={() => setShowPreview(!showPreview)}
              >
                {t("variable.preview")} {showPreview ? "▲" : "▼"}
              </button>
              {showPreview && (
                <div className="body-preview">
                  {renderPreview()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isEditing && template && (
        <div className="editor-meta">
          <span>{t("template.useCount")}: {template.useCount}</span>
          {template.lastUsedAt && (
            <span>{t("template.lastUsed")}: {new Date(template.lastUsedAt).toLocaleString()}</span>
          )}
        </div>
      )}
    </form>
  );
}
