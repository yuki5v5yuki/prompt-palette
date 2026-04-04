import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, ChevronUp, CheckCircle, Plus, Info, X } from "lucide-react";
import type { TemplateWithTags, Category, Tag, Variable, VariablePackage, CreateTemplateInput, UpdateTemplateInput } from "../types";
import { listVariablePackages, listVariables } from "../desktop";

interface TemplateEditorProps {
  template?: TemplateWithTags;
  categories: Category[];
  tags: Tag[];
  onSave: (data: CreateTemplateInput | UpdateTemplateInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCancel: () => void;
}

const BUILTIN_VARS = [
  { key: "@clipboard", tooltipKey: "variable.builtinClipboard" },
  { key: "@today", tooltipKey: "variable.builtinToday" },
  { key: "@now", tooltipKey: "variable.builtinNow" },
];

// --- Contenteditable utilities ---
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bodyToHtml(body: string, resolveLabel: (key: string) => string): string {
  if (!body) return "";
  const parts = body.split(/(\{\{[^}]+\}\})/g);
  return parts
    .map((part) => {
      const m = part.match(/^\{\{([^}]+)\}\}$/);
      if (m) {
        const key = m[1];
        const label = resolveLabel(key);
        return `<span class="ce-chip" contenteditable="false" data-var-key="${escapeHtml(key)}">${escapeHtml(label)}</span>`;
      }
      return escapeHtml(part).replace(/\n/g, "<br>");
    })
    .join("");
}

function htmlToBody(container: HTMLElement): string {
  let result = "";
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("ce-chip")) {
        const key = el.dataset.varKey ?? "";
        result += `{{${key}}}`;
      } else if (el.tagName === "BR") {
        result += "\n";
      } else {
        // <div>, <p> etc from Enter key
        const inner = htmlToBody(el);
        if (inner) result += "\n" + inner;
      }
    }
  }
  return result;
}

export default function TemplateEditor({
  template,
  categories,
  tags,
  onSave,
  onDelete,
  onDuplicate,
  onCancel,
}: TemplateEditorProps) {
  const { t } = useTranslation();
  const isEditing = !!template;
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalEdit = useRef(false);

  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(template?.tags.map((t) => t.id) ?? [])
  );

  // Variable packages
  const [allPackages, setAllPackages] = useState<VariablePackage[]>([]);
  const [allVariables, setAllVariables] = useState<Variable[]>([]);
  const [showAllVars, setShowAllVars] = useState(false);
  const [varSearch, setVarSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState("");

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  // Extract {{variable}} tokens from body for hint display
  const bodyTokens = (body.match(/\{\{([^}]+)\}\}/g) || [])
    .map((m) => m.slice(2, -2))
    .filter((v, i, a) => a.indexOf(v) === i);

  // Load all packages
  useEffect(() => {
    (async () => {
      const pkgs = await listVariablePackages();
      setAllPackages(pkgs.ok ? (pkgs.data ?? []) : []);
    })();
  }, []);

  // Load all variables from all packages
  useEffect(() => {
    (async () => {
      const vars: Variable[] = [];
      for (const pkg of allPackages) {
        const pkgVars = await listVariables(pkg.id);
        if (pkgVars.ok && pkgVars.data) vars.push(...pkgVars.data);
      }
      setAllVariables(vars);
    })();
  }, [allPackages]);

  // Auto-show preview when variables exist
  useEffect(() => {
    if (bodyTokens.length > 0) {
      setShowPreview(true);
    }
  }, [bodyTokens.length]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    // Auto-detect packages from {{key}} tokens in body
    const usedPackageIds = new Set<string>();
    for (const token of bodyTokens) {
      const matchingVar = allVariables.find((v) => v.key === token);
      if (matchingVar) {
        usedPackageIds.add(matchingVar.packageId);
      }
    }

    const data: CreateTemplateInput | UpdateTemplateInput = {
      title: title.trim(),
      body: body.trim(),
      categoryId: categoryId || undefined,
      tagIds: Array.from(selectedTagIds),
      packageIds: Array.from(usedPackageIds),
    };
    onSave(data);
  };

  // --- Resolve variable key to display label ---
  const resolveLabel = useCallback(
    (key: string): string => {
      const v = allVariables.find((v) => v.key === key);
      if (v) return v.label;
      return key; // builtins & unknown: show key as-is
    },
    [allVariables]
  );

  // --- Sync contenteditable <-> body state ---
  const [isComposing, setIsComposing] = useState(false);

  // Render body -> HTML on mount & when body changes externally
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (isInternalEdit.current) {
      isInternalEdit.current = false;
      return;
    }
    editor.innerHTML = bodyToHtml(body, resolveLabel) || "<br>";
  }, [body, resolveLabel]);

  const syncBodyFromDom = () => {
    const editor = editorRef.current;
    if (!editor) return;
    isInternalEdit.current = true;
    setBody(htmlToBody(editor));
  };

  const handleInput = () => {
    if (isComposing) {
      // Only sync body text, don't detect tokens during IME
      syncBodyFromDom();
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;
    const newBody = htmlToBody(editor);

    // Detect if a new {{token}} was typed manually
    const oldTokens = new Set(body.match(/\{\{[^}]+\}\}/g) ?? []);
    const newTokens = new Set(newBody.match(/\{\{[^}]+\}\}/g) ?? []);
    const hasNewToken = [...newTokens].some((t) => !oldTokens.has(t));

    isInternalEdit.current = true;
    setBody(newBody);

    if (hasNewToken) {
      // Re-render DOM to chip-ify new tokens, preserving caret
      requestAnimationFrame(() => {
        const offset = getCaretOffset(editor);
        editor.innerHTML = bodyToHtml(newBody, resolveLabel) || "<br>";
        restoreCaretOffset(editor, offset, newBody);
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      return;
    }

    // Ensure atomic chip deletion
    if (e.key === "Backspace" || e.key === "Delete") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return;
      const node = range.startContainer;
      const offset = range.startOffset;

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const target =
          e.key === "Backspace"
            ? el.childNodes[offset - 1]
            : el.childNodes[offset];
        if (
          target instanceof HTMLElement &&
          target.classList.contains("ce-chip")
        ) {
          e.preventDefault();
          target.remove();
          syncBodyFromDom();
          return;
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // --- Click-to-Insert ---
  const [insertedChipKey, setInsertedChipKey] = useState<string | null>(null);
  const insertVariable = (key: string, _source?: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const range = sel!.getRangeAt(0);
    const chip = document.createElement("span");
    chip.className = "ce-chip";
    chip.contentEditable = "false";
    chip.dataset.varKey = key;
    chip.textContent = resolveLabel(key);

    range.deleteContents();
    range.insertNode(chip);

    // Move cursor after chip
    range.setStartAfter(chip);
    range.setEndAfter(chip);
    sel!.removeAllRanges();
    sel!.addRange(range);

    syncBodyFromDom();

    // Pulse feedback
    setInsertedChipKey(key);
    setTimeout(() => setInsertedChipKey(null), 400);
  };

  // --- Highlight chips in editor on hover ---
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll(".ce-chip").forEach((chip) => {
      const el = chip as HTMLElement;
      if (highlightKey && el.dataset.varKey === highlightKey) {
        el.classList.add("ce-chip-highlight");
      } else {
        el.classList.remove("ce-chip-highlight");
      }
    });
  }, [highlightKey, body]);

  // --- Remove all occurrences of a variable from body ---
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);
  const removeVariable = (key: string) => {
    const token = `{{${key}}}`;
    setBody(body.split(token).join(""));
    setConfirmRemoveKey(null);
  };

  // --- Count variable occurrences in body ---
  const countVariable = (key: string): number => {
    const token = `{{${key}}}`;
    let count = 0;
    let pos = 0;
    while ((pos = body.indexOf(token, pos)) !== -1) {
      count++;
      pos += token.length;
    }
    return count;
  };

  // --- Preview renderer ---
  const renderPreview = () => {
    const parts = body.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{[^}]+\}\}$/.test(part)) {
        return (
          <span key={i} className="preview-variable">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <form className="template-editor" onSubmit={handleSubmit}>
      <div className="editor-header">
        <h3>{isEditing ? t("common.edit") : t("template.newTemplate")}</h3>
        <div className="editor-actions">
          {isEditing && onDuplicate && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onDuplicate}>
              {t("template.duplicate")}
            </button>
          )}
          {isEditing && onDelete && (
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
              {t("common.delete")}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t("template.titleLabel")}</label>
        <input
          type="text"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("template.placeholder.title")}
          autoFocus
        />
      </div>

      <div className="form-row">
        <div className="form-group form-group-half">
          <label className="form-label">{t("template.categoryLabel")}</label>
          <select
            className="form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("template.noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="form-group">
          <label className="form-label">{t("template.tagsLabel")}</label>
          <input
              type="text"
              className="form-input tag-search-input"
              placeholder={t("template.tagSearch")}
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          <div className="tag-selector">
            {tags
              .filter((tag) => {
                if (!tagFilter) return true;
                return tag.name.toLowerCase().includes(tagFilter.toLowerCase()) || selectedTagIds.has(tag.id);
              })
              .sort((a, b) => {
                const aSelected = selectedTagIds.has(a.id) ? 0 : 1;
                const bSelected = selectedTagIds.has(b.id) ? 0 : 1;
                return aSelected - bSelected;
              })
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-toggle ${selectedTagIds.has(tag.id) ? "active" : ""}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Body Editing Area - palette + textarea + preview */}
      <div className="form-group">
        <label className="form-label">{t("template.bodyLabel")}</label>

        <div className="body-editing-area">
          {/* Variable Palette */}
          <div className="variable-palette">
            {/* Used variables — always visible */}
            {(() => {
              const usedVars = allVariables.filter((v) => bodyTokens.includes(v.key));
              const usedBuiltins = BUILTIN_VARS.filter((bv) => bodyTokens.includes(bv.key));
              if (usedVars.length > 0 || usedBuiltins.length > 0) {
                return (
                  <div className="variable-palette-used-section">
                    <span className="variable-palette-section-label">
                      <CheckCircle size={11} /> {t("variable.usedVariables")}
                    </span>
                    <div className="variable-palette-row">
                      {usedVars.map((v) => (
                        <span key={v.id} className="variable-chip-used-wrapper">
                          <button
                            type="button"
                            className={`variable-chip variable-chip-used ${insertedChipKey === v.key ? "variable-chip-inserted" : ""}`}
                            onClick={(e) => insertVariable(v.key, e.currentTarget)}
                            onMouseEnter={() => setHighlightKey(v.key)}
                            onMouseLeave={() => setHighlightKey(null)}
                            title={t("variable.insertHint")}
                          >
                            {v.label}
                            <span className="variable-chip-count">{t("variable.timesUsed", { count: countVariable(v.key) })}</span>
                          </button>
                          {confirmRemoveKey === v.key ? (
                            <span className="variable-chip-confirm">
                              <button type="button" className="variable-chip-confirm-yes" onClick={() => removeVariable(v.key)}>{t("common.delete")}</button>
                              <button type="button" className="variable-chip-confirm-no" onClick={() => setConfirmRemoveKey(null)}>{t("common.cancel")}</button>
                            </span>
                          ) : (
                            <button type="button" className="variable-chip-remove" onClick={() => setConfirmRemoveKey(v.key)} title={t("variable.removeAll")}>
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      ))}
                      {usedBuiltins.map((bv) => (
                        <span key={bv.key} className="variable-chip-used-wrapper">
                          <button
                            type="button"
                            className={`variable-chip variable-chip-used ${insertedChipKey === bv.key ? "variable-chip-inserted" : ""}`}
                            onClick={(e) => insertVariable(bv.key, e.currentTarget)}
                            onMouseEnter={() => setHighlightKey(bv.key)}
                            onMouseLeave={() => setHighlightKey(null)}
                            title={t("variable.insertHint")}
                          >
                            {bv.key}
                            <span className="variable-chip-count">{t("variable.timesUsed", { count: countVariable(bv.key) })}</span>
                          </button>
                          {confirmRemoveKey === bv.key ? (
                            <span className="variable-chip-confirm">
                              <button type="button" className="variable-chip-confirm-yes" onClick={() => removeVariable(bv.key)}>{t("common.delete")}</button>
                              <button type="button" className="variable-chip-confirm-no" onClick={() => setConfirmRemoveKey(null)}>{t("common.cancel")}</button>
                            </span>
                          ) : (
                            <button type="button" className="variable-chip-remove" onClick={() => setConfirmRemoveKey(bv.key)} title={t("variable.removeAll")}>
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Toggle to show insert palette */}
            <button
              type="button"
              className="variable-palette-toggle"
              onClick={() => setShowAllVars(!showAllVars)}
            >
              <Plus size={14} />
              {t("variable.insertVariable")}
              {showAllVars ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {/* Expandable: insert palette */}
            {showAllVars && (
              <div className="variable-palette-expanded">
                <div className="variable-palette-hint-banner">
                  <Info size={12} />
                  {t("variable.insertHintBanner")}
                </div>

                <input
                  type="text"
                  className="variable-search"
                  value={varSearch}
                  onChange={(e) => setVarSearch(e.target.value)}
                  placeholder={t("variable.searchPlaceholder")}
                />

                <div className="variable-palette-scroll">
                  {/* Group by package */}
                  {(() => {
                    const filtered = allVariables.filter(
                      (v) => !varSearch || v.label.toLowerCase().includes(varSearch.toLowerCase()) || v.key.toLowerCase().includes(varSearch.toLowerCase())
                    );
                    const showGroups = allPackages.length > 1;

                    if (showGroups) {
                      return allPackages
                        .map((pkg) => {
                          const pkgVars = filtered.filter((v) => v.packageId === pkg.id);
                          if (pkgVars.length === 0) return null;
                          const isCollapsed = collapsedGroups.has(pkg.id);
                          return (
                            <div key={pkg.id} className="variable-group">
                              <button
                                type="button"
                                className="variable-group-toggle"
                                onClick={() => {
                                  setCollapsedGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(pkg.id)) next.delete(pkg.id);
                                    else next.add(pkg.id);
                                    return next;
                                  });
                                }}
                              >
                                {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                                {pkg.name}
                                <span className="variable-group-count">({pkgVars.length})</span>
                              </button>
                              {!isCollapsed && (
                                <div className="variable-palette-row">
                                  {pkgVars.map((v) => {
                                    const isUsed = bodyTokens.includes(v.key);
                                    return (
                                      <button
                                        key={v.id}
                                        type="button"
                                        className={`variable-chip variable-chip-insert ${isUsed ? "variable-chip-in-body" : ""} ${insertedChipKey === v.key ? "variable-chip-inserted" : ""}`}
                                        onClick={(e) => insertVariable(v.key, e.currentTarget)}
                                        title={t("variable.insertHint")}
                                      >
                                        {isUsed ? "✓" : "+"} {v.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                        .filter(Boolean);
                    }

                    // Single package or no packages — flat list
                    return (
                      <div className="variable-palette-row">
                        {filtered.map((v) => {
                          const isUsed = bodyTokens.includes(v.key);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className={`variable-chip variable-chip-insert ${isUsed ? "variable-chip-in-body" : ""} ${insertedChipKey === v.key ? "variable-chip-inserted" : ""}`}
                              onClick={(e) => insertVariable(v.key, e.currentTarget)}
                              title={t("variable.insertHint")}
                            >
                              {isUsed ? "✓" : "+"} {v.label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Built-in variables group */}
                  {(() => {
                    const filteredBuiltins = BUILTIN_VARS.filter(
                      (bv) => !varSearch || bv.key.toLowerCase().includes(varSearch.toLowerCase())
                    );
                    if (filteredBuiltins.length === 0) return null;
                    const isCollapsed = collapsedGroups.has("__builtin__");
                    return (
                      <div className="variable-group">
                        <button
                          type="button"
                          className="variable-group-toggle"
                          onClick={() => {
                            setCollapsedGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has("__builtin__")) next.delete("__builtin__");
                              else next.add("__builtin__");
                              return next;
                            });
                          }}
                        >
                          {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                          {t("variable.builtinGroup")}
                          <span className="variable-group-count">({filteredBuiltins.length})</span>
                        </button>
                        {!isCollapsed && (
                          <div className="variable-palette-row">
                            {filteredBuiltins.map((bv) => {
                              const isUsed = bodyTokens.includes(bv.key);
                              return (
                                <button
                                  key={bv.key}
                                  type="button"
                                  className={`variable-chip variable-chip-builtin variable-chip-insert ${isUsed ? "variable-chip-in-body" : ""} ${insertedChipKey === bv.key ? "variable-chip-inserted" : ""}`}
                                  onClick={(e) => insertVariable(bv.key, e.currentTarget)}
                                  title={t(bv.tooltipKey)}
                                >
                                  {isUsed ? "✓" : "+"} {bv.key}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Contenteditable body editor */}
          <div
            ref={editorRef}
            className="ce-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => {
              setIsComposing(false);
              handleInput();
            }}
            data-placeholder={t("template.placeholder.body")}
          />

          {/* Preview */}
          {bodyTokens.length > 0 && (
            <div className="body-preview-section">
              <button
                type="button"
                className="preview-toggle"
                onClick={() => setShowPreview(!showPreview)}
              >
                {t("variable.preview")} {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showPreview && (
                <div className="body-preview">
                  {renderPreview()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isEditing && template && (
        <div className="editor-meta">
          <span>{t("template.useCount")}: {template.useCount}</span>
          {template.lastUsedAt && (
            <span>{t("template.lastUsed")}: {new Date(template.lastUsedAt).toLocaleString()}</span>
          )}
        </div>
      )}
    </form>
  );
}

// --- Caret offset helpers for contenteditable re-render ---
function getCaretOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);

  // Walk the pre-range to count body-string offset
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!preRange.intersectsNode(node)) continue;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (node === range.startContainer) {
        offset += range.startOffset;
        break;
      }
      offset += text.length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("ce-chip")) {
        const key = el.dataset.varKey ?? "";
        offset += `{{${key}}}`.length;
        walker.nextNode(); // skip children
      } else if (el.tagName === "BR") {
        offset += 1; // \n
      }
    }
  }
  return offset;
}

function restoreCaretOffset(
  container: HTMLElement,
  targetOffset: number,
  _body: string
): void {
  let remaining = targetOffset;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (remaining <= len) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
      remaining -= len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("ce-chip")) {
        const key = el.dataset.varKey ?? "";
        const tokenLen = `{{${key}}}`.length;
        if (remaining <= tokenLen) {
          // Place cursor after chip
          const sel = window.getSelection();
          const range = document.createRange();
          range.setStartAfter(el);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          return;
        }
        remaining -= tokenLen;
        // Skip chip's children
        while (walker.nextNode()) {
          if (walker.currentNode === el || !el.contains(walker.currentNode))
            break;
        }
      } else if (el.tagName === "BR") {
        if (remaining <= 1) {
          const sel = window.getSelection();
          const range = document.createRange();
          range.setStartAfter(el);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          return;
        }
        remaining -= 1;
      }
    }
  }

  // Fallback: place at end
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}
