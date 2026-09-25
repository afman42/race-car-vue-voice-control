// src/utils/numeric.js
//
// Shared numeric helpers: clamped rounding and top-N sorted insertion.
// Extracted from the per-tick sim writes and leaderboard boards.

/**
 * Clamp a value to [min, max] and round to `dec` decimals.
 * @param {number} v - input value.
 * @param {object} [opts] - { min, max, dec }.
 * @returns {number} clamped, rounded value.
 */
export function clampRound(v, { min = 0, max = 100, dec = 2 } = {}) {
  const clamped = Math.min(max, Math.max(min, v));
  const factor = 10 ** dec;
  return Math.round(clamped * factor) / factor;
}

/**
 * Round a temperature-style value to 1 decimal with optional bounds.
 * @param {number} v - input value.
 * @param {number} [floor=-Infinity] - minimum allowed value.
 * @param {number} [ceil=Infinity] - maximum allowed value.
 * @returns {number} rounded value.
 */
export function roundTemp(v, floor = -Infinity, ceil = Infinity) {
  const next = Math.min(ceil, Math.max(floor, v));
  return Math.round(next * 10) / 10;
}

/**
 * Insert an entry into a time-sorted board in place, trimming to `max`.
 * Entries are { lap, time }; fastest-first.
 * @param {Array} board - mutable sorted array.
 * @param {object} entry - { lap, time } to insert.
 * @param {number} [max] - max board size.
 */
export function insertTopN(board, entry, max = 5) {
  let i = board.length;
  while (i > 0 && board[i - 1].time > entry.time) i--;
  board.splice(i, 0, entry);
  if (board.length > max) board.length = max;
}

/**
 * Map a numeric value through descending threshold stops.
 * @param {number} v - input value.
 * @param {Array<[number, string]>} stops - [threshold, label] high-to-low.
 * @param {string} fallback - label when no stop matches.
 * @returns {string} matched label.
 */
export function thresholdLabel(v, stops, fallback) {
  for (const [limit, label] of stops) {
    if (v >= limit) return label;
  }
  return fallback;
}
