import { ref, computed } from "vue";
import en from "@/locales/en";
import id from "@/locales/id";

export const SUPPORTED_LOCALES = {
  en: { label: "English", speechLang: "en-US" },
  id: { label: "Bahasa Indonesia", speechLang: "id-ID" },
};

const STORAGE_KEY = "race-control-locale";

const messages = { en, id };

const detectInitialLocale = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES[saved]) return saved;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const short = navigator.language.slice(0, 2).toLowerCase();
    if (SUPPORTED_LOCALES[short]) return short;
  }
  return "en";
};

const locale = ref(detectInitialLocale());
if (typeof document !== "undefined") {
  document.documentElement.lang = locale.value;
}

export function t(key, params) {
  const dict = messages[locale.value] || messages.en;
  const entry = dict[key] ?? messages.en[key];
  if (entry === undefined) return key;
  const text =
    typeof entry === "function" ? entry(params || {}) : entry;
  // Fast path: most strings have no missing params.
  if (typeof text !== "string") return String(text);
  if (text.indexOf("undefined") === -1) return text;
  // Scrub missing interpolation params before they reach the UI.
  return text.replaceAll("undefined", "—");
}

export function setLocale(next) {
  if (!SUPPORTED_LOCALES[next]) return;
  locale.value = next;
  // WCAG 3.1.2: keep the document language in sync with the UI locale.
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
}

export function useI18n() {
  return {
    locale,
    speechLang: computed(
      () => SUPPORTED_LOCALES[locale.value]?.speechLang || "en-US",
    ),
    t,
    setLocale,
    SUPPORTED_LOCALES,
  };
}
