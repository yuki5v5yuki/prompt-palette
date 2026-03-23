// --- Database model types (matching SQLite schema) ---

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  categoryId: string | null;
  hotkey: string | null;
  useCount: number;
  lastUsedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateTag {
  templateId: string;
  tagId: string;
}

export interface Variable {
  id: string;
  templateId: string;
  key: string;
  label: string;
  defaultValue: string | null;
  options: string[] | null;
  sortOrder: number;
}

// --- IPC response types ---

export interface HealthCheckResponse {
  status: string;
  version: string;
}

export interface DbStatusResponse {
  schemaVersion: number;
  tableCount: number;
}
