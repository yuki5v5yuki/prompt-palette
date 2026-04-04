import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Tag } from "../types";
import { listTags, createTag, deleteTag } from "../desktop";
import { useToast } from "./Toast";

export default function TagManager() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");

  const reload = useCallback(async () => {
    const tgs = await listTags();
    if (!tgs.ok) {
      showToast(t("toast.loadFailed"), "error");
      setTags([]);
      return;
    }
    setTags(tgs.data ?? []);
  }, [showToast, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const r = await createTag({ name: name.trim() });
    if (!r.ok) {
      showToast(t("toast.saveFailed"), "error");
      return;
    }
    setName("");
    setIsCreating(false);
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    const r = await deleteTag(id);
    if (!r.ok) {
      showToast(t("toast.deleteFailed"), "error");
      return;
    }
    await reload();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") {
      setIsCreating(false);
      setName("");
    }
  };

  return (
    <div className="manager-page">
      <div className="panel-header">
        <h2 className="panel-title">{t("tag.title")}</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setIsCreating(true)}
        >
          + {t("tag.newTag")}
        </button>
      </div>

      {isCreating && (
        <div className="inline-form">
          <div className="form-row">
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("tag.placeholder.name")}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>
              {t("common.save")}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setIsCreating(false); setName(""); }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="item-list">
        {tags.length === 0 && (
          <p className="empty-message">{t("tag.empty")}</p>
        )}
        {tags.map((tag) => (
          <div key={tag.id} className="item-row">
            <div className="item-info">
              <span className="tag-badge">{tag.name}</span>
            </div>
            <div className="item-actions">
              <button className="btn btn-ghost btn-xs btn-danger-text" onClick={() => handleDelete(tag.id)}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
