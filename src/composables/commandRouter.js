import { COMMAND_MATCHERS } from "@/commands/matchers";

export { COMMAND_MATCHERS };

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
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

const FUZZY_MIN_LENGTH = 4;
const fuzzyTolerance = (len) => Math.min(2, Math.floor(len / 4));

function fuzzyKeywordMatch(tokens, keyword) {
  const words = keyword.split(/\s+/).filter(Boolean);
  if (!words.length || tokens.length < words.length) return false;

  for (let start = 0; start + words.length <= tokens.length; start++) {
    let allMatch = true;
    for (let k = 0; k < words.length; k++) {
      const word = words[k];
      const token = tokens[start + k];
      if (word.length < FUZZY_MIN_LENGTH) {
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

function keywordMatches(transcript, keyword) {
  const escaped = keyword
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}`).test(transcript);
}

export function matchCommand(transcript, locale = "en") {
  if (!transcript) return null;
  const normalized = transcript.trim().toLowerCase();

  for (const { command, keywords } of COMMAND_MATCHERS) {
    const localeKeywords = keywords[locale] || [];
    const fallbackKeywords = locale === "en" ? [] : keywords.en || [];
    const all = [...localeKeywords, ...fallbackKeywords];
    if (all.some((keyword) => keywordMatches(normalized, keyword))) {
      return command;
    }
  }

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
