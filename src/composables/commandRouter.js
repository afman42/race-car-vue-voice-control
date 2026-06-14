// src/composables/commandRouter.js

// Ordered list of command matchers. Order matters: more specific multi-word
// commands must come before broad single-word ones. Each entry maps a command
// key to per-locale keyword lists that should trigger it.
export const COMMAND_MATCHERS = [
  {
    command: "help",
    keywords: {
      en: ["help", "what can i say", "commands"],
      id: ["bantuan", "tolong", "perintah apa", "daftar perintah"],
    },
  },
  {
    command: "pitStop",
    keywords: {
      en: ["pit stop", "box box", "pit now"],
      id: ["pit stop", "masuk pit", "ke pit"],
    },
  },
  {
    command: "reset",
    keywords: {
      en: ["reset", "new race", "restart"],
      id: ["atur ulang", "balapan baru", "mulai ulang", "reset"],
    },
  },
  {
    command: "startEngine",
    keywords: {
      en: ["start engine"],
      id: ["nyalakan mesin", "hidupkan mesin", "start mesin"],
    },
  },
  {
    command: "stopEngine",
    keywords: {
      en: ["stop engine", "shut down"],
      id: ["matikan mesin", "stop mesin"],
    },
  },
  // Tire compounds before the generic "tire" status query.
  {
    command: "tireSoft",
    keywords: {
      en: ["soft tire", "soft tyre", "soft compound"],
      id: ["ban lunak", "ban empuk"],
    },
  },
  {
    command: "tireMedium",
    keywords: {
      en: ["medium tire", "medium tyre", "medium compound"],
      id: ["ban sedang", "ban medium"],
    },
  },
  {
    command: "tireHard",
    keywords: {
      en: ["hard tire", "hard tyre", "hard compound"],
      id: ["ban keras"],
    },
  },
  // Fuel mix before the generic "fuel" status query.
  {
    command: "fuelMixLean",
    keywords: {
      en: ["lean mix", "lean mixture", "mix lean"],
      id: ["campuran irit", "mode irit"],
    },
  },
  {
    command: "fuelMixRich",
    keywords: {
      en: ["rich mix", "rich mixture", "mix rich"],
      id: ["campuran kaya", "mode kaya"],
    },
  },
  {
    command: "fuelMixStandard",
    keywords: {
      en: ["standard mix", "standard mixture", "mix standard", "normal mix"],
      id: ["campuran standar", "mode standar"],
    },
  },
  // ERS deployment modes.
  {
    command: "ersHotlap",
    keywords: {
      en: ["hotlap", "hot lap", "ers hot"],
      id: ["ers hotlap", "mode hotlap"],
    },
  },
  {
    command: "ersCharge",
    keywords: {
      en: ["charge mode", "ers charge", "harvest"],
      id: ["mode isi", "ers isi", "isi baterai"],
    },
  },
  {
    command: "ersBalanced",
    keywords: {
      en: ["balanced mode", "ers balanced", "balance ers"],
      id: ["mode seimbang", "ers seimbang"],
    },
  },
  {
    command: "overtake",
    keywords: {
      en: ["overtake", "over take"],
      id: ["salip", "menyalip", "nyalip"],
    },
  },
  {
    command: "deactivateDrs",
    keywords: {
      en: ["close drs", "disable drs", "drs off"],
      id: ["drs mati", "tutup drs", "matikan drs"],
    },
  },
  {
    command: "activateDrs",
    keywords: { en: ["drs"], id: ["drs"] },
  },
  {
    command: "lapStatus",
    keywords: {
      en: ["lap status", "what lap", "current lap", "lap"],
      id: ["status lap", "lap berapa", "lap"],
    },
  },
  {
    command: "tempStatus",
    keywords: {
      en: ["temperature", "engine temp", "temp status", "temp"],
      id: ["suhu", "temperatur", "status suhu"],
    },
  },
  {
    command: "tireStatus",
    keywords: { en: ["tire", "tyre"], id: ["ban", "status ban"] },
  },
  {
    command: "fuelStatus",
    keywords: {
      en: ["fuel", "tank", "gas"],
      id: ["bahan bakar", "bensin", "tangki"],
    },
  },
  {
    command: "batteryStatus",
    keywords: { en: ["battery"], id: ["baterai"] },
  },
];

/**
 * Resolve a raw transcript into a known command key.
 * Keywords are checked for the given locale first, then English as a fallback.
 * @param {string} transcript - speech transcript.
 * @param {string} [locale] - active locale code (defaults to "en").
 * @returns {string|null} the matching command key, or null if none matched.
 */
export function matchCommand(transcript, locale = "en") {
  if (!transcript) return null;
  const normalized = transcript.trim().toLowerCase();

  for (const { command, keywords } of COMMAND_MATCHERS) {
    const localeKeywords = keywords[locale] || [];
    const fallbackKeywords = locale === "en" ? [] : keywords.en || [];
    const all = [...localeKeywords, ...fallbackKeywords];
    if (all.some((keyword) => normalized.includes(keyword))) {
      return command;
    }
  }

  return null;
}
