import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import Fuse from "fuse.js";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type CollisionDetection,
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
  createCategory,
  updateCategory,
  deleteCategory,
  listTags,
} from "../desktop";
import TemplateEditor from "./TemplateEditor";

type SortMode = "default" | "frequency" | "recent" | "name";

interface CategoryGroup {
  category: Category | null; // null = uncategorized
  templates: TemplateWithTags[];
}

// ─── Preset Colors ───

const PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
  "#1E293B", // dark
];

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="color-preset-picker">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          className={`color-swatch ${value.toLowerCase() === c.toLowerCase() ? "active" : ""}`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
          type="button"
        />
      ))}
      <label className="color-swatch color-swatch-custom" title="カスタムカラー">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
        <span style={{ fontSize: "10px" }}>⋯</span>
      </label>
    </div>
  );
}

// ─── Sortable Category Item ───

function SortableCategoryItem({
  group,
  isExpanded,
  onToggle,
  selectedId,
  onSelect,
  sortMode,
  isDropTarget,
  onEditCategory,
  onDeleteCategory,
  editingCategoryId,
  categoryForm,
  onCategoryFormChange,
  onSaveCategory,
  onCancelCategoryEdit,
}: {
  group: CategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortMode: SortMode;
  isDropTarget: boolean;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  editingCategoryId: string | null;
  categoryForm: { name: string; icon: string; color: string };
  onCategoryFormChange: (field: string, value: string) => void;
  onSaveCategory: () => void;
  onCancelCategoryEdit: () => void;
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const templateIds = group.templates.map((t) => `tpl-${t.id}`);

  const isEditing = editingCategoryId === group.category?.id && group.category !== null;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
      <div className={`category-header ${isDropTarget ? "category-drop-target" : ""}`} onClick={isEditing ? undefined : onToggle}>
        {group.category !== null && !isEditing && (
          <span className="drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            ⠿
          </span>
        )}
        {isEditing ? (
          <div className="category-edit-form" onClick={(e) => e.stopPropagation()}>
            <div className="category-edit-fields">
              <div className="category-edit-row">
                <input
                  type="text"
                  className="form-input form-input-sm"
                  value={categoryForm.name}
                  onChange={(e) => onCategoryFormChange("name", e.target.value)}
                  placeholder="カテゴリ名"
                  autoFocus
                />
                <button className="btn btn-primary btn-xs" onClick={onSaveCategory}>✓</button>
                <button className="btn btn-secondary btn-xs" onClick={onCancelCategoryEdit}>✕</button>
              </div>
              <ColorPicker
                value={categoryForm.color}
                onChange={(c) => onCategoryFormChange("color", c)}
              />
            </div>
          </div>
        ) : (
          <>
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
            {group.category !== null && (
              <span className="category-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-ghost btn-xs" onClick={() => onEditCategory(group.category!)}>✏️</button>
                <button className="btn btn-ghost btn-xs btn-danger-text" onClick={() => onDeleteCategory(group.category!.id)}>🗑️</button>
              </span>
            )}
          </>
        )}
      </div>

      {isExpanded && (
        <div className="category-templates">
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

  // Resizable pane
  const [listWidth, setListWidth] = useState(() => {
    const saved = localStorage.getItem("templateListWidth");
    return saved ? parseInt(saved, 10) : 320;
  });
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const sidebar = document.querySelector(".sidebar");
      const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 0;
      const newWidth = Math.max(200, Math.min(ev.clientX - sidebarWidth, 600));
      setListWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setListWidth((w) => {
        localStorage.setItem("templateListWidth", String(w));
        return w;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // New state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Category CRUD state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [categoryFormIcon, setCategoryFormIcon] = useState("");
  const [categoryFormColor, setCategoryFormColor] = useState("#534AB7");

  const resetCategoryForm = () => {
    setCategoryFormName("");
    setCategoryFormIcon("");
    setCategoryFormColor("#534AB7");
    setEditingCategoryId(null);
    setIsCreatingCategory(false);
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCategoryFormName(cat.name);
    setCategoryFormIcon(cat.icon ?? "");
    setCategoryFormColor(cat.color ?? "#534AB7");
    setIsCreatingCategory(false);
  };

  const handleSaveCategory = async () => {
    if (!categoryFormName.trim()) return;
    if (editingCategoryId) {
      await updateCategory(editingCategoryId, {
        name: categoryFormName.trim(),
        icon: categoryFormIcon || undefined,
        color: categoryFormColor || undefined,
      });
    } else {
      await createCategory({
        name: categoryFormName.trim(),
        icon: categoryFormIcon || undefined,
        color: categoryFormColor || undefined,
      });
    }
    resetCategoryForm();
    await reload();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await deleteCategory(id);
    if (editingCategoryId === id) resetCategoryForm();
    await reload();
  };

  const handleCategoryFormChange = (field: string, value: string) => {
    switch (field) {
      case "name": setCategoryFormName(value); break;
      case "icon": setCategoryFormIcon(value); break;
      case "color": setCategoryFormColor(value); break;
    }
  };

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

  // ─── D&D: Unified template drag state ───

  const [activeType, setActiveType] = useState<"template" | "category" | null>(null);
  const [activeTplData, setActiveTplData] = useState<TemplateWithTags | null>(null);
  const [overCategoryId, setOverCategoryId] = useState<string | null>(null);

  const allTemplateIds = useMemo(() => {
    return groups.flatMap((g) =>
      effectiveExpanded.has(g.category?.id ?? "__uncategorized__")
        ? g.templates.map((t) => `tpl-${t.id}`)
        : []
    );
  }, [groups, effectiveExpanded]);

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    if (activeId.startsWith("cat-")) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => String(c.id).startsWith("cat-")
        ),
      });
    }
    // Template drag: prefer template targets, fall back to category targets
    const tplContainers = args.droppableContainers.filter(
      (c) => String(c.id).startsWith("tpl-")
    );
    const tplCollisions = pointerWithin({ ...args, droppableContainers: tplContainers });
    if (tplCollisions.length > 0) return tplCollisions;

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => String(c.id).startsWith("cat-")
      ),
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith("tpl-")) {
      setActiveType("template");
      const tplId = id.replace("tpl-", "");
      setActiveTplData(templates.find((t) => t.id === tplId) ?? null);
    } else if (id.startsWith("cat-")) {
      setActiveType("category");
      setActiveTplData(null);
    }
  }, [templates]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (activeType !== "template") return;
    if (!event.over) { setOverCategoryId(null); return; }
    const overId = String(event.over.id);
    if (overId.startsWith("cat-")) {
      setOverCategoryId(overId.replace("cat-", ""));
    } else if (overId.startsWith("tpl-")) {
      const tplId = overId.replace("tpl-", "");
      const tpl = templates.find((t) => t.id === tplId);
      setOverCategoryId(tpl?.categoryId ?? "__uncategorized__");
    } else {
      setOverCategoryId(null);
    }
  }, [templates, activeType]);

  const handleUnifiedDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveType(null);
    setActiveTplData(null);
    setOverCategoryId(null);

    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Category reorder
    if (activeId.startsWith("cat-") && overId.startsWith("cat-")) {
      const oldIndex = categoryIds.indexOf(activeId);
      const newIndex = categoryIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedCats = arrayMove(
        categories.filter((c) => categoryIds.includes(`cat-${c.id}`)),
        oldIndex,
        newIndex
      );
      setCategories((prev) => {
        const otherCats = prev.filter((c) => !categoryIds.includes(`cat-${c.id}`));
        return [...reorderedCats, ...otherCats];
      });
      for (let i = 0; i < reorderedCats.length; i++) {
        updateCategory(reorderedCats[i].id, { sortOrder: i });
      }
      return;
    }

    // Template drag
    if (activeId.startsWith("tpl-")) {
      if (sortMode !== "default") return;

      const activeTplId = activeId.replace("tpl-", "");
      const activeTpl = templates.find((t) => t.id === activeTplId);
      if (!activeTpl) return;

      const sourceCatId = activeTpl.categoryId ?? null;

      let targetCatId: string | null;
      let targetInsertIndex = 0;

      if (overId.startsWith("tpl-")) {
        const overTplId = overId.replace("tpl-", "");
        const overTpl = templates.find((t) => t.id === overTplId);
        if (!overTpl) return;
        targetCatId = overTpl.categoryId ?? null;
        const targetGroup = groups.find((g) => (g.category?.id ?? null) === targetCatId);
        if (targetGroup) {
          targetInsertIndex = targetGroup.templates.findIndex((t) => t.id === overTplId);
        }
      } else if (overId.startsWith("cat-")) {
        const catKey = overId.replace("cat-", "");
        targetCatId = catKey === "__uncategorized__" ? null : catKey;
        targetInsertIndex = 0;
      } else {
        return;
      }

      // Same category: reorder
      if (sourceCatId === targetCatId) {
        const group = groups.find((g) => (g.category?.id ?? null) === sourceCatId);
        if (!group) return;
        const oldIndex = group.templates.findIndex((t) => t.id === activeTplId);
        if (oldIndex === -1 || targetInsertIndex === -1) return;
        const reordered = arrayMove(group.templates, oldIndex, targetInsertIndex);
        setTemplates((prev) => {
          const updated = [...prev];
          for (let i = 0; i < reordered.length; i++) {
            const idx = updated.findIndex((t) => t.id === reordered[i].id);
            if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: i };
          }
          return updated.sort((a, b) => a.sortOrder - b.sortOrder);
        });
        for (let i = 0; i < reordered.length; i++) {
          updateTemplate(reordered[i].id, { sortOrder: i });
        }
        return;
      }

      // Cross-category move
      const newCategoryId = targetCatId === null ? "" : targetCatId;

      // Optimistic update
      setTemplates((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTplId
            ? { ...t, categoryId: targetCatId, sortOrder: targetInsertIndex }
            : t
        );
        // Renumber target category
        const targetTpls = updated
          .filter((t) => (t.categoryId ?? null) === targetCatId && t.id !== activeTplId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        targetTpls.splice(targetInsertIndex, 0, updated.find((t) => t.id === activeTplId)!);
        for (let i = 0; i < targetTpls.length; i++) {
          const idx = updated.findIndex((t) => t.id === targetTpls[i].id);
          if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: i };
        }
        // Renumber source category
        const sourceTpls = updated
          .filter((t) => (t.categoryId ?? null) === sourceCatId && t.id !== activeTplId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        for (let i = 0; i < sourceTpls.length; i++) {
          const idx = updated.findIndex((t) => t.id === sourceTpls[i].id);
          if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: i };
        }
        return updated.sort((a, b) => a.sortOrder - b.sortOrder);
      });

      // Persist: move template to new category
      await updateTemplate(activeTplId, {
        categoryId: newCategoryId,
        sortOrder: targetInsertIndex,
      });

      // Persist: renumber target category
      const targetGroup = groups.find((g) => (g.category?.id ?? null) === targetCatId);
      if (targetGroup) {
        const targetTpls = [...targetGroup.templates.filter((t) => t.id !== activeTplId)];
        targetTpls.splice(targetInsertIndex, 0, activeTpl);
        for (let i = 0; i < targetTpls.length; i++) {
          if (targetTpls[i].id !== activeTplId) {
            updateTemplate(targetTpls[i].id, { sortOrder: i });
          }
        }
      }

      // Persist: renumber source category
      const sourceGroup = groups.find((g) => (g.category?.id ?? null) === sourceCatId);
      if (sourceGroup) {
        const sourceTpls = sourceGroup.templates.filter((t) => t.id !== activeTplId);
        for (let i = 0; i < sourceTpls.length; i++) {
          updateTemplate(sourceTpls[i].id, { sortOrder: i });
        }
      }
    }
  }, [categoryIds, categories, templates, groups, sortMode]);

  return (
    <div className="template-page">
      {/* Left: Template list */}
      <div className="template-list-panel" style={{ width: listWidth, minWidth: 200 }}>
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

        {/* Sort buttons + Add category */}
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
          <button
            className="btn btn-ghost btn-xs"
            style={{ marginLeft: "auto", fontSize: "0.75rem" }}
            onClick={() => {
              resetCategoryForm();
              setIsCreatingCategory(true);
            }}
          >
            + {t("category.newCategory", "カテゴリ追加")}
          </button>
        </div>

        {/* Category accordion tree */}
        <div className="template-items">
          {isCreatingCategory && (
            <div className="category-create-form">
              <div className="category-edit-form">
                <div className="category-edit-fields">
                  <div className="category-edit-row">
                    <input
                      type="text"
                      className="form-input form-input-sm"
                      value={categoryFormName}
                      onChange={(e) => setCategoryFormName(e.target.value)}
                      placeholder={t("category.placeholder.name", "カテゴリ名")}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-xs" onClick={handleSaveCategory}>✓</button>
                    <button className="btn btn-secondary btn-xs" onClick={resetCategoryForm}>✕</button>
                  </div>
                  <ColorPicker
                    value={categoryFormColor}
                    onChange={(c) => setCategoryFormColor(c)}
                  />
                </div>
              </div>
            </div>
          )}

          {groups.length === 0 && !isCreating && (
            <p className="empty-message">{t("template.empty")}</p>
          )}

          <DndContext
            sensors={categoryDndSensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleUnifiedDragEnd}
          >
            <SortableContext items={[...categoryIds, ...allTemplateIds]} strategy={verticalListSortingStrategy}>
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
                      isDropTarget={activeType === "template" && overCategoryId === catId}
                      onEditCategory={startEditCategory}
                      onDeleteCategory={handleDeleteCategory}
                      editingCategoryId={editingCategoryId}
                      categoryForm={{ name: categoryFormName, icon: categoryFormIcon, color: categoryFormColor }}
                      onCategoryFormChange={handleCategoryFormChange}
                      onSaveCategory={handleSaveCategory}
                      onCancelCategoryEdit={resetCategoryForm}
                    />
                  </div>
                );
              })}
            </SortableContext>
            <DragOverlay>
              {activeTplData ? (
                <div className="template-item drag-overlay">
                  <div className="template-item-title">{activeTplData.title}</div>
                  <div className="template-item-body">
                    {activeTplData.body.slice(0, 60)}
                    {activeTplData.body.length > 60 ? "..." : ""}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Resizer */}
      <div className="pane-resizer" onMouseDown={handleResizeStart} />

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
