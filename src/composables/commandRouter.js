import { COMMAND_MATCHERS } from "@/commands/matchers";

/**
 * Levenshtein edit distance between two strings (number of single-character
 * insertions, deletions, or substitutions needed to turn a into b).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const prevBuf = [];
const currBuf = [];

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Reusable row buffers to avoid per-call allocation in fuzzy hot path.
  if (prevBuf.length < b.length + 1) {
    prevBuf.length = b.length + 1;
    currBuf.length = b.length + 1;
  }
  const prev = prevBuf;
  const curr = currBuf;
  for (let j = 0; j <= b.length; j++) prev[j] = j;

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
    for (let j = 0; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = curr[j];
      curr[j] = tmp;
    }
  }

  return prev[b.length];
}

// Fuzzy matching is deliberately tight: short words false-positive easily
// (reset→preset, tire→time, rain→train, storm→stormy). Only keywords words of
// at least FUZZY_MIN_LENGTH characters participate, and at most
// FUZZY_MAX_DISTANCE edits are tolerated.
const FUZZY_MIN_LENGTH = 8;
const FUZZY_MAX_DISTANCE = 1;

// Keywords that are prefixes of unrelated words ("quality" contains "quali")
// require a trailing word boundary on the exact pass.
const PREFIX_KEYWORDS = new Set(["lap", "ban", "gas", "quali", "kuali"]);

// A command keyword preceded by one of these phrases is negated and its span
// stripped before matching ("do not stop engine" must not fire stopEngine).
const NEGATION_PHRASES = [
  "do not",
  "dont",
  "don't",
  "never",
  "no",
  "jangan",
  "tidak",
];
const MAX_FILLERS = 2;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPattern = (keyword) => {
  const escaped = keyword
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s+");
  const tail = PREFIX_KEYWORDS.has(keyword) ? "\\b" : "";
  return new RegExp(`\\b${escaped}${tail}`);
};

// Precompiled per-command matchers: regexes and token arrays built once at
// import time instead of per matchCommand() call.
const COMPILED_MATCHERS = COMMAND_MATCHERS.map(({ command, keywords }) => {
  const enList = keywords.en || [];
  const idList = keywords.id || [];
  const compileList = (list) =>
    list.map((kw) => ({
      raw: kw,
      re: buildPattern(kw),
      words: kw.split(/\s+/).filter(Boolean),
    }));
  const en = compileList(enList);
  const id = compileList(idList);
  const idEn = [...id, ...en];
  const all = [...en, ...id];
  return { command, en, idEn, all };
});

const compiledForLocale = (entry, locale) =>
  locale === "en" ? entry.en : entry.idEn;

const ALL_KEYWORD_WORDS = COMPILED_MATCHERS.flatMap((m) =>
  m.all.map((k) => k.words),
);

const KEYWORD_PHRASE_SET = new Set(
  COMPILED_MATCHERS.flatMap((m) => m.all.map((k) => k.raw)),
);

const NEGATION_WORDS = NEGATION_PHRASES.map((p) =>
  p.split(/\s+/).filter(Boolean),
);

function tokensMatchPhrase(tokens, start, words) {
  if (start + words.length > tokens.length) return 0;
  return words.every((word, k) => tokens[start + k] === word)
    ? words.length
    : 0;
}

function negationLengthAt(tokens, start) {
  let longest = 0;
  for (const words of NEGATION_WORDS) {
    const length = tokensMatchPhrase(tokens, start, words);
    if (length > longest) longest = length;
  }
  return longest;
}

function keywordLengthAt(tokens, start) {
  for (const words of ALL_KEYWORD_WORDS) {
    const length = tokensMatchPhrase(tokens, start, words);
    if (length) return length;
  }
  return 0;
}

/**
 * Remove negated command spans from a token list: "negation [fillers] keyword"
 * with at most MAX_FILLERS tokens between (the scan never crosses past the
 * first keyword occurrence it finds). Spans that are themselves command
 * phrases (e.g. "no rival") are kept intact. Returns a new array; the input
 * tokens are never mutated.
 */
function stripNegatedSpans(tokens) {
  const kept = [];
  let i = 0;
  while (i < tokens.length) {
    const negationLength = negationLengthAt(tokens, i);
    if (!negationLength) {
      kept.push(tokens[i]);
      i += 1;
      continue;
    }

    let spanEnd = 0;
    for (
      let probe = i + negationLength;
      probe <= i + negationLength + MAX_FILLERS;
      probe++
    ) {
      const keywordLength = keywordLengthAt(tokens, probe);
      if (keywordLength) {
        spanEnd = probe + keywordLength;
        break;
      }
    }

    const span = spanEnd ? tokens.slice(i, spanEnd).join(" ") : null;
    if (!span || KEYWORD_PHRASE_SET.has(span)) {
      // No command keyword within reach, or the span is a positive command
      // phrase (e.g. "no rival" → aiOff) — keep the tokens.
      kept.push(tokens[i]);
      i += negationLength;
      continue;
    }

    // Negated: drop the negation phrase, fillers, and keyword occurrence.
    i = spanEnd;
  }
  return kept;
}

/**
 * Fuzzy word comparison. Words shorter than FUZZY_MIN_LENGTH must match
 * exactly; longer words tolerate at most FUZZY_MAX_DISTANCE edits. Tokens are
 * whitespace-delimited whole words, so every match is word-bounded on both
 * sides by construction (no prefix drift like "quality" → "quali" can occur).
 */
function matchesFuzzily(word, token) {
  if (word.length < FUZZY_MIN_LENGTH) {
    return word === token;
  }
  return levenshtein(word, token) <= FUZZY_MAX_DISTANCE;
}

function fuzzyKeywordMatch(tokens, keywordWords) {
  const words = keywordWords;
  if (!words.length || tokens.length < words.length) return false;

  for (let start = 0; start + words.length <= tokens.length; start++) {
    if (words.every((word, k) => matchesFuzzily(word, tokens[start + k]))) {
      return true;
    }
  }
  return false;
}

export function matchCommand(transcript, locale = "en") {
  if (!transcript) return null;
  const normalized = transcript.trim().toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const strippedTokens = stripNegatedSpans(tokens);
  if (!strippedTokens.length) return null;
  const stripped = strippedTokens.join(" ");

  for (const entry of COMPILED_MATCHERS) {
    const list = compiledForLocale(entry, locale);
    for (let i = 0; i < list.length; i++) {
      if (list[i].re.test(stripped)) return entry.command;
    }
  }

  for (const entry of COMPILED_MATCHERS) {
    const list = compiledForLocale(entry, locale);
    for (let i = 0; i < list.length; i++) {
      if (fuzzyKeywordMatch(strippedTokens, list[i].words)) return entry.command;
    }
  }

  return null;
}