// src/i18n.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// i18n keeps the active locale in module state and detects it once at import,
// so every test re-imports the module after arranging storage/navigator.

const STORAGE_KEY = "race-control-locale";

const loadI18n = async () => {
  vi.resetModules();
  return vi.importActual("@/i18n");
};

const stubNavigatorLanguage = (language) => {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(language);
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("initial locale detection", () => {
  it("uses a saved locale from localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, "id");

    const { useI18n } = await loadI18n();
    expect(useI18n().locale.value).toBe("id");
  });

  it("ignores an unsupported saved locale", async () => {
    window.localStorage.setItem(STORAGE_KEY, "kl");
    stubNavigatorLanguage("fr-FR");

    const { useI18n } = await loadI18n();
    expect(useI18n().locale.value).toBe("en");
  });

  it("falls back to the navigator language", async () => {
    stubNavigatorLanguage("id-ID");

    const { useI18n } = await loadI18n();
    expect(useI18n().locale.value).toBe("id");
  });

  it("matches the navigator language case-insensitively", async () => {
    stubNavigatorLanguage("ID");

    const { useI18n } = await loadI18n();
    expect(useI18n().locale.value).toBe("id");
  });

  it("defaults to en for an unsupported navigator language", async () => {
    stubNavigatorLanguage("de-DE");

    const { useI18n } = await loadI18n();
    expect(useI18n().locale.value).toBe("en");
  });

  it("defaults to en when navigator.language is absent", async () => {
    stubNavigatorLanguage("");

    const { useI18n } = await loadI18n();
    expect(useI18n().locale.value).toBe("en");
  });

  it("sets the document language on import (WCAG 3.1.2)", async () => {
    window.localStorage.setItem(STORAGE_KEY, "id");

    await loadI18n();
    expect(document.documentElement.lang).toBe("id");
  });
});

describe("t()", () => {
  it("returns a plain string entry", async () => {
    const { t } = await loadI18n();
    expect(t("ui.title")).toBe("Race Car Voice Control");
  });

  it("interpolates params into a template entry", async () => {
    const { t } = await loadI18n();
    expect(t("ui.lap", { lap: 3, total: 10 })).toBe("Lap 3 / 10");
  });

  it("calls a template with an empty object when params are omitted", async () => {
    const { t } = await loadI18n();
    // Missing params are scrubbed to an em dash rather than leaking "undefined".
    expect(t("msg.bestLap")).toBe("Best lap is —.");
  });

  it("returns the key itself for an unknown key", async () => {
    const { t } = await loadI18n();
    expect(t("nope.missing")).toBe("nope.missing");
  });

  it("resolves in the active locale after a switch", async () => {
    const { t, setLocale } = await loadI18n();
    setLocale("id");
    expect(t("ui.title")).toBe("Kendali Suara Mobil Balap");
  });

  it("scrubs undefined interpolations out of the UI", async () => {
    const { t } = await loadI18n();
    expect(t("msg.tireStatus", { compound: "SOFT" })).not.toContain(
      "undefined",
    );
  });
});

describe("setLocale()", () => {
  it("switches the active locale", async () => {
    const { setLocale, useI18n } = await loadI18n();
    setLocale("id");
    expect(useI18n().locale.value).toBe("id");
  });

  it("persists the choice to localStorage", async () => {
    const { setLocale } = await loadI18n();
    setLocale("id");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("id");
  });

  it("keeps the document language in sync", async () => {
    const { setLocale } = await loadI18n();
    setLocale("id");
    expect(document.documentElement.lang).toBe("id");
  });

  it("ignores an unsupported locale entirely", async () => {
    const { setLocale, useI18n } = await loadI18n();
    setLocale("kl");
    expect(useI18n().locale.value).toBe("en");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignores an undefined locale", async () => {
    const { setLocale, useI18n } = await loadI18n();
    setLocale(undefined);
    expect(useI18n().locale.value).toBe("en");
  });
});

describe("useI18n()", () => {
  it("exposes the supported locale table", async () => {
    const { useI18n, SUPPORTED_LOCALES } = await loadI18n();
    expect(useI18n().SUPPORTED_LOCALES).toBe(SUPPORTED_LOCALES);
    expect(Object.keys(SUPPORTED_LOCALES)).toEqual(["en", "id"]);
  });

  it("derives the speech language from the active locale", async () => {
    const { useI18n } = await loadI18n();
    const { speechLang, setLocale } = useI18n();

    expect(speechLang.value).toBe("en-US");
    setLocale("id");
    expect(speechLang.value).toBe("id-ID");
  });

  it("shares one reactive locale across calls", async () => {
    const { useI18n } = await loadI18n();
    const first = useI18n();
    const second = useI18n();

    first.setLocale("id");
    expect(second.locale.value).toBe("id");
  });
});
