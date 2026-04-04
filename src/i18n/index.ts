import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getSetting } from "../desktop";
import ja from "./ja.json";
import en from "./en.json";

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: "ja",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Load saved language from DB and apply
getSetting("language").then((r) => {
  if (r.ok && r.data && (r.data === "ja" || r.data === "en")) {
    i18n.changeLanguage(r.data);
  }
});

export default i18n;
