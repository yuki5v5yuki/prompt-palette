import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  listTemplates,
  listCategories,
  exportBundle,
  writeFile,
  previewImport,
  importBundle,
} from "../desktop";
import { useToast } from "./Toast";
import type {
  TemplateWithTags,
  Category,
  ImportPreview,
  ImportResult,
} from "../types";

type Tab = "export" | "import";

export default function ImportExport() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("export");

  return (
    <div className="manager-page">
      <div className="panel-header">
        <h2 className="panel-title">{t("importExport.title")}</h2>
      </div>
      <div className="ie-tabs">
        <button
          className={`ie-tab ${activeTab === "export" ? "active" : ""}`}
          onClick={() => setActiveTab("export")}
        >
          {t("importExport.export")}
        </button>
        <button
          className={`ie-tab ${activeTab === "import" ? "active" : ""}`}
          onClick={() => setActiveTab("import")}
        >
          {t("importExport.import")}
        </button>
      </div>
      {activeTab === "export" ? <ExportPanel /> : <ImportPanel />}
    </div>
  );
}

// ─── Export Panel ───

function ExportPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<TemplateWithTags[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [packName, setPackName] = useState("");
  const [packDesc, setPackDesc] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [packNameError, setPackNameError] = useState<string | null>(null);

  const load = async () => {
    const tpls = await listTemplates();
    const cats = await listCategories();
    if (!tpls.ok || !cats.ok) {
      showToast(t("toast.loadFailed"), "error");
    }
    setTemplates(tpls.ok ? (tpls.data ?? []) : []);
    setCategories(cats.ok ? (cats.data ?? []) : []);
    setLoaded(true);
  };

  if (!loaded) {
    load();
    return <div className="empty-message">{t("common.loading")}</div>;
  }

  const toggleTemplate = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map((t) => t.id)));
    }
  };

  const handleExport = async () => {
    if (!packName.trim()) {
      setPackNameError(t("importExport.packNameRequired"));
      return;
    }
    setPackNameError(null);
    setExporting(true);
    setResult(null);
    try {
      const bundle = await exportBundle({
        templateIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        packName: packName.trim(),
        packDescription: packDesc.trim() || undefined,
      });
      if (bundle.ok && bundle.data) {
        const json = JSON.stringify(bundle.data, null, 2);
        const { save } = await import("@tauri-apps/plugin-dialog");
        const filePath = await save({
          defaultPath: `${packName.trim().replace(/\s+/g, "-")}.ppb.json`,
          filters: [{ name: "Prompt Palette Bundle", extensions: ["ppb.json", "json"] }],
        });
        if (!filePath) {
          setExporting(false);
          return;
        }
        const writeResult = await writeFile(filePath, json);
        if (writeResult.ok) {
          setResult(t("importExport.exportSuccess"));
        } else {
          setResult(t("toast.saveFailed"));
        }
      } else {
        setResult(t("toast.saveFailed"));
      }
    } catch (e) {
      setResult(String(e));
    }
    setExporting(false);
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId)?.name ?? null;
  };

  return (
    <div className="ie-panel">
      <div className="form-group">
        <label className="form-label">{t("importExport.packName")}</label>
        <input
          className="form-input"
          value={packName}
          onChange={(e) => {
            setPackName(e.target.value);
            if (e.target.value.trim()) {
              setPackNameError(null);
            }
          }}
          placeholder={t("importExport.packNamePlaceholder")}
          required
          aria-invalid={!!packNameError}
        />
        {packNameError && <div className="ie-result ie-result-error">{packNameError}</div>}
      </div>
      <div className="form-group">
        <label className="form-label">{t("importExport.packDescription")}</label>
        <input
          className="form-input"
          value={packDesc}
          onChange={(e) => setPackDesc(e.target.value)}
          placeholder={t("importExport.packDescriptionPlaceholder")}
        />
      </div>

      <div className="ie-select-header">
        <label className="form-label">{t("importExport.selectTemplates")}</label>
        <button className="btn btn-xs btn-secondary" onClick={selectAll}>
          {selectedIds.size === templates.length
            ? t("importExport.deselectAll")
            : t("importExport.selectAll")}
        </button>
      </div>

      <div className="ie-template-list">
        {templates.length === 0 ? (
          <div className="empty-message">{t("template.empty")}</div>
        ) : (
          templates.map((tmpl) => (
            <label key={tmpl.id} className="ie-template-row">
              <input
                type="checkbox"
                checked={selectedIds.has(tmpl.id)}
                onChange={() => toggleTemplate(tmpl.id)}
              />
              <div className="ie-template-info">
                <span className="ie-template-title">{tmpl.title}</span>
                {getCategoryName(tmpl.categoryId) && (
                  <span className="ie-template-cat">
                    {getCategoryName(tmpl.categoryId)}
                  </span>
                )}
                {tmpl.tags.length > 0 && (
                  <span className="ie-template-tags">
                    {tmpl.tags.map((tg) => tg.name).join(", ")}
                  </span>
                )}
              </div>
            </label>
          ))
        )}
      </div>

      <div className="ie-actions">
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? t("importExport.exporting") : t("importExport.exportBtn")}
        </button>
        {selectedIds.size === 0 && (
          <span className="ie-hint">{t("importExport.exportAllHint")}</span>
        )}
      </div>

      {result && <div className="ie-result ie-result-success">{result}</div>}
    </div>
  );
}

// ─── Import Panel ───

function ImportPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bundleJson, setBundleJson] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [strategy, setStrategy] = useState<"skip" | "overwrite" | "keepBoth">("skip");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const text = await file.text();
      setBundleJson(text);
      setFileName(file.name);
      const prev = await previewImport(text);
      if (prev.ok && prev.data) {
        setPreview(prev.data);
      } else {
        setError(t("importExport.invalidBundle"));
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!bundleJson) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await importBundle({
        bundleJson,
        conflictStrategy: strategy,
      });
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        showToast(t("toast.saveFailed"), "error");
      }
    } catch (e) {
      setError(String(e));
    }
    setImporting(false);
  };

  const hasConflicts =
    preview &&
    [...preview.categories, ...preview.tags, ...preview.variablePackages, ...preview.templates].some(
      (item) => item.conflict
    );

  return (
    <div className="ie-panel">
      {/* Drop zone */}
      <div
        className="ie-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.ppb.json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {fileName ? (
          <span className="ie-dropzone-file">{fileName}</span>
        ) : (
          <>
            <span className="ie-dropzone-text">{t("importExport.dropzoneText")}</span>
            <span className="ie-hint">{t("importExport.importFormatHint")}</span>
          </>
        )}
      </div>

      {error && <div className="ie-result ie-result-error">{error}</div>}

      {/* Preview */}
      {preview && !result && (
        <div className="ie-preview">
          <h3 className="ie-preview-title">
            {preview.packName}
            {preview.packDescription && (
              <span className="ie-preview-desc"> — {preview.packDescription}</span>
            )}
          </h3>

          <PreviewSection
            label={t("importExport.previewTemplates")}
            items={preview.templates}
          />
          <PreviewSection
            label={t("importExport.previewCategories")}
            items={preview.categories}
          />
          <PreviewSection
            label={t("importExport.previewTags")}
            items={preview.tags}
          />
          <PreviewSection
            label={t("importExport.previewPackages")}
            items={preview.variablePackages}
          />

          {hasConflicts && (
            <div className="form-group">
              <label className="form-label">{t("importExport.conflictStrategy")}</label>
              <div className="ie-strategy-buttons">
                {(["skip", "overwrite", "keepBoth"] as const).map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm ${strategy === s ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setStrategy(s)}
                  >
                    {t(`importExport.strategy.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ie-actions">
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? t("importExport.importing") : t("importExport.importBtn")}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setBundleJson(null);
                setFileName(null);
                setPreview(null);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="ie-result ie-result-success">
          <p>{t("importExport.importSuccess")}</p>
          <ul className="ie-result-list">
            <li>{t("importExport.resultTemplates", { count: result.importedTemplates })}</li>
            <li>{t("importExport.resultCategories", { count: result.importedCategories })}</li>
            <li>{t("importExport.resultTags", { count: result.importedTags })}</li>
            <li>{t("importExport.resultPackages", { count: result.importedPackages })}</li>
            {result.skipped > 0 && (
              <li>{t("importExport.resultSkipped", { count: result.skipped })}</li>
            )}
          </ul>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => {
              setBundleJson(null);
              setFileName(null);
              setPreview(null);
              setResult(null);
            }}
          >
            {t("importExport.importAnother")}
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewSection({
  label,
  items,
}: {
  label: string;
  items: { name: string; conflict: boolean }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="ie-preview-section">
      <span className="ie-preview-label">
        {label} ({items.length})
      </span>
      <div className="ie-preview-items">
        {items.map((item, i) => (
          <span
            key={i}
            className={`ie-preview-item ${item.conflict ? "conflict" : ""}`}
          >
            {item.name}
            {item.conflict && <span className="ie-conflict-badge">!</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
