import { useState, useEffect, useCallback } from "react";
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

      <div className="form-group">
        <label className="form-label">{t("template.bodyLabel")}</label>
        <textarea
          className="form-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("template.placeholder.body")}
          rows={10}
        />
        {bodyTokens.length > 0 && (
          <div className="body-tokens-hint">
            {t("variable.detectedVars")}: {bodyTokens.map((tok) => (
              <span key={tok} className="token-badge">{"{{" + tok + "}}"}</span>
            ))}
          </div>
        )}
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
