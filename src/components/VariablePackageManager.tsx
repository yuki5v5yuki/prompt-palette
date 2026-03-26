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
  deleteVariable,
} from "../desktop";

export default function VariablePackageManager() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<VariablePackage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Variable editing within a package
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [varLabel, setVarLabel] = useState("");
  const [varDefault, setVarDefault] = useState("");
  const [varOptionsList, setVarOptionsList] = useState<string[]>([]);
  const [varAllowFreeText, setVarAllowFreeText] = useState(true);
  const [isCreatingVar, setIsCreatingVar] = useState(false);

  const reload = useCallback(async () => {
    const pkgs = await listVariablePackages();
    setPackages(pkgs ?? []);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadVariables = useCallback(async (packageId: string) => {
    const vars = await listVariables(packageId);
    setVariables(vars ?? []);
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setEditingId(null);
    setIsCreating(false);
  };

  const startEdit = (pkg: VariablePackage) => {
    setEditingId(pkg.id);
    setName(pkg.name);
    setDescription(pkg.description ?? "");
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await updateVariablePackage(editingId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } else {
      await createVariablePackage({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    }
    resetForm();
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await deleteVariablePackage(id);
    if (editingId === id) resetForm();
    if (expandedPackageId === id) {
      setExpandedPackageId(null);
      setVariables([]);
    }
    await reload();
  };

  const toggleExpand = async (packageId: string) => {
    if (expandedPackageId === packageId) {
      setExpandedPackageId(null);
      setVariables([]);
      resetVarForm();
    } else {
      setExpandedPackageId(packageId);
      await loadVariables(packageId);
      resetVarForm();
    }
  };

  // --- Variable CRUD within package ---
  const resetVarForm = () => {
    setVarLabel("");
    setVarDefault("");
    setVarOptionsList([]);
    setVarAllowFreeText(true);
    setEditingVarId(null);
    setIsCreatingVar(false);
  };

  const startEditVar = (v: Variable) => {
    setEditingVarId(v.id);
    setVarLabel(v.label);
    setVarDefault(v.defaultValue ?? "");
    setVarOptionsList(v.options ?? []);
    setVarAllowFreeText(v.allowFreeText);
    setIsCreatingVar(false);
  };

  const handleSaveVar = async () => {
    if (!varLabel.trim() || !expandedPackageId) return;
    const filteredOptions = varOptionsList.map((s) => s.trim()).filter(Boolean);
    const optionsArray = filteredOptions.length > 0 ? filteredOptions : undefined;
    const label = varLabel.trim();

    if (editingVarId) {
      await updateVariable(editingVarId, {
        key: label,
        label: label,
        defaultValue: varDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: varAllowFreeText,
      });
    } else {
      await createVariable({
        packageId: expandedPackageId,
        key: label,
        label: label,
        defaultValue: varDefault.trim() || undefined,
        options: optionsArray,
        allowFreeText: varAllowFreeText,
      });
    }
    resetVarForm();
    await loadVariables(expandedPackageId);
  };

  const handleDeleteVar = async (id: string) => {
    if (!expandedPackageId) return;
    await deleteVariable(id);
    await loadVariables(expandedPackageId);
  };

  return (
    <div className="manager-page">
      <div className="panel-header">
        <h2 className="panel-title">{t("variablePackage.title")}</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
        >
          + {t("variablePackage.newPackage")}
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
              placeholder={t("variablePackage.placeholder.name")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSave(); }
                if (e.key === "Escape") resetForm();
              }}
            />
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("variablePackage.placeholder.description")}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSave(); }
                if (e.key === "Escape") resetForm();
              }}
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
        {packages.length === 0 && (
          <p className="empty-message">{t("variablePackage.empty")}</p>
        )}
        {packages.map((pkg) => (
          <div key={pkg.id} className="package-item">
            <div className="item-row">
              <div className="item-info" onClick={() => toggleExpand(pkg.id)} style={{ cursor: "pointer" }}>
                <span className="package-expand-icon">{expandedPackageId === pkg.id ? "▼" : "▶"}</span>
                <span className="item-name">{pkg.name}</span>
                {pkg.description && <span className="item-description">{pkg.description}</span>}
              </div>
              <div className="item-actions">
                <button className="btn btn-ghost btn-xs" onClick={() => startEdit(pkg)}>
                  {t("common.edit")}
                </button>
                <button className="btn btn-ghost btn-xs btn-danger-text" onClick={() => handleDelete(pkg.id)}>
                  {t("common.delete")}
                </button>
              </div>
            </div>

            {expandedPackageId === pkg.id && (
              <div className="package-variables">
                <div className="package-variables-header">
                  <span className="package-variables-count">
                    {t("variablePackage.variableCount", { count: variables.length })}
                  </span>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => {
                      resetVarForm();
                      setIsCreatingVar(true);
                    }}
                  >
                    + {t("variable.addVariable")}
                  </button>
                </div>

                {isCreatingVar && (
                  <div className="variable-edit-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">{t("variable.labelLabel")}</label>
                        <p className="form-hint">{t("variable.labelHint")}</p>
                        <input
                          type="text"
                          className="form-input"
                          value={varLabel}
                          onChange={(e) => setVarLabel(e.target.value)}
                          placeholder={t("variable.placeholder.label")}
                          autoFocus
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
                          value={varDefault}
                          onChange={(e) => setVarDefault(e.target.value)}
                          placeholder={t("variable.placeholder.default")}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t("variable.optionsLabel")}</label>
                      <p className="form-hint">{t("variable.optionsHint")}</p>
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
                      <button type="button" className="btn btn-secondary btn-xs" onClick={resetVarForm}>
                        {t("common.cancel")}
                      </button>
                      <button type="button" className="btn btn-primary btn-xs" onClick={handleSaveVar} style={{ marginLeft: 6 }}>
                        {t("common.save")}
                      </button>
                    </div>
                  </div>
                )}

                {variables.map((v) => (
                  <div key={v.id} className="variable-card">
                    <div className="variable-card-header" onClick={() => editingVarId === v.id ? resetVarForm() : startEditVar(v)}>
                      <span className="variable-chip variable-chip-static">{v.label}</span>
                      {v.defaultValue && <span className="variable-card-meta">{v.defaultValue}</span>}
                      {v.options && v.options.length > 0 && <span className="variable-card-meta">{v.options.join(", ")}</span>}
                      <span className="variable-card-toggle">{editingVarId === v.id ? "▲" : "▼"}</span>
                    </div>
                    {editingVarId === v.id && (
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
                          <button type="button" className="btn btn-danger btn-xs" onClick={() => handleDeleteVar(v.id)}>
                            {t("common.delete")}
                          </button>
                          <div>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={resetVarForm}>
                              {t("common.cancel")}
                            </button>
                            <button type="button" className="btn btn-primary btn-xs" onClick={handleSaveVar} style={{ marginLeft: 6 }}>
                              {t("common.save")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {variables.length === 0 && !isCreatingVar && (
                  <p className="empty-message" style={{ fontSize: "0.85rem", padding: "8px 12px" }}>
                    {t("variablePackage.emptyGuide")}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
