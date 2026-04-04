import type {
  HealthCheckResponse,
  DbStatusResponse,
  Category,
  Tag,
  TemplateWithTags,
  VariablePackage,
  Variable,
  VariableFormField,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTagInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateVariablePackageInput,
  UpdateVariablePackageInput,
  CreateVariableInput,
  UpdateVariableInput,
  InterpolateRequest,
  Bundle,
  ExportRequest,
  ImportPreview,
  ImportRequest,
  ImportResult,
} from "./types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export type InvokeSuccess<T> = { ok: true; data: T };
export type InvokeFailure =
  | { ok: false; reason: "not_tauri" }
  | { ok: false; reason: "invoke_failed"; error: unknown };

export type InvokeResult<T> = InvokeSuccess<T> | InvokeFailure;

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  typeof window.__TAURI_INTERNALS__ !== "undefined";

const invokeCommand = async <T>(
  command: string,
  payload?: Record<string, unknown>
): Promise<InvokeResult<T>> => {
  if (!isTauriRuntime()) {
    return { ok: false, reason: "not_tauri" };
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const data = await invoke<T>(command, payload);
    return { ok: true, data };
  } catch (error) {
    console.error(`[invokeCommand] ${command} failed:`, error);
    return { ok: false, reason: "invoke_failed", error };
  }
};

export const isDesktopMode = () => isTauriRuntime();

// --- Health / Status ---

export const healthCheck = () =>
  invokeCommand<HealthCheckResponse>("health_check");

export const getDbStatus = () =>
  invokeCommand<DbStatusResponse>("get_db_status");

export const isOnboarded = () =>
  invokeCommand<boolean>("is_onboarded");

export const seedSampleData = () =>
  invokeCommand<void>("seed_sample_data");

// --- Categories ---

export const listCategories = () =>
  invokeCommand<Category[]>("list_categories");

export const createCategory = (input: CreateCategoryInput) =>
  invokeCommand<Category>("create_category", { input });

export const updateCategory = (id: string, input: UpdateCategoryInput) =>
  invokeCommand<Category>("update_category", { id, input });

export const deleteCategory = (id: string) =>
  invokeCommand<void>("delete_category", { id });

// --- Tags ---

export const listTags = () =>
  invokeCommand<Tag[]>("list_tags");

export const createTag = (input: CreateTagInput) =>
  invokeCommand<Tag>("create_tag", { input });

export const deleteTag = (id: string) =>
  invokeCommand<void>("delete_tag", { id });

export const reorderTags = (tagIds: string[]) =>
  invokeCommand<void>("reorder_tags", { tagIds });

// --- Templates ---

export const listTemplates = () =>
  invokeCommand<TemplateWithTags[]>("list_templates");

export const getTemplate = (id: string) =>
  invokeCommand<TemplateWithTags>("get_template", { id });

export const createTemplate = (input: CreateTemplateInput) =>
  invokeCommand<TemplateWithTags>("create_template", { input });

export const updateTemplate = (id: string, input: UpdateTemplateInput) =>
  invokeCommand<TemplateWithTags>("update_template", { id, input });

export const deleteTemplate = (id: string) =>
  invokeCommand<void>("delete_template", { id });

export const recordTemplateUse = (id: string) =>
  invokeCommand<void>("record_template_use", { id });

export const listTemplatesByFrequency = () =>
  invokeCommand<TemplateWithTags[]>("list_templates_by_frequency");

// --- Variable Packages ---

export const listVariablePackages = () =>
  invokeCommand<VariablePackage[]>("list_variable_packages");

export const createVariablePackage = (input: CreateVariablePackageInput) =>
  invokeCommand<VariablePackage>("create_variable_package", { input });

export const updateVariablePackage = (id: string, input: UpdateVariablePackageInput) =>
  invokeCommand<VariablePackage>("update_variable_package", { id, input });

export const deleteVariablePackage = (id: string) =>
  invokeCommand<void>("delete_variable_package", { id });

export const getTemplatePackages = (templateId: string) =>
  invokeCommand<VariablePackage[]>("get_template_packages", { templateId });

// --- Variables ---

export const listVariables = (packageId: string) =>
  invokeCommand<Variable[]>("list_variables", { packageId });

export const createVariable = (input: CreateVariableInput) =>
  invokeCommand<Variable>("create_variable", { input });

export const updateVariable = (id: string, input: UpdateVariableInput) =>
  invokeCommand<Variable>("update_variable", { id, input });

export const deleteVariable = (id: string) =>
  invokeCommand<void>("delete_variable", { id });

export const appendVariableOption = (variableId: string, value: string) =>
  invokeCommand<void>("append_variable_option", { variableId, value });

// --- Interpolation ---

export const getTemplateFormSchema = (templateId: string) =>
  invokeCommand<VariableFormField[]>("get_template_form_schema", { templateId });

export const interpolateTemplate = (request: InterpolateRequest) =>
  invokeCommand<string>("interpolate_template", { request });

// --- Export / Import ---

export const exportBundle = (request: ExportRequest) =>
  invokeCommand<Bundle>("export_bundle", { request });

export const previewImport = (bundleJson: string) =>
  invokeCommand<ImportPreview>("preview_import", { bundleJson });

export const importBundle = (request: ImportRequest) =>
  invokeCommand<ImportResult>("import_bundle", { request });

// --- Settings ---

export const getSetting = (key: string) =>
  invokeCommand<string | null>("get_setting", { key });

export const setSetting = (key: string, value: string) =>
  invokeCommand<void>("set_setting", { key, value });

export const setGlobalHotkey = (shortcut: string) =>
  invokeCommand<void>("set_global_hotkey", { shortcut });

// --- Paste ---

export const pasteTemplate = (text: string) =>
  invokeCommand<void>("paste_template", { text });
