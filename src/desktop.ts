import type { HealthCheckResponse, DbStatusResponse } from "./types";

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

export const healthCheck = () =>
  invokeCommand<HealthCheckResponse>("health_check");

export const getDbStatus = () =>
  invokeCommand<DbStatusResponse>("get_db_status");
