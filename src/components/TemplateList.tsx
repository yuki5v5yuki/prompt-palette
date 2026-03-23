import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TemplateWithTags, Category, Tag, CreateTemplateInput, UpdateTemplateInput } from "../types";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCategories,
  listTags,
} from "../desktop";
import TemplateEditor from "./TemplateEditor";

export default function TemplateList() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateWithTags[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");

  const reload = useCallback(async () => {
    const [tpls, cats, tgs] = await Promise.all([
      listTemplates(),
      listCategories(),
      listTags(),
    ]);
    setTemplates(tpls ?? []);
    setCategories(cats ?? []);
    setTags(tgs ?? []);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  const handleCreate = async (input: CreateTemplateInput) => {
    await createTemplate(input);
    setIsCreating(false);
    await reload();
  };

  const handleUpdate = async (id: string, input: UpdateTemplateInput) => {
    await updateTemplate(id, input);
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await deleteTemplate(id);
    setSelectedId(null);
    await reload();
  };

  const filtered = filterCategory
    ? templates.filter((t) => t.categoryId === filterCategory)
    : templates;

  return (
    <div className="template-page">
      {/* Left: Template list */}
      <div className="template-list-panel">
        <div className="panel-header">
          <h2 className="panel-title">{t("template.title")}</h2>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIsCreating(true);
              setSelectedId(null);
            }}
          >
            + {t("template.newTemplate")}
          </button>
        </div>

        {categories.length > 0 && (
          <div className="filter-bar">
            <select
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">{t("template.categoryLabel")}: すべて</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="template-items">
          {filtered.length === 0 && !isCreating && (
            <p className="empty-message">{t("template.empty")}</p>
          )}
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className={`template-item ${selectedId === tpl.id ? "selected" : ""}`}
              onClick={() => {
                setSelectedId(tpl.id);
                setIsCreating(false);
              }}
            >
              <div className="template-item-title">{tpl.title}</div>
              <div className="template-item-meta">
                {tpl.tags.length > 0 && (
                  <span className="template-item-tags">
                    {tpl.tags.map((tag) => (
                      <span key={tag.id} className="tag-badge">{tag.name}</span>
                    ))}
                  </span>
                )}
              </div>
              <div className="template-item-body">{tpl.body.slice(0, 80)}{tpl.body.length > 80 ? "..." : ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="template-editor-panel">
        {isCreating ? (
          <TemplateEditor
            key="new"
            categories={categories}
            tags={tags}
            onSave={(data) => handleCreate(data as CreateTemplateInput)}
            onCancel={() => setIsCreating(false)}
          />
        ) : selectedTemplate ? (
          <TemplateEditor
            key={selectedTemplate.id}
            template={selectedTemplate}
            categories={categories}
            tags={tags}
            onSave={(data) => handleUpdate(selectedTemplate.id, data as UpdateTemplateInput)}
            onDelete={() => handleDelete(selectedTemplate.id)}
            onCancel={() => setSelectedId(null)}
          />
        ) : (
          <div className="editor-empty">
            <p>{t("template.empty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
