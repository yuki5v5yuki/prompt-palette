import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Category } from "../types";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../desktop";

export default function CategoryManager() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#534AB7");

  const reload = useCallback(async () => {
    const cats = await listCategories();
    setCategories(cats ?? []);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetForm = () => {
    setName("");
    setIcon("");
    setColor("#534AB7");
    setEditingId(null);
    setIsCreating(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon ?? "");
    setColor(cat.color ?? "#534AB7");
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await updateCategory(editingId, {
        name: name.trim(),
        icon: icon || undefined,
        color: color || undefined,
      });
    } else {
      await createCategory({
        name: name.trim(),
        icon: icon || undefined,
        color: color || undefined,
      });
    }
    resetForm();
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await deleteCategory(id);
    if (editingId === id) resetForm();
    await reload();
  };

  return (
    <div className="manager-page">
      <div className="panel-header">
        <h2 className="panel-title">{t("category.title")}</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
        >
          + {t("category.newCategory")}
        </button>
      </div>

      {(isCreating || editingId) && (
        <div className="inline-form">
          <div className="form-row">
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("category.placeholder.name")}
              autoFocus
            />
            <input
              type="text"
              className="form-input form-input-sm"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder={t("category.iconLabel")}
              style={{ width: 80 }}
            />
            <input
              type="color"
              className="form-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              {t("common.save")}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={resetForm}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="item-list">
        {categories.length === 0 && (
          <p className="empty-message">{t("category.empty")}</p>
        )}
        {categories.map((cat) => (
          <div key={cat.id} className="item-row">
            <div className="item-info">
              {cat.color && (
                <span className="color-dot" style={{ background: cat.color }} />
              )}
              {cat.icon && <span className="item-icon">{cat.icon}</span>}
              <span className="item-name">{cat.name}</span>
            </div>
            <div className="item-actions">
              <button className="btn btn-ghost btn-xs" onClick={() => startEdit(cat)}>
                {t("common.edit")}
              </button>
              <button className="btn btn-ghost btn-xs btn-danger-text" onClick={() => handleDelete(cat.id)}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
