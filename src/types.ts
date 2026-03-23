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

export interface TemplateWithTags extends Template {
  tags: Tag[];
}

export interface TemplateTag {
  templateId: string;
  tagId: string;
}

export interface VariablePackage {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Variable {
  id: string;
  packageId: string;
  key: string;
  label: string;
  defaultValue: string | null;
  options: string[] | null;
  sortOrder: number;
  allowFreeText: boolean;
}

// --- Input types ---

export interface CreateCategoryInput {
  name: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export interface CreateTagInput {
  name: string;
}

export interface CreateTemplateInput {
  title: string;
  body: string;
  categoryId?: string;
  hotkey?: string;
  sortOrder?: number;
  tagIds?: string[];
  packageIds?: string[];
}

export interface UpdateTemplateInput {
  title?: string;
  body?: string;
  categoryId?: string;
  hotkey?: string;
  sortOrder?: number;
  tagIds?: string[];
  packageIds?: string[];
}

export interface CreateVariablePackageInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateVariablePackageInput {
  name?: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateVariableInput {
  packageId: string;
  key: string;
  label: string;
  defaultValue?: string;
  options?: string[];
  sortOrder?: number;
  allowFreeText?: boolean;
}

export interface UpdateVariableInput {
  key?: string;
  label?: string;
  defaultValue?: string;
  options?: string[];
  sortOrder?: number;
  allowFreeText?: boolean;
}

export interface VariableFormField {
  key: string;
  label: string;
  defaultValue: string | null;
  options: string[] | null;
  isBuiltin: boolean;
  allowFreeText: boolean;
  variableId: string | null;
}

export interface InterpolateRequest {
  templateId: string;
  values: Record<string, string>;
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
