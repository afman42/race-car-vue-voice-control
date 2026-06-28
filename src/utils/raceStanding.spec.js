// src/utils/raceStanding.spec.js

import { describe, it, expect } from "vitest";
import {
  totalProgress,
  loopPosition,
  computeStandings,
  formatPosition,
} from "./raceStanding";

describe("totalProgress", () => {
  it("combines lap number and intra-lap fraction", () => {
    expect(totalProgress(1, 0, 10)).toBe(0);
    expect(totalProgress(1, 0.5, 10)).toBe(0.5);
    expect(totalProgress(3, 0.5, 10)).toBe(2.5);
  });

  it("clamps the lap fraction to 0..1", () => {
    expect(totalProgress(2, 1.7, 10)).toBe(2); // lap 2 + full lap = 2
    expect(totalProgress(2, -0.5, 10)).toBe(1); // lap 2 + 0 = 1
  });

  it("caps progress at totalLaps", () => {
    expect(totalProgress(11, 0.5, 10)).toBe(10);
    expect(totalProgress(10, 1, 10)).toBe(10);
  });

  it("guards against non-finite inputs", () => {
    expect(totalProgress(undefined, undefined, 10)).toBe(0);
    expect(totalProgress(NaN, NaN, 10)).toBe(0);
  });

  it("ignores invalid totalLaps caps but stays non-negative", () => {
    expect(totalProgress(3, 0.5, 0)).toBe(2.5);
    expect(totalProgress(3, 0.5, NaN)).toBe(2.5);
  });
});

describe("loopPosition", () => {
  it("returns the fractional part of total progress", () => {
    expect(loopPosition(0)).toBe(0);
    expect(loopPosition(2.5)).toBe(0.5);
    expect(loopPosition(0.25)).toBeCloseTo(0.25);
  });

  it("wraps whole laps back to the start", () => {
    expect(loopPosition(3)).toBe(0);
  });

  it("guards against non-finite or negative input", () => {
    expect(loopPosition(NaN)).toBe(0);
    expect(loopPosition(-1)).toBe(0);
  });
});

describe("computeStandings", () => {
  it("returns a solo standing when there is no rival", () => {
    const result = computeStandings({ progress: 2.5 }, null);
    expect(result).toEqual({
      playerPosition: 1,
      totalCars: 1,
      gap: 0,
      leader: null,
    });
  });

  it("places the player ahead when their progress is greater", () => {
    const result = computeStandings({ progress: 3.2 }, { progress: 2.8 });
    expect(result.playerPosition).toBe(1);
    expect(result.totalCars).toBe(2);
    expect(result.leader).toBe("player");
    expect(result.gap).toBeCloseTo(0.4);
  });

  it("places the player behind when the rival has more progress", () => {
    const result = computeStandings({ progress: 2.1 }, { progress: 3.0 });
    expect(result.playerPosition).toBe(2);
    expect(result.leader).toBe("rival");
    expect(result.gap).toBeCloseTo(-0.9);
  });

  it("keeps the player in P1 on an exact tie", () => {
    const result = computeStandings({ progress: 0 }, { progress: 0 });
    expect(result.playerPosition).toBe(1);
    expect(result.leader).toBe("player");
    expect(result.gap).toBe(0);
  });

  it("treats missing player progress as zero", () => {
    const result = computeStandings({}, { progress: 1.5 });
    expect(result.playerPosition).toBe(2);
    expect(result.gap).toBeCloseTo(-1.5);
  });
});

describe("formatPosition", () => {
  it("formats a position as P<n>", () => {
    expect(formatPosition(1)).toBe("P1");
    expect(formatPosition(2)).toBe("P2");
  });

  it("falls back to P1 for invalid input", () => {
    expect(formatPosition(0)).toBe("P1");
    expect(formatPosition(NaN)).toBe("P1");
    expect(formatPosition(undefined)).toBe("P1");
  });
});
