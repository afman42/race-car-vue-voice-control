// src/utils/raceStanding.js

/**
 * Convert a car's lap + intra-lap progress into a single normalized "race
 * progress" number expressed in laps completed (e.g. 2.5 = halfway through
 * lap 3). This is the common currency used to place cars on the track map and
 * to rank them, even though the player (physics sim) and the AI rival (lap-time
 * generator) measure intra-lap progress differently.
 *
 * @param {number} lap - current lap number, 1-based.
 * @param {number} lapFraction - fraction of the current lap completed, 0..1.
 * @param {number} totalLaps - total laps in the race; caps the result.
 * @returns {number} total progress in laps, clamped to [0, totalLaps].
 */
export function totalProgress(lap, lapFraction, totalLaps) {
  const safeLap = Number.isFinite(lap) ? lap : 1;
  const safeFraction = Number.isFinite(lapFraction) ? lapFraction : 0;
  const clampedFraction = Math.min(1, Math.max(0, safeFraction));
  const progress = safeLap - 1 + clampedFraction;
  if (!Number.isFinite(totalLaps) || totalLaps <= 0) return Math.max(0, progress);
  return Math.min(totalLaps, Math.max(0, progress));
}

/**
 * Map a total-progress value onto a normalized lap loop position (0..1), i.e.
 * where the car sits around a single circuit lap regardless of which lap it is
 * on. Used to place a marker along an SVG path via getPointAtLength.
 *
 * @param {number} progress - total progress in laps (from totalProgress).
 * @returns {number} position around the loop, 0..1 (1 wraps back to 0).
 */
export function loopPosition(progress) {
  const safe = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  return safe % 1;
}

/**
 * Compute race standings from each car's total progress. The car that has
 * covered the most progress is P1. Ties keep the player ahead so a fresh race
 * (both at 0) doesn't read as "losing".
 *
 * @param {object} player - { progress } for the human car.
 * @param {object} rival - { progress } for the AI rival, or null when no rival.
 * @returns {{ playerPosition: number, totalCars: number, gap: number,
 *   leader: 'player'|'rival'|null }}
 *   playerPosition is 1-based; gap is player.progress - rival.progress (laps),
 *   positive when the player is ahead; leader names the car in front.
 */
export function computeStandings(player, rival) {
  const playerProgress = player && Number.isFinite(player.progress)
    ? player.progress
    : 0;

  if (!rival || !Number.isFinite(rival.progress)) {
    return { playerPosition: 1, totalCars: 1, gap: 0, leader: null };
  }

  const rivalProgress = rival.progress;
  const gap = playerProgress - rivalProgress;
  // Player keeps P1 on a tie (gap === 0).
  const playerAhead = gap >= 0;

  return {
    playerPosition: playerAhead ? 1 : 2,
    totalCars: 2,
    gap,
    leader: playerAhead ? "player" : "rival",
  };
}

/**
 * Format an ordinal race position label, e.g. 1 -> "P1".
 * @param {number} position - 1-based position.
 * @returns {string}
 */
export function formatPosition(position) {
  const safe = Number.isFinite(position) && position > 0 ? Math.floor(position) : 1;
  return `P${safe}`;
}
