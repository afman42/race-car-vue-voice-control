// src/utils/formatLapTime.js

/**
 * Format milliseconds as a lap time string: M:SS.mmm.
 * Returns a neutral placeholder when no time is available.
 * @param {number|null|undefined} ms - elapsed milliseconds, or null/undefined.
 * @returns {string} e.g. "1:23.456", or "--:--" when ms is null/undefined.
 */
export function formatLapTime(ms) {
  if (ms === null || ms === undefined) return "--:--";
  // Round to the nearest whole millisecond first, then decompose. Rounding
  // the total avoids the Math.round(ms % 1000) edge case where a fractional
  // remainder >= 999.5 would produce a 4-digit "1000" millis field.
  const wholeMs = Math.round(ms);
  const totalSeconds = wholeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = wholeMs % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(
    millis,
  ).padStart(3, "0")}`;
}
