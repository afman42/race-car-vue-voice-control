// src/locales/locales.spec.js

import { describe, it, expect } from "vitest";
import en from "@/locales/en";
import id from "@/locales/id";
import { SUPPORTED_LOCALES } from "@/i18n";

const dictionaries = { en, id };

// Every interpolation param used anywhere in the message catalogue. Passing the
// full set to every template keeps the parity checks simple.
const SAMPLE_PARAMS = {
  best: "1:32.100",
  compound: "SOFT",
  condition: "hail",
  damage: 12,
  difficulty: "MEDIUM",
  gap: "2.0 laps ahead",
  id: "speedster",
  label: "Speedster",
  lap: 4,
  laps: "2.0",
  lapsRemaining: 2,
  level: 55,
  life: 80,
  mode: "TURBO",
  pos: "P1",
  remaining: 3,
  rpm: "6200",
  status: "optimal",
  temp: 95,
  time: "1:31.004",
  total: 10,
  transcript: "start engine",
  weather: "WET",
};

describe("locale catalogues", () => {
  it("covers every supported locale", () => {
    expect(Object.keys(dictionaries).sort()).toEqual(
      Object.keys(SUPPORTED_LOCALES).sort(),
    );
  });

  it("has identical key sets across locales", () => {
    const enKeys = Object.keys(en).sort();
    const idKeys = Object.keys(id).sort();
    expect(idKeys).toEqual(enKeys);
  });

  it("uses the same entry kind (string vs template) for every key", () => {
    const mismatched = Object.keys(en).filter(
      (key) => typeof en[key] !== typeof id[key],
    );
    expect(mismatched).toEqual([]);
  });

  it("has no empty entries", () => {
    for (const [name, dict] of Object.entries(dictionaries)) {
      const empty = Object.keys(dict).filter(
        (key) => typeof dict[key] === "string" && dict[key].trim() === "",
      );
      expect(empty, `${name} has empty entries`).toEqual([]);
    }
  });
});

describe.each(Object.entries(dictionaries))("%s templates", (name, dict) => {
  const templateKeys = Object.keys(dict).filter(
    (key) => typeof dict[key] === "function",
  );

  it("has template entries to exercise", () => {
    expect(templateKeys.length).toBeGreaterThan(0);
  });

  it.each(templateKeys)("%s renders a filled string", (key) => {
    const text = dict[key](SAMPLE_PARAMS);
    expect(typeof text).toBe("string");
    expect(text.trim()).not.toBe("");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("[object Object]");
  });

  it.each(templateKeys)("%s tolerates missing params", (key) => {
    // t() calls templates with {} when no params are supplied; a template must
    // never throw, even though the output may contain placeholders.
    expect(() => dict[key]({})).not.toThrow();
  });
});

describe("locale template interpolation", () => {
  it("interpolates the lap counter in both locales", () => {
    expect(en["ui.lap"]({ lap: 3, total: 10 })).toContain("3");
    expect(en["ui.lap"]({ lap: 3, total: 10 })).toContain("10");
    expect(id["ui.lap"]({ lap: 3, total: 10 })).toContain("3");
  });

  it("defaults the weather forecast window to 2 laps", () => {
    expect(en["msg.weatherChangeAnnounce"]({ weather: "WET" })).toContain(
      "2 laps",
    );
  });

  it("quotes the unrecognised transcript back to the driver", () => {
    expect(en["msg.notRecognized"]({ transcript: "warp speed" })).toContain(
      '"warp speed"',
    );
  });
});
