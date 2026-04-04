import { useState, useEffect, useCallback } from "react";
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
import { ChevronRight, ChevronDown } from "lucide-react";
import type { VariablePackage, Variable } from "../types";
import {
  listVariablePackages,
  createVariablePackage,
  updateVariablePackage,
  deleteVariablePackage,
  listVariables,
  createVariable,
  updateVariable,
} from "../desktop";
import { useToast } from "./Toast";

/** Extended package info with its single auto-created variable */
interface PackageWithVar {
  pkg: VariablePackage;
  variable: Variable | null;
}

function SortableVariablePackageItem({
  item,
  editingId,
  editName,
  editDefault,
  editOptions,
  editAllowFreeText,
  editRequired,
  setEditName,
  setEditDefault,
  setEditOptions,
  setEditAllowFreeText,
  setEditRequired,
  startEdit,
  resetEdit,
  handleSaveEdit,
  handleDelete,
  t,
}: {
  item: PackageWithVar;
  editingId: string | null;
  editName: string;
  editDefault: string;
  editOptions: string[];
  editAllowFreeText: boolean;
  editRequired: boolean;
  setEditName: (v: string) => void;
  setEditDefault: (v: string) => void;
  setEditOptions: (v: string[]) => void;
  setEditAllowFreeText: (v: boolean) => void;
  setEditRequired: (v: boolean) => void;
  startEdit: (item: PackageWithVar) => void;
  resetEdit: () => void;
  handleSaveEdit: () => void;
  handleDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const isEditing = editingId === item.pkg.id;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.pkg.id,
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`package-item${isDragging ? " dragging" : ""}`}
    >
      <div className="item-row">
        <div className="item-row-main">
          <span
            className="drag-handle"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            title={t("variablePackage.dragHandleTitle")}
            aria-label={t("variablePackage.dragHandleTitle")}
          >
            ⠿
          </span>
          <div
            className="item-info"
            onClick={() => (isEditing ? resetEdit() : startEdit(item))}
            style={{ cursor: "pointer", flex: 1, minWidth: 0 }}
          >
            <span className="variable-chip variable-chip-static">{item.pkg.name}</span>
            {item.variable?.defaultValue && (
              <span className="variable-card-meta">
                {t("variable.default")}: {item.variable.defaultValue}
              </span>
            )}
            {item.variable?.options && item.variable.options.length > 0 && (
              <span className="variable-card-meta">
                {t("variable.options")}: {item.variable.options.join(", ")}
              </span>
            )}
            <span className="variable-card-toggle">
              {isEditing ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </div>
        </div>
        <div className="item-actions">
          <button
            className="btn btn-ghost btn-xs btn-danger-text"
            onClick={() => handleDelete(item.pkg.id)}
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="variable-card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t("variablePackage.nameLabel")}</label>
              <input
                type="text"
                className="form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("variablePackage.placeholder.name")}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t("variable.optionsLabel")}</label>
            <p className="form-hint">{t("variable.optionsHint")}</p>
            <div className="option-list">
              {editOptions.map((opt, idx) => (
                <div key={idx} className="option-item">
                  <input
                    type="text"
                    className="form-input"
                    value={opt}
                    onChange={(e) => {
                      const next = [...editOptions];
                      next[idx] = e.target.value;
                      setEditOptions(next);
                    }}
                    placeholder={`${t("variable.optionsLabel")} ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="btn-icon btn-icon-danger"
                    onClick={() => {
                      const removed = editOptions[idx];
                      const next = editOptions.filter((_, i) => i !== idx);
                      setEditOptions(next);
                      if (editDefault === removed.trim()) {
                        setEditDefault("");
                      }
                    }}
                    title={t("common.delete")}
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="option-add-btn"
                onClick={() => setEditOptions([...editOptions, ""])}
              >
                + {t("variable.addOption")}
              </button>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group form-group-half">
              <label className="form-label">{t("variable.defaultLabel")}</label>
              <p className="form-hint">{t("variable.defaultHintWithOptions")}</p>
              <select
                className="form-select"
                value={editDefault}
                onChange={(e) => setEditDefault(e.target.value)}
              >
                <option value="">{t("variable.noDefault")}</option>
                {editOptions
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <label className="option-freetext-check">
            <input
              type="checkbox"
              checked={editAllowFreeText}
              onChange={(e) => setEditAllowFreeText(e.target.checked)}
            />
            {t("variable.allowFreeText")}
          </label>
          <label className="option-freetext-check">
            <input
              type="checkbox"
              checked={editRequired}
              onChange={(e) => setEditRequired(e.target.checked)}
            />
            {t("variable.required")}
          </label>
          <div className="variable-card-actions">
            <button type="button" className="btn btn-secondary btn-xs" onClick={resetEdit}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={handleSaveEdit}
              style={{ marginLeft: 6 }}
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VariablePackageManager() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [items, setItems] = useState<PackageWithVar[]>([]);

  // Creating new variable
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newDefault, setNewDefault] = useState("");
  const [newAllowFreeText, setNewAllowFreeText] = useState(true);
  const [newRequired, setNewRequired] = useState(false);

  // Editing existing variable (inline settings)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDefault, setEditDefault] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editAllowFreeText, setEditAllowFreeText] = useState(true);
  const [editRequired, setEditRequired] = useState(false);

  const reload = useCallback(async () => {
    const pkgs = await listVariablePackages();
    if (!pkgs.ok) {
      showToast(t("toast.loadFailed"), "error");
      setItems([]);
      return;
    }
    const list = pkgs.data ?? [];
    const withVars: PackageWithVar[] = await Promise.all(
      list.map(async (pkg) => {
        const vars = await listVariables(pkg.id);
        const vlist = vars.ok ? (vars.data ?? []) : [];
        return { pkg, variable: vlist.length > 0 ? vlist[0] : null };
      })
    );
    setItems(withVars);
  }, [showToast, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetCreate = () => {
    setIsCreating(false);
    setNewName("");
    setNewOptions([]);
    setNewDefault("");
    setNewAllowFreeText(true);
    setNewRequired(false);
  };

  // --- Create new variable (package + auto-variable) ---
  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const pkgRes = await createVariablePackage({ name: trimmed });
    if (!pkgRes.ok || !pkgRes.data) {
      showToast(t("toast.saveFailed"), "error");
      return;
    }
    const pkg = pkgRes.data;
    const filteredOptions = newOptions.map((s) => s.trim()).filter(Boolean);
    const optionsArray = filteredOptions.length > 0 ? filteredOptions : undefined;
    const varRes = await createVariable({
      packageId: pkg.id,
      key: trimmed,
      label: trimmed,
      defaultValue: newDefault.trim() || undefined,
      options: optionsArray,
      allowFreeText: newAllowFreeText,
      required: newRequired,
    });
    if (!varRes.ok) {
      showToast(t("toast.saveFailed"), "error");
      return;
    }
    resetCreate();
    await reload();
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    const r = await deleteVariablePackage(id);
    if (!r.ok) {
      showToast(t("toast.deleteFailed"), "error");
      return;
    }
    if (editingId === id) resetEdit();
    await reload();
  };

  // --- Edit (inline settings) ---
  const startEdit = (item: PackageWithVar) => {
    setEditingId(item.pkg.id);
    setEditName(item.pkg.name);
    setEditDefault(item.variable?.defaultValue ?? "");
    setEditOptions(item.variable?.options ?? []);
    setEditAllowFreeText(item.variable?.allowFreeText ?? true);
    setEditRequired(item.variable?.required ?? false);
  };

  const resetEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDefault("");
    setEditOptions([]);
    setEditAllowFreeText(true);
    setEditRequired(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handlePackageDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = items.findIndex((i) => i.pkg.id === activeId);
      const newIndex = items.findIndex((i) => i.pkg.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);

      const results = await Promise.all(
        reordered.map((it, i) => updateVariablePackage(it.pkg.id, { sortOrder: i }))
      );
      if (results.some((r) => !r.ok)) {
        showToast(t("toast.saveFailed"), "error");
        await reload();
      }
    },
    [items, reload, showToast, t]
  );

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const item = items.find((i) => i.pkg.id === editingId);
    if (!item) return;

    const trimmedName = editName.trim();

    const upPkg = await updateVariablePackage(editingId, { name: trimmedName });
    if (!upPkg.ok) {
      showToast(t("toast.saveFailed"), "error");
      return;
    }

    const filteredOptions = editOptions.map((s) => s.trim()).filter(Boolean);
    const optionsArray = filteredOptions.length > 0 ? filteredOptions : undefined;

    let varOk = false;
    if (item.variable) {
      const uv = await updateVariable(item.variable.id, {
        key: trimmedName,
        label: trimmedName,
        defaultValue: editDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: editAllowFreeText,
        required: editRequired,
      });
      varOk = uv.ok;
    } else {
      const cv = await createVariable({
        packageId: editingId,
        key: trimmedName,
        label: trimmedName,
        defaultValue: editDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: editAllowFreeText,
        required: editRequired,
      });
      varOk = cv.ok;
    }
    if (!varOk) {
      showToast(t("toast.saveFailed"), "error");
      return;
    }

    resetEdit();
    await reload();
  };

  return (
    <div className="manager-page">
      <div className="panel-header">
        <h2 className="panel-title">{t("variablePackage.title")}</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetEdit();
            resetCreate();
            setIsCreating(true);
          }}
        >
          + {t("variablePackage.newPackage")}
        </button>
      </div>

      {/* New variable form */}
      {isCreating && (
        <div className="package-item">
          <div className="variable-card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("variablePackage.nameLabel")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("variablePackage.placeholder.name")}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") resetCreate();
                  }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("variable.optionsLabel")}</label>
              <p className="form-hint">{t("variable.optionsHint")}</p>
              <div className="option-list">
                {newOptions.map((opt, idx) => (
                  <div key={idx} className="option-item">
                    <input
                      type="text"
                      className="form-input"
                      value={opt}
                      onChange={(e) => {
                        const next = [...newOptions];
                        next[idx] = e.target.value;
                        setNewOptions(next);
                      }}
                      placeholder={`${t("variable.optionsLabel")} ${idx + 1}`}
                    />
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => {
                        const removed = newOptions[idx];
                        const next = newOptions.filter((_, i) => i !== idx);
                        setNewOptions(next);
                        if (newDefault === removed.trim()) {
                          setNewDefault("");
                        }
                      }}
                      title={t("common.delete")}
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="option-add-btn"
                  onClick={() => setNewOptions([...newOptions, ""])}
                >
                  + {t("variable.addOption")}
                </button>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group form-group-half">
                <label className="form-label">{t("variable.defaultLabel")}</label>
                <p className="form-hint">{t("variable.defaultHintWithOptions")}</p>
                <select
                  className="form-select"
                  value={newDefault}
                  onChange={(e) => setNewDefault(e.target.value)}
                >
                  <option value="">{t("variable.noDefault")}</option>
                  {newOptions
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
              </div>
            </div>
            <label className="option-freetext-check">
              <input
                type="checkbox"
                checked={newAllowFreeText}
                onChange={(e) => setNewAllowFreeText(e.target.checked)}
              />
              {t("variable.allowFreeText")}
            </label>
            <label className="option-freetext-check">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
              />
              {t("variable.required")}
            </label>
            <div className="variable-card-actions">
              <button type="button" className="btn btn-secondary btn-xs" onClick={resetCreate}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary btn-xs" onClick={handleCreate} style={{ marginLeft: 6 }}>
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variable list */}
      <div className="item-list">
        {items.length === 0 && !isCreating && (
          <p className="empty-message">{t("variablePackage.emptyGuide")}</p>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handlePackageDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.pkg.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <SortableVariablePackageItem
                key={item.pkg.id}
                item={item}
                editingId={editingId}
                editName={editName}
                editDefault={editDefault}
                editOptions={editOptions}
                editAllowFreeText={editAllowFreeText}
                editRequired={editRequired}
                setEditName={setEditName}
                setEditDefault={setEditDefault}
                setEditOptions={setEditOptions}
                setEditAllowFreeText={setEditAllowFreeText}
                setEditRequired={setEditRequired}
                startEdit={startEdit}
                resetEdit={resetEdit}
                handleSaveEdit={handleSaveEdit}
                handleDelete={handleDelete}
                t={t}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
