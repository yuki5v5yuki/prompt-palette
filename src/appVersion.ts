import { getVersion } from "@tauri-apps/api/app";
import { isDesktopMode } from "./desktop";

declare const __APP_VERSION__: string;

const formatVersion = (version: string) =>
  version.startsWith("v") ? version : `v${version}`;

export const fallbackAppVersion = formatVersion(__APP_VERSION__);

export const getDisplayAppVersion = async () => {
  if (!isDesktopMode()) {
    return fallbackAppVersion;
  }

  try {
    return formatVersion(await getVersion());
  } catch (error) {
    console.error("[getDisplayAppVersion] failed:", error);
    return fallbackAppVersion;
  }
};
