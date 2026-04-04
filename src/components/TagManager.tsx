import { useState, useEffect, useCallback } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tag } from "../types";
import { listTags, createTag, deleteTag, reorderTags } from "../desktop";
import { useToast } from "./Toast";

function SortableTagRow({
  tag,
  onDelete,
  t,
}: {
  tag: Tag;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item-row${isDragging ? " dragging" : ""}`}
    >
      <div className="item-row-main">
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title={t("tag.dragHandleTitle")}
          aria-label={t("tag.dragHandleTitle")}
        >
          ⠿
        </span>
        <div className="item-info">
          <span className="tag-badge">{tag.name}</span>
        </div>
      </div>
      <div className="item-actions">
        <button
          className="btn btn-ghost btn-xs btn-danger-text"
          onClick={() => onDelete(tag.id)}
        >
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = tags.findIndex((tg) => tg.id === activeId);
      const newIndex = tags.findIndex((tg) => tg.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(tags, oldIndex, newIndex);
      setTags(reordered);

      const r = await reorderTags(reordered.map((tg) => tg.id));
      if (!r.ok) {
        showToast(t("toast.saveFailed"), "error");
        await reload();
      }
    },
    [tags, reload, showToast, t]
  );

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
        <h2 className="panel-title">
          {t("tag.title")}
          <span className="info-tooltip" title={t("tag.sectionHint")}><Info size={14} /></span>
        </h2>
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
        {tags.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tags.map((tg) => tg.id)}
              strategy={verticalListSortingStrategy}
            >
              {tags.map((tag) => (
                <SortableTagRow
                  key={tag.id}
                  tag={tag}
                  onDelete={handleDelete}
                  t={t}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
