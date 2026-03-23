import { useState, useEffect, useCallback, useRef } from "react";
import Fuse from "fuse.js";
import type { TemplateWithTags } from "../types";
import { listTemplatesByFrequency, recordTemplateUse } from "../desktop";

const fuseOptions = {
  keys: [
    { name: "title", weight: 1.0 },
    { name: "tags.name", weight: 0.7 },
    { name: "body", weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
};

export default function Launcher() {
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<TemplateWithTags[]>([]);
  const [results, setResults] = useState<TemplateWithTags[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<Fuse<TemplateWithTags> | null>(null);

  const loadTemplates = useCallback(async () => {
    const tpls = await listTemplatesByFrequency();
    const list = tpls ?? [];
    setTemplates(list);
    setResults(list);
    fuseRef.current = new Fuse(list, fuseOptions);
  }, []);

  useEffect(() => {
    loadTemplates();
    inputRef.current?.focus();
  }, [loadTemplates]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(templates);
      setSelectedIndex(0);
      return;
    }
    if (fuseRef.current) {
      const fuseResults = fuseRef.current.search(query);
      setResults(fuseResults.map((r) => r.item));
      setSelectedIndex(0);
    }
  }, [query, templates]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const selectTemplate = useCallback(
    async (template: TemplateWithTags) => {
      // Record usage
      await recordTemplateUse(template.id);

      // Copy body to clipboard and trigger paste via Rust command
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("paste_template", { text: template.body });
      } catch {
        // Fallback: just copy to clipboard
        try {
          const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
          await writeText(template.body);
        } catch {
          // Last resort
          navigator.clipboard.writeText(template.body);
        }
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            selectTemplate(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          // Hide launcher window
          import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
            getCurrentWindow().hide();
          }).catch(() => {});
          break;
      }
    },
    [results, selectedIndex, selectTemplate]
  );

  return (
    <div className="launcher" onKeyDown={handleKeyDown}>
      <div className="launcher-search">
        <input
          ref={inputRef}
          type="text"
          className="launcher-input"
          placeholder="テンプレートを検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="launcher-results" ref={listRef}>
        {results.length === 0 && (
          <div className="launcher-empty">一致するテンプレートがありません</div>
        )}
        {results.map((tpl, index) => (
          <div
            key={tpl.id}
            className={`launcher-item ${index === selectedIndex ? "selected" : ""}`}
            onClick={() => selectTemplate(tpl)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="launcher-item-title">{tpl.title}</div>
            {tpl.tags.length > 0 && (
              <div className="launcher-item-tags">
                {tpl.tags.map((tag) => (
                  <span key={tag.id} className="launcher-tag">{tag.name}</span>
                ))}
              </div>
            )}
            <div className="launcher-item-preview">
              {tpl.body.slice(0, 100)}{tpl.body.length > 100 ? "..." : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
