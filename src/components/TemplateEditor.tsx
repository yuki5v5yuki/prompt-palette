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
  const [varOptionsList, setVarOptionsList] = useState<string[]>([]);
  const [varAllowFreeText, setVarAllowFreeText] = useState(true);

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
    setVarOptionsList([]);
    setVarAllowFreeText(true);
    setEditingVar(null);
    setShowVarEditor(false);
  };

  const handleSaveVariable = async () => {
    if (!varKey.trim() || !template?.id) return;

    const filteredOptions = varOptionsList.map((s) => s.trim()).filter(Boolean);
    const optionsArray = filteredOptions.length > 0 ? filteredOptions : undefined;

    if (editingVar) {
      await updateVariable(editingVar.id, {
        key: varKey.trim(),
        label: varLabel.trim() || varKey.trim(),
        defaultValue: varDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: varAllowFreeText,
      });
    } else {
      await createVariable({
        templateId: template.id,
        key: varKey.trim(),
        label: varLabel.trim() || varKey.trim(),
        defaultValue: varDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: varAllowFreeText,
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
    setVarOptionsList(v.options ?? []);
    setVarAllowFreeText(v.allowFreeText);
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

      {/* Variable Detail Settings - collapsible, only when editing & variables exist */}
      {isEditing && template && variables.length > 0 && (
        <details className="variable-details">
          <summary className="variable-details-summary">
            {t("variable.detailSettings")}
            <span className="variable-details-hint">{t("variable.detailSettingsHint")}</span>
          </summary>
          <div className="variable-details-content">
            {variables.map((v) => (
              <div key={v.id} className="variable-card">
                <div className="variable-card-header" onClick={() => editingVar?.id === v.id ? resetVarForm() : handleEditVariable(v)}>
                  <span className="variable-chip variable-chip-static">{v.key}</span>
                  <span className="variable-card-label">{v.label}</span>
                  {v.defaultValue && <span className="variable-card-meta">{v.defaultValue}</span>}
                  {v.options && v.options.length > 0 && <span className="variable-card-meta">{v.options.join(", ")}</span>}
                  <span className="variable-card-toggle">{editingVar?.id === v.id ? "▲" : "▼"}</span>
                </div>
                {editingVar?.id === v.id && (
                  <div className="variable-card-body">
                    <div className="form-row">
                      <div className="form-group form-group-half">
                        <label className="form-label">{t("variable.labelLabel")}</label>
                        <input type="text" className="form-input" value={varLabel} onChange={(e) => setVarLabel(e.target.value)} placeholder={t("variable.placeholder.label")} />
                      </div>
                      <div className="form-group form-group-half">
                        <label className="form-label">{t("variable.defaultLabel")}</label>
                        <input type="text" className="form-input" value={varDefault} onChange={(e) => setVarDefault(e.target.value)} placeholder={t("variable.placeholder.default")} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t("variable.optionsLabel")}</label>
                      <div className="option-list">
                        {varOptionsList.map((opt, idx) => (
                          <div key={idx} className="option-item">
                            <input
                              type="text"
                              className="form-input"
                              value={opt}
                              onChange={(e) => {
                                const next = [...varOptionsList];
                                next[idx] = e.target.value;
                                setVarOptionsList(next);
                              }}
                              placeholder={`${t("variable.optionsLabel")} ${idx + 1}`}
                            />
                            <button
                              type="button"
                              className="btn-icon btn-icon-danger"
                              onClick={() => setVarOptionsList(varOptionsList.filter((_, i) => i !== idx))}
                              title={t("common.delete")}
                            >
                              x
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="option-add-btn"
                          onClick={() => setVarOptionsList([...varOptionsList, ""])}
                        >
                          + {t("variable.addOption")}
                        </button>
                      </div>
                    </div>
                    <label className="option-freetext-check">
                      <input
                        type="checkbox"
                        checked={varAllowFreeText}
                        onChange={(e) => setVarAllowFreeText(e.target.checked)}
                      />
                      {t("variable.allowFreeText")}
                    </label>
                    <div className="variable-card-actions">
                      <button type="button" className="btn btn-danger btn-xs" onClick={() => handleDeleteVariable(v.id)}>
                        {t("common.delete")}
                      </button>
                      <div>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={resetVarForm}>
                          {t("common.cancel")}
                        </button>
                        <button type="button" className="btn btn-primary btn-xs" onClick={handleSaveVariable} style={{ marginLeft: 6 }}>
                          {t("common.save")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
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
