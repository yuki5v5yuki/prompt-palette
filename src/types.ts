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
  required: boolean;
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
  required?: boolean;
}

export interface UpdateVariableInput {
  key?: string;
  label?: string;
  defaultValue?: string;
  options?: string[];
  sortOrder?: number;
  allowFreeText?: boolean;
  required?: boolean;
}

export interface VariableFormField {
  key: string;
  label: string;
  defaultValue: string | null;
  options: string[] | null;
  isBuiltin: boolean;
  allowFreeText: boolean;
  required: boolean;
  variableId: string | null;
}

export interface InterpolateRequest {
  templateId: string;
  values: Record<string, string>;
}

// --- Export / Import types ---

export interface Bundle {
  format: string;
  version: string;
  exportedAt: string;
  pack: BundlePack;
}

export interface BundlePack {
  name: string;
  description: string | null;
  categories: BundleCategory[];
  tags: BundleTag[];
  variablePackages: BundleVariablePackage[];
  templates: BundleTemplate[];
}

export interface BundleCategory {
  name: string;
  icon: string | null;
  color: string | null;
}

export interface BundleTag {
  name: string;
}

export interface BundleVariablePackage {
  name: string;
  description: string | null;
  variables: BundleVariable[];
}

export interface BundleVariable {
  key: string;
  label: string;
  defaultValue: string | null;
  options: string[] | null;
  allowFreeText: boolean;
}

export interface BundleTemplate {
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  variablePackages: string[];
}

export interface ExportRequest {
  templateIds?: string[];
  packName: string;
  packDescription?: string;
}

export interface ImportPreview {
  packName: string;
  packDescription: string | null;
  categories: ImportPreviewItem[];
  tags: ImportPreviewItem[];
  variablePackages: ImportPreviewItem[];
  templates: ImportPreviewItem[];
}

export interface ImportPreviewItem {
  name: string;
  conflict: boolean;
}

export interface ImportRequest {
  bundleJson: string;
  conflictStrategy: "skip" | "overwrite" | "keepBoth";
}

export interface ImportResult {
  importedCategories: number;
  importedTags: number;
  importedPackages: number;
  importedTemplates: number;
  skipped: number;
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
