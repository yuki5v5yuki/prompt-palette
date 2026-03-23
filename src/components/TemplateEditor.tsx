import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TemplateWithTags, Category, Tag, Variable, CreateTemplateInput, UpdateTemplateInput } from "../types";
import { listVariables, createVariable, updateVariable, deleteVariable } from "../desktop";

interface TemplateEditorProps {
  template?: TemplateWithTags;
  categories: Category[];
  tags: Tag[];
  onSave: (data: CreateTemplateInput | UpdateTemplateInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

const BUILTIN_VARS = ["@clipboard", "@today", "@now"];

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

  // Variable management
  const [variables, setVariables] = useState<Variable[]>([]);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [editingVar, setEditingVar] = useState<Variable | null>(null);
  const [varKey, setVarKey] = useState("");
  const [varLabel, setVarLabel] = useState("");
  const [varDefault, setVarDefault] = useState("");
  const [varOptions, setVarOptions] = useState("");

  // Quick add
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddKey, setQuickAddKey] = useState("");
  const [quickAddLabel, setQuickAddLabel] = useState("");

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  // Extract {{variable}} tokens from body for hint display
  const bodyTokens = (body.match(/\{\{(\w+)\}\}/g) || [])
    .map((m) => m.slice(2, -2))
    .filter((v, i, a) => a.indexOf(v) === i);

  const loadVariables = useCallback(async () => {
    if (!template?.id) return;
    const vars = await listVariables(template.id);
    setVariables(vars ?? []);
  }, [template?.id]);

  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

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

    const data: CreateTemplateInput | UpdateTemplateInput = {
      title: title.trim(),
      body: body.trim(),
      categoryId: categoryId || undefined,
      tagIds: Array.from(selectedTagIds),
    };
    onSave(data);
  };

  // --- Variable CRUD ---
  const resetVarForm = () => {
    setVarKey("");
    setVarLabel("");
    setVarDefault("");
    setVarOptions("");
    setEditingVar(null);
    setShowVarEditor(false);
  };

  const handleSaveVariable = async () => {
    if (!varKey.trim() || !template?.id) return;

    const optionsArray = varOptions.trim()
      ? varOptions.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    if (editingVar) {
      await updateVariable(editingVar.id, {
        key: varKey.trim(),
        label: varLabel.trim() || varKey.trim(),
        defaultValue: varDefault.trim() || undefined,
        options: optionsArray,
      });
    } else {
      await createVariable({
        templateId: template.id,
        key: varKey.trim(),
        label: varLabel.trim() || varKey.trim(),
        defaultValue: varDefault.trim() || undefined,
        options: optionsArray,
      });
    }
    resetVarForm();
    loadVariables();
  };

  const handleEditVariable = (v: Variable) => {
    setEditingVar(v);
    setVarKey(v.key);
    setVarLabel(v.label);
    setVarDefault(v.defaultValue ?? "");
    setVarOptions(v.options?.join(", ") ?? "");
    setShowVarEditor(true);
  };

  const handleDeleteVariable = async (id: string) => {
    await deleteVariable(id);
    loadVariables();
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

  // --- Quick Add ---
  const handleQuickAdd = async () => {
    if (!quickAddKey.trim() || !template?.id) return;
    await createVariable({
      templateId: template.id,
      key: quickAddKey.trim(),
      label: quickAddLabel.trim() || quickAddKey.trim(),
    });
    insertVariable(quickAddKey.trim());
    setQuickAddKey("");
    setQuickAddLabel("");
    setShowQuickAdd(false);
    loadVariables();
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
            {variables.length > 0 && variables.map((v) => (
              <button
                key={v.id}
                type="button"
                className="variable-chip"
                onClick={() => insertVariable(v.key)}
                title={`${v.label} - ${t("variable.insertHint")}`}
              >
                {v.key}
              </button>
            ))}

            {/* Built-in variables */}
            {BUILTIN_VARS.map((bv) => (
              <button
                key={bv}
                type="button"
                className="variable-chip variable-chip-builtin"
                onClick={() => insertVariable(bv)}
                title={`${bv} - ${t("variable.insertHint")}`}
              >
                {bv}
              </button>
            ))}

            {/* Quick add button */}
            {isEditing && (
              <button
                type="button"
                className="variable-chip variable-chip-add"
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                title={t("variable.quickAdd")}
              >
                +
              </button>
            )}

            {!isEditing && (
              <span className="variable-palette-hint">
                {t("variable.saveFirst")}
              </span>
            )}
          </div>

          {/* Quick Add Inline Form */}
          {showQuickAdd && (
            <div className="quick-add-form">
              <input
                type="text"
                className="form-input form-input-sm"
                value={quickAddKey}
                onChange={(e) => setQuickAddKey(e.target.value)}
                placeholder={t("variable.placeholder.key")}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleQuickAdd(); }
                  if (e.key === "Escape") { setShowQuickAdd(false); setQuickAddKey(""); setQuickAddLabel(""); }
                }}
              />
              <input
                type="text"
                className="form-input form-input-sm"
                value={quickAddLabel}
                onChange={(e) => setQuickAddLabel(e.target.value)}
                placeholder={t("variable.placeholder.label")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleQuickAdd(); }
                  if (e.key === "Escape") { setShowQuickAdd(false); setQuickAddKey(""); setQuickAddLabel(""); }
                }}
              />
              <button type="button" className="btn btn-primary btn-xs" onClick={handleQuickAdd}>
                {t("common.save")}
              </button>
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => { setShowQuickAdd(false); setQuickAddKey(""); setQuickAddLabel(""); }}>
                {t("common.cancel")}
              </button>
            </div>
          )}

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

      {/* Variable Management Section - only visible when editing */}
      {isEditing && template && (
        <div className="form-group variable-section">
          <div className="variable-section-header">
            <label className="form-label">{t("variable.title")}</label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { resetVarForm(); setShowVarEditor(true); }}
            >
              + {t("variable.addVariable")}
            </button>
          </div>

          {variables.length > 0 && (
            <div className="variable-list">
              {variables.map((v) => (
                <div key={v.id} className="variable-item">
                  <div className="variable-item-info">
                    <span className="variable-key">{`{{${v.key}}}`}</span>
                    <span className="variable-label">{v.label}</span>
                    {v.defaultValue && (
                      <span className="variable-default">{t("variable.default")}: {v.defaultValue}</span>
                    )}
                    {v.options && v.options.length > 0 && (
                      <span className="variable-options">{t("variable.options")}: {v.options.join(", ")}</span>
                    )}
                  </div>
                  <div className="variable-item-actions">
                    <button type="button" className="btn-icon" onClick={() => handleEditVariable(v)}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="btn-icon btn-icon-danger" onClick={() => handleDeleteVariable(v.id)}>
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {variables.length === 0 && !showVarEditor && (
            <p className="variable-empty">{t("variable.empty")}</p>
          )}

          {showVarEditor && (
            <div className="variable-editor">
              <div className="form-row">
                <div className="form-group form-group-half">
                  <label className="form-label">{t("variable.keyLabel")}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={varKey}
                    onChange={(e) => setVarKey(e.target.value)}
                    placeholder={t("variable.placeholder.key")}
                  />
                </div>
                <div className="form-group form-group-half">
                  <label className="form-label">{t("variable.labelLabel")}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={varLabel}
                    onChange={(e) => setVarLabel(e.target.value)}
                    placeholder={t("variable.placeholder.label")}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group form-group-half">
                  <label className="form-label">{t("variable.defaultLabel")}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={varDefault}
                    onChange={(e) => setVarDefault(e.target.value)}
                    placeholder={t("variable.placeholder.default")}
                  />
                </div>
                <div className="form-group form-group-half">
                  <label className="form-label">{t("variable.optionsLabel")}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={varOptions}
                    onChange={(e) => setVarOptions(e.target.value)}
                    placeholder={t("variable.placeholder.options")}
                  />
                </div>
              </div>
              <div className="variable-editor-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetVarForm}>
                  {t("common.cancel")}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveVariable}>
                  {t("common.save")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
