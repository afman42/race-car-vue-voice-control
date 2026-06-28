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
  // AI rival: difficulty/off commands before broad words. "rival off" must
  // come before the difficulty levels so it isn't shadowed.
  {
    command: "aiOff",
    keywords: {
      en: ["rival off", "ai off", "no rival", "disable rival"],
      id: ["lawan mati", "matikan lawan", "tanpa lawan"],
    },
  },
  {
    command: "aiEasy",
    keywords: {
      en: ["easy mode", "rival easy", "easy rival", "easy difficulty"],
      id: ["mode mudah", "lawan mudah", "tingkat mudah"],
    },
  },
  {
    command: "aiMedium",
    keywords: {
      en: ["medium mode", "rival medium", "medium difficulty"],
      id: ["mode sedang", "lawan sedang", "tingkat sedang"],
    },
  },
  {
    command: "aiHard",
    keywords: {
      en: ["hard mode", "rival hard", "hard difficulty"],
      id: ["mode sulit", "lawan sulit", "tingkat sulit"],
    },
  },
  {
    command: "aiRandom",
    keywords: {
      en: ["random rival", "random difficulty", "random mode", "surprise me"],
      id: ["lawan acak", "tingkat acak", "mode acak"],
    },
  },
  {
    command: "aiStatus",
    keywords: {
      en: ["rival status", "ai status", "rival", "opponent"],
      id: ["status lawan", "lawan", "status ai"],
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
  // Race position query before the generic "lap" status (so "lap" can't shadow
  // multi-word position phrases that happen to share tokens).
  {
    command: "position",
    keywords: {
      en: ["my position", "position", "standing", "where am i"],
      id: ["posisi saya", "posisi", "peringkat saya"],
    },
  },
  // Best lap / leaderboard query before the generic "lap" status.
  {
    command: "bestLap",
    keywords: {
      en: ["best lap", "fastest lap", "lap record"],
      id: ["lap tercepat", "rekor lap", "lap terbaik"],
    },
  },
  {
    command: "lapStatus",
    keywords: {
      en: ["lap status", "what lap", "current lap", "lap"],
      id: ["status lap", "lap berapa", "lap"],
    },
  },
  // Weather: specific conditions before the generic "weather" status query.
  {
    command: "weatherDry",
    keywords: {
      en: ["dry weather", "dry track", "set dry"],
      id: ["cuaca kering", "lintasan kering", "trek kering"],
    },
  },
  {
    command: "weatherCloudy",
    keywords: {
      en: ["cloudy weather", "cloudy", "overcast"],
      id: ["cuaca berawan", "berawan", "mendung"],
    },
  },
  {
    command: "weatherWet",
    keywords: {
      en: ["wet weather", "wet track", "rain", "rainy"],
      id: ["cuaca basah", "lintasan basah", "hujan"],
    },
  },
  {
    command: "weatherStorm",
    keywords: {
      en: ["storm", "stormy", "heavy rain"],
      id: ["badai", "hujan deras"],
    },
  },
  {
    command: "weatherStatus",
    keywords: {
      en: ["weather status", "weather", "conditions"],
      id: ["status cuaca", "cuaca", "kondisi"],
    },
  },
  {
    command: "damageStatus",
    keywords: {
      en: ["damage", "car damage", "condition"],
      id: ["kerusakan", "kondisi mobil"],
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
 * Levenshtein edit distance between two strings (number of single-character
 * insertions, deletions, or substitutions needed to turn a into b).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

// Short keywords must match exactly: speech-to-text rarely mangles tiny words
// and a loose threshold there would misfire (e.g. "t" matching "tire").
const FUZZY_MIN_LENGTH = 4;
// Allowed edits scale with keyword length: ~1 edit per 4 characters, capped.
const fuzzyTolerance = (len) => Math.min(2, Math.floor(len / 4));

/**
 * Decide whether a multi-word keyword approximately appears in the transcript
 * tokens. Each keyword word must closely match a transcript token (in order,
 * within a sliding window) so recognition slips like "start engin" still hit.
 * @param {string[]} tokens - normalized transcript words.
 * @param {string} keyword - a single keyword phrase.
 * @returns {boolean}
 */
function fuzzyKeywordMatch(tokens, keyword) {
  const words = keyword.split(/\s+/).filter(Boolean);
  if (!words.length || tokens.length < words.length) return false;

  for (let start = 0; start + words.length <= tokens.length; start++) {
    let allMatch = true;
    for (let k = 0; k < words.length; k++) {
      const word = words[k];
      const token = tokens[start + k];
      if (word.length < FUZZY_MIN_LENGTH) {
        // Require an exact match for very short words.
        if (word !== token) {
          allMatch = false;
          break;
        }
      } else if (levenshtein(word, token) > fuzzyTolerance(word.length)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

/**
 * Resolve a raw transcript into a known command key.
 * Keywords are checked for the given locale first, then English as a fallback.
 * Matching runs in two passes: an exact substring pass (fast, precise), then a
 * fuzzy pass that tolerates minor speech-recognition errors.
 * @param {string} transcript - speech transcript.
 * @param {string} [locale] - active locale code (defaults to "en").
 * @returns {string|null} the matching command key, or null if none matched.
 */
export function matchCommand(transcript, locale = "en") {
  if (!transcript) return null;
  const normalized = transcript.trim().toLowerCase();

  // Pass 1: exact substring match (preserves original precedence/precision).
  for (const { command, keywords } of COMMAND_MATCHERS) {
    const localeKeywords = keywords[locale] || [];
    const fallbackKeywords = locale === "en" ? [] : keywords.en || [];
    const all = [...localeKeywords, ...fallbackKeywords];
    if (all.some((keyword) => normalized.includes(keyword))) {
      return command;
    }
  }

  // Pass 2: fuzzy match against the transcript's word tokens.
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  for (const { command, keywords } of COMMAND_MATCHERS) {
    const localeKeywords = keywords[locale] || [];
    const fallbackKeywords = locale === "en" ? [] : keywords.en || [];
    const all = [...localeKeywords, ...fallbackKeywords];
    if (all.some((keyword) => fuzzyKeywordMatch(tokens, keyword))) {
      return command;
    }
  }

  return null;
}
