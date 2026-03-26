import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TemplateWithTags, Category, Tag, Variable, VariablePackage, CreateTemplateInput, UpdateTemplateInput } from "../types";
import { listVariablePackages, listVariables, getTemplatePackages } from "../desktop";

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
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [packageVariables, setPackageVariables] = useState<Variable[]>([]);

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  // Extract {{variable}} tokens from body for hint display
  const bodyTokens = (body.match(/\{\{(\w+)\}\}/g) || [])
    .map((m) => m.slice(2, -2))
    .filter((v, i, a) => a.indexOf(v) === i);

  // Load all packages
  useEffect(() => {
    (async () => {
      const pkgs = await listVariablePackages();
      setAllPackages(pkgs ?? []);
    })();
  }, []);

  // Load template's assigned packages
  useEffect(() => {
    if (!template?.id) return;
    (async () => {
      const pkgs = await getTemplatePackages(template.id);
      if (pkgs) {
        setSelectedPackageIds(new Set(pkgs.map((p) => p.id)));
      }
    })();
  }, [template?.id]);

  // Load variables from selected packages
  useEffect(() => {
    (async () => {
      const allVars: Variable[] = [];
      for (const pkgId of selectedPackageIds) {
        const vars = await listVariables(pkgId);
        if (vars) allVars.push(...vars);
      }
      setPackageVariables(allVars);
    })();
  }, [selectedPackageIds]);

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

  const togglePackage = (packageId: string) => {
    setSelectedPackageIds((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const data: CreateTemplateInput | UpdateTemplateInput = {
      title: title.trim(),
      body: body.trim(),
      categoryId: categoryId || undefined,
      tagIds: Array.from(selectedTagIds),
      packageIds: Array.from(selectedPackageIds),
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

      {allPackages.length > 0 && (
        <div className="form-group">
          <label className="form-label">{t("variablePackage.packagesLabel")}</label>
          <p className="form-hint">{t("variablePackage.selectHint")}</p>
          <div className="tag-selector">
            {allPackages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className={`tag-toggle ${selectedPackageIds.has(pkg.id) ? "active" : ""}`}
                onClick={() => togglePackage(pkg.id)}
              >
                {pkg.name}
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
            {/* Variables grouped by package */}
            {allPackages
              .filter((pkg) => selectedPackageIds.has(pkg.id))
              .map((pkg) => {
                const pkgVars = packageVariables.filter((v) => v.packageId === pkg.id);
                if (pkgVars.length === 0) return null;
                return (
                  <div key={pkg.id} className="variable-palette-group">
                    <span className="variable-palette-group-label">{pkg.name}</span>
                    {pkgVars.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="variable-chip"
                        onClick={() => insertVariable(v.key)}
                        title={t("variable.insertHint")}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                );
              })}

            {/* Built-in variables */}
            {BUILTIN_VARS.map((bv) => (
              <button
                key={bv.key}
                type="button"
                className="variable-chip variable-chip-builtin"
                onClick={() => insertVariable(bv.key)}
                title={t(bv.tooltipKey)}
              >
                {bv.key}
              </button>
            ))}

            {/* Guide messages */}
            {allPackages.length > 0 && selectedPackageIds.size === 0 && (
              <span className="variable-palette-hint">
                {t("variable.selectPackageFirst")}
              </span>
            )}

            {selectedPackageIds.size > 0 && packageVariables.length === 0 && (
              <span className="variable-palette-hint">
                {t("variablePackage.noVariablesInPackage")}
              </span>
            )}

            {packageVariables.length > 0 && (
              <span className="variable-palette-hint">
                {t("variable.paletteHint")}
              </span>
            )}
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
