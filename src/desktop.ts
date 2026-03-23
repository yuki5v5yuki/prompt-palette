import type {
  HealthCheckResponse,
  DbStatusResponse,
  Category,
  Tag,
  TemplateWithTags,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTagInput,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "./types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  typeof window.__TAURI_INTERNALS__ !== "undefined";

const invokeCommand = async <T>(
  command: string,
  payload?: Record<string, unknown>
): Promise<T | null> => {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command, payload);
  } catch {
    return null;
  }
};

export const isDesktopMode = () => isTauriRuntime();

// --- Health / Status ---

export const healthCheck = () =>
  invokeCommand<HealthCheckResponse>("health_check");

export const getDbStatus = () =>
  invokeCommand<DbStatusResponse>("get_db_status");

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
