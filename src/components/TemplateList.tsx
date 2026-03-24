import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Fuse from "fuse.js";
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
import type {
  TemplateWithTags,
  Category,
  Tag,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "../types";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCategories,
  listTags,
  updateCategory,
} from "../desktop";
import TemplateEditor from "./TemplateEditor";

type SortMode = "default" | "frequency" | "recent" | "name";

interface CategoryGroup {
  category: Category | null; // null = uncategorized
  templates: TemplateWithTags[];
}

// ─── Sortable Category Item ───

function SortableCategoryItem({
  group,
  isExpanded,
  onToggle,
  selectedId,
  onSelect,
  sortMode,
  onTemplateReorder,
}: {
  group: CategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortMode: SortMode;
  onTemplateReorder: (categoryId: string | null, oldIndex: number, newIndex: number) => void;
}) {
  const categoryId = group.category?.id ?? "__uncategorized__";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `cat-${categoryId}`,
    disabled: group.category === null, // uncategorized is not draggable
  });

  const templateSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const templateIds = group.templates.map((t) => `tpl-${t.id}`);

  const handleTemplateDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templateIds.indexOf(active.id as string);
    const newIndex = templateIds.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onTemplateReorder(group.category?.id ?? null, oldIndex, newIndex);
    }
  }, [templateIds, onTemplateReorder, group.category?.id]);

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
      <div className="category-header" onClick={onToggle}>
        {group.category !== null && (
          <span className="drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            ⠿
          </span>
        )}
        <span className={`category-chevron ${isExpanded ? "expanded" : ""}`}>▶</span>
        {group.category ? (
          <span
            className="category-dot"
            style={{ backgroundColor: group.category.color || "var(--text-secondary)" }}
          />
        ) : (
          <span className="category-dot" style={{ backgroundColor: "var(--border)" }} />
        )}
        <span className="category-name">
          {group.category?.name ?? "未分類"}
        </span>
        <span className="category-badge">{group.templates.length}</span>
      </div>

      {isExpanded && (
        <div className="category-templates">
          <DndContext
            sensors={templateSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTemplateDragEnd}
          >
            <SortableContext items={templateIds} strategy={verticalListSortingStrategy}>
              {group.templates.map((tpl) => (
                <SortableTemplateItem
                  key={tpl.id}
                  template={tpl}
                  isSelected={selectedId === tpl.id}
                  onSelect={() => onSelect(tpl.id)}
                  isDndDisabled={sortMode !== "default"}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Template Item ───

function SortableTemplateItem({
  template,
  isSelected,
  onSelect,
  isDndDisabled,
}: {
  template: TemplateWithTags;
  isSelected: boolean;
  onSelect: () => void;
  isDndDisabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `tpl-${template.id}`,
    disabled: isDndDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`template-item ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      onClick={onSelect}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
        {!isDndDisabled && (
          <span
            className="drag-handle"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: "2px" }}
          >
            ⠿
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="template-item-title">{template.title}</div>
          <div className="template-item-meta">
            {template.tags.length > 0 && (
              <span className="template-item-tags">
                {template.tags.map((tag) => (
                  <span key={tag.id} className="tag-badge">
                    {tag.name}
                  </span>
                ))}
              </span>
            )}
          </div>
          <div className="template-item-body">
            {template.body.slice(0, 80)}
            {template.body.length > 80 ? "..." : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function TemplateList() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateWithTags[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // New state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");

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

  // ─── Fuse.js search ───

  const fuse = useMemo(
    () =>
      new Fuse(templates, {
        keys: ["title", "tags.name", "body"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    return fuse.search(searchQuery).map((r) => r.item);
  }, [fuse, searchQuery, templates]);

  // ─── Sort ───

  const sortTemplates = useCallback(
    (tpls: TemplateWithTags[]): TemplateWithTags[] => {
      if (sortMode === "default") return tpls; // already sorted by sort_order from DB
      const sorted = [...tpls];
      switch (sortMode) {
        case "frequency":
          sorted.sort((a, b) => b.useCount - a.useCount);
          break;
        case "recent":
          sorted.sort((a, b) => {
            if (!a.lastUsedAt && !b.lastUsedAt) return 0;
            if (!a.lastUsedAt) return 1;
            if (!b.lastUsedAt) return -1;
            return b.lastUsedAt.localeCompare(a.lastUsedAt);
          });
          break;
        case "name":
          sorted.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
      return sorted;
    },
    [sortMode]
  );

  // ─── Grouping ───

  const groups: CategoryGroup[] = useMemo(() => {
    const catGroups: CategoryGroup[] = categories.map((cat) => ({
      category: cat,
      templates: sortTemplates(
        filteredTemplates.filter((t) => t.categoryId === cat.id)
      ),
    }));

    const uncategorized = sortTemplates(
      filteredTemplates.filter((t) => !t.categoryId)
    );

    // Filter out empty categories when searching
    const nonEmpty = searchQuery.trim()
      ? catGroups.filter((g) => g.templates.length > 0)
      : catGroups;

    if (uncategorized.length > 0 || !searchQuery.trim()) {
      nonEmpty.push({ category: null, templates: uncategorized });
    }

    return nonEmpty;
  }, [categories, filteredTemplates, sortTemplates, searchQuery]);

  // Auto-expand all when searching
  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim()) {
      return new Set(groups.map((g) => g.category?.id ?? "__uncategorized__"));
    }
    return expandedCategories;
  }, [searchQuery, groups, expandedCategories]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─── D&D: Category reorder ───

  const categoryDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const categoryIds = groups
    .filter((g) => g.category !== null)
    .map((g) => `cat-${g.category!.id}`);

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categoryIds.indexOf(active.id as string);
    const newIndex = categoryIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const reorderedCats = arrayMove(
      categories.filter((c) => categoryIds.includes(`cat-${c.id}`)),
      oldIndex,
      newIndex
    );
    setCategories((prev) => {
      const otherCats = prev.filter((c) => !categoryIds.includes(`cat-${c.id}`));
      return [...reorderedCats, ...otherCats];
    });

    // Persist
    for (let i = 0; i < reorderedCats.length; i++) {
      updateCategory(reorderedCats[i].id, { sortOrder: i });
    }
  };

  // ─── D&D: Template reorder ───

  const handleTemplateReorder = async (
    categoryId: string | null,
    oldIndex: number,
    newIndex: number
  ) => {
    if (sortMode !== "default") return; // D&D only in default sort

    const group = groups.find(
      (g) => (g.category?.id ?? null) === categoryId
    );
    if (!group) return;

    const reordered = arrayMove(group.templates, oldIndex, newIndex);

    // Optimistic update
    setTemplates((prev) => {
      const updated = [...prev];
      for (let i = 0; i < reordered.length; i++) {
        const idx = updated.findIndex((t) => t.id === reordered[i].id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], sortOrder: i };
        }
      }
      return updated.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    // Persist
    for (let i = 0; i < reordered.length; i++) {
      updateTemplate(reordered[i].id, { sortOrder: i });
    }
  };

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

        {/* Search bar */}
        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder={t("template.searchPlaceholder", "テンプレートを検索...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Sort buttons */}
        <div className="sort-buttons">
          {(
            [
              ["default", t("template.sortDefault", "並び順")],
              ["frequency", t("template.sortFrequency", "使用頻度")],
              ["recent", t("template.sortRecent", "最近使用")],
              ["name", t("template.sortName", "名前")],
            ] as [SortMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              className={`sort-btn ${sortMode === mode ? "active" : ""}`}
              onClick={() => setSortMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category accordion tree */}
        <div className="template-items">
          {groups.length === 0 && !isCreating && (
            <p className="empty-message">{t("template.empty")}</p>
          )}

          <DndContext
            sensors={categoryDndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
              {groups.map((group) => {
                const catId = group.category?.id ?? "__uncategorized__";
                const isExpanded = effectiveExpanded.has(catId);

                return (
                  <div key={catId}>
                    {group.category === null && groups.length > 1 && (
                      <div className="uncategorized-divider" />
                    )}
                    <SortableCategoryItem
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => toggleCategory(catId)}
                      selectedId={selectedId}
                      onSelect={(id) => {
                        setSelectedId(id);
                        setIsCreating(false);
                      }}
                      sortMode={sortMode}
                      onTemplateReorder={handleTemplateReorder}
                    />
                  </div>
                );
              })}
            </SortableContext>
          </DndContext>
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
            onSave={(data) =>
              handleUpdate(selectedTemplate.id, data as UpdateTemplateInput)
            }
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
