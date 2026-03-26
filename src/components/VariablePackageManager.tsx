import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
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

/** Extended package info with its single auto-created variable */
interface PackageWithVar {
  pkg: VariablePackage;
  variable: Variable | null;
}

export default function VariablePackageManager() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PackageWithVar[]>([]);

  // Creating new variable
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // Editing existing variable (inline settings)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDefault, setEditDefault] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editAllowFreeText, setEditAllowFreeText] = useState(true);

  const reload = useCallback(async () => {
    const pkgs = await listVariablePackages();
    const list = pkgs ?? [];
    // Load the first variable for each package (1:1 relationship)
    const withVars: PackageWithVar[] = await Promise.all(
      list.map(async (pkg) => {
        const vars = await listVariables(pkg.id);
        return { pkg, variable: vars && vars.length > 0 ? vars[0] : null };
      })
    );
    setItems(withVars);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // --- Create new variable (package + auto-variable) ---
  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // Create package
    const pkg = await createVariablePackage({ name: trimmed });
    if (pkg) {
      // Auto-create variable with same name
      await createVariable({
        packageId: pkg.id,
        key: trimmed,
        label: trimmed,
      });
    }
    setNewName("");
    setIsCreating(false);
    await reload();
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await deleteVariablePackage(id);
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
  };

  const resetEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDefault("");
    setEditOptions([]);
    setEditAllowFreeText(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const item = items.find((i) => i.pkg.id === editingId);
    if (!item) return;

    const trimmedName = editName.trim();

    // Update package name
    await updateVariablePackage(editingId, { name: trimmedName });

    // Update variable (sync key/label + settings)
    const filteredOptions = editOptions.map((s) => s.trim()).filter(Boolean);
    const optionsArray = filteredOptions.length > 0 ? filteredOptions : undefined;

    if (item.variable) {
      await updateVariable(item.variable.id, {
        key: trimmedName,
        label: trimmedName,
        defaultValue: editDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: editAllowFreeText,
      });
    } else {
      // Variable doesn't exist yet (legacy data) — create it
      await createVariable({
        packageId: editingId,
        key: trimmedName,
        label: trimmedName,
        defaultValue: editDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: editAllowFreeText,
      });
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
            setIsCreating(true);
            setNewName("");
          }}
        >
          + {t("variablePackage.newPackage")}
        </button>
      </div>

      {/* New variable form */}
      {isCreating && (
        <div className="inline-form">
          <div className="form-row">
            <input
              type="text"
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("variablePackage.placeholder.name")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
                if (e.key === "Escape") setIsCreating(false);
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>
              {t("common.save")}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsCreating(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Variable list */}
      <div className="item-list">
        {items.length === 0 && !isCreating && (
          <p className="empty-message">{t("variablePackage.emptyGuide")}</p>
        )}
        {items.map((item) => (
          <div key={item.pkg.id} className="package-item">
            {/* Header row */}
            <div className="item-row">
              <div
                className="item-info"
                onClick={() => editingId === item.pkg.id ? resetEdit() : startEdit(item)}
                style={{ cursor: "pointer" }}
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
                <span className="variable-card-toggle">{editingId === item.pkg.id ? "▲" : "▼"}</span>
              </div>
              <div className="item-actions">
                <button className="btn btn-ghost btn-xs btn-danger-text" onClick={() => handleDelete(item.pkg.id)}>
                  {t("common.delete")}
                </button>
              </div>
            </div>

            {/* Inline edit form */}
            {editingId === item.pkg.id && (
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
                <div className="form-row">
                  <div className="form-group form-group-half">
                    <label className="form-label">{t("variable.defaultLabel")}</label>
                    <p className="form-hint">{t("variable.defaultHint")}</p>
                    <input
                      type="text"
                      className="form-input"
                      value={editDefault}
                      onChange={(e) => setEditDefault(e.target.value)}
                      placeholder={t("variable.placeholder.default")}
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
                          onClick={() => setEditOptions(editOptions.filter((_, i) => i !== idx))}
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
                <label className="option-freetext-check">
                  <input
                    type="checkbox"
                    checked={editAllowFreeText}
                    onChange={(e) => setEditAllowFreeText(e.target.checked)}
                  />
                  {t("variable.allowFreeText")}
                </label>
                <div className="variable-card-actions">
                  <button type="button" className="btn btn-secondary btn-xs" onClick={resetEdit}>
                    {t("common.cancel")}
                  </button>
                  <button type="button" className="btn btn-primary btn-xs" onClick={handleSaveEdit} style={{ marginLeft: 6 }}>
                    {t("common.save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
