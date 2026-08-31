// src/config.spec.js

import { describe, it, expect } from "vitest";
import {
  CAR_SETTINGS,
  CAR_PRESETS,
  AI_DIFFICULTY,
  FUEL_MIXES,
  TIRE_COMPOUNDS,
  ERS_MODES,
  WEATHER_CONDITIONS,
  TIRE_TEMP,
  DRS_DETECTION,
  PIT_WINDOW,
  QUALIFYING,
  WEATHER_SHIFT,
  validateConfig,
} from "@/config";

describe("validateConfig", () => {
  it("passes on the shipped config", () => {
    expect(() => validateConfig()).not.toThrow();
  });

  it("throws when TRACK_LAYOUT no longer sums to LAP_DISTANCE", () => {
    const original = CAR_SETTINGS.TRACK_LAYOUT;
    CAR_SETTINGS.TRACK_LAYOUT = [{ type: "straight", length: 1 }];
    try {
      expect(() => validateConfig()).toThrow(/TRACK_LAYOUT lengths sum to 1/);
    } finally {
      CAR_SETTINGS.TRACK_LAYOUT = original;
    }
  });

  it("throws when GEAR_RATIOS falls out of sync with GEAR_COUNT", () => {
    const original = CAR_SETTINGS.GEAR_RATIOS;
    CAR_SETTINGS.GEAR_RATIOS = [0, 1, 2];
    try {
      expect(() => validateConfig()).toThrow(/GEAR_RATIOS has 3 entries/);
    } finally {
      CAR_SETTINGS.GEAR_RATIOS = original;
    }
  });

  it("restores cleanly: the real config still validates afterwards", () => {
    expect(() => validateConfig()).not.toThrow();
  });
});

describe("CAR_SETTINGS invariants", () => {
  it("has a neutral entry plus one ratio per forward gear", () => {
    expect(CAR_SETTINGS.GEAR_RATIOS).toHaveLength(
      CAR_SETTINGS.GEAR_COUNT + 1,
    );
    expect(CAR_SETTINGS.GEAR_RATIOS[0]).toBe(0);
  });

  it("has strictly increasing gear ratios above neutral", () => {
    const forward = CAR_SETTINGS.GEAR_RATIOS.slice(1);
    for (let i = 1; i < forward.length; i++) {
      expect(forward[i]).toBeGreaterThan(forward[i - 1]);
    }
  });

  it("keeps the shift point above the post-shift drop", () => {
    expect(CAR_SETTINGS.GEAR_SHIFT_RPM).toBeGreaterThan(
      CAR_SETTINGS.GEAR_DROP_RPM,
    );
    expect(CAR_SETTINGS.GEAR_SHIFT_RPM).toBeLessThanOrEqual(
      CAR_SETTINGS.RPM_MAX,
    );
  });

  it("orders the temperature thresholds ambient < optimal < critical", () => {
    expect(CAR_SETTINGS.TEMP_AMBIENT).toBeLessThan(
      CAR_SETTINGS.TEMP_OPTIMAL_MAX,
    );
    expect(CAR_SETTINGS.TEMP_OPTIMAL_MAX).toBeLessThan(
      CAR_SETTINGS.TEMP_CRITICAL,
    );
  });

  it("orders the tire-life thresholds worn < optimal", () => {
    expect(CAR_SETTINGS.TIRE_WORN_THRESHOLD).toBeLessThan(
      CAR_SETTINGS.TIRE_OPTIMAL_THRESHOLD,
    );
  });

  it("orders the damage thresholds minor < major < critical", () => {
    expect(CAR_SETTINGS.DAMAGE_MINOR_THRESHOLD).toBeLessThan(
      CAR_SETTINGS.DAMAGE_MAJOR_THRESHOLD,
    );
    expect(CAR_SETTINGS.DAMAGE_MAJOR_THRESHOLD).toBeLessThan(
      CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD,
    );
  });

  it("keeps the corner speed cap and damage penalty as fractions", () => {
    expect(CAR_SETTINGS.CORNER_SPEED_CAP).toBeGreaterThan(0);
    expect(CAR_SETTINGS.CORNER_SPEED_CAP).toBeLessThan(1);
    expect(CAR_SETTINGS.DAMAGE_MAX_PACE_PENALTY).toBeGreaterThan(0);
    expect(CAR_SETTINGS.DAMAGE_MAX_PACE_PENALTY).toBeLessThan(1);
  });

  it("targets a valid gear for every corner speed present on the track", () => {
    const cornerSpeeds = new Set(
      CAR_SETTINGS.TRACK_LAYOUT.filter((s) => s.type === "corner").map(
        (s) => s.speed,
      ),
    );
    for (const speed of cornerSpeeds) {
      const gear = CAR_SETTINGS.CORNER_TARGET_GEARS[speed];
      expect(gear, `no target gear for ${speed}`).toBeGreaterThanOrEqual(1);
      expect(gear).toBeLessThanOrEqual(CAR_SETTINGS.GEAR_COUNT);
    }
  });

  it("uses positive lengths and known types for every track segment", () => {
    for (const segment of CAR_SETTINGS.TRACK_LAYOUT) {
      expect(segment.length).toBeGreaterThan(0);
      expect(["straight", "corner"]).toContain(segment.type);
      if (segment.type === "corner") {
        expect(["slow", "medium", "fast"]).toContain(segment.speed);
      }
    }
  });

  it("defines a consumption rate for every fuel mix", () => {
    expect(Object.keys(CAR_SETTINGS.FUEL_CONSUMPTION_RATE).sort()).toEqual(
      Object.keys(FUEL_MIXES).sort(),
    );
  });

  it("burns more fuel on richer mixes", () => {
    const { LEAN, STANDARD, RICH } = CAR_SETTINGS.FUEL_CONSUMPTION_RATE;
    expect(LEAN).toBeLessThan(STANDARD);
    expect(STANDARD).toBeLessThan(RICH);
  });
});

describe("CAR_PRESETS", () => {
  const STAT_KEYS = ["speedMul", "gripMul", "wearMul", "fuelMul", "tempoMul"];

  it("has unique ids", () => {
    const ids = CAR_PRESETS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the default 'balanced' car used as the initial selection", () => {
    expect(CAR_PRESETS.some((c) => c.id === "balanced")).toBe(true);
  });

  it("gives 'balanced' neutral multipliers", () => {
    const balanced = CAR_PRESETS.find((c) => c.id === "balanced");
    for (const key of STAT_KEYS) {
      expect(balanced.stats[key]).toBe(1);
    }
  });

  it.each(CAR_PRESETS.map((c) => [c.id, c]))(
    "%s has a full stat block, label, description and marker colour",
    (_id, car) => {
      expect(car.label).toBeTruthy();
      expect(car.desc).toBeTruthy();
      expect(car.markerColor).toMatch(/^#[0-9a-f]{6}$/i);
      for (const key of STAT_KEYS) {
        expect(car.stats[key]).toBeGreaterThan(0);
      }
    },
  );

  it("keeps every stat inside the modal's 0.5-1.4 bar scale", () => {
    for (const car of CAR_PRESETS) {
      for (const key of STAT_KEYS) {
        expect(car.stats[key]).toBeGreaterThanOrEqual(0.5);
        expect(car.stats[key]).toBeLessThanOrEqual(1.4);
      }
    }
  });
});

describe("mode tables", () => {
  it("scales AI pace and variance monotonically with difficulty", () => {
    const { EASY, MEDIUM, HARD } = AI_DIFFICULTY;
    expect(EASY.paceFactor).toBeLessThan(MEDIUM.paceFactor);
    expect(MEDIUM.paceFactor).toBeLessThan(HARD.paceFactor);
    expect(EASY.variance).toBeGreaterThan(MEDIUM.variance);
    expect(MEDIUM.variance).toBeGreaterThan(HARD.variance);
  });

  it("labels every difficulty", () => {
    for (const entry of Object.values(AI_DIFFICULTY)) {
      expect(entry.label).toBeTruthy();
    }
  });

  it("wears softer compounds faster", () => {
    expect(TIRE_COMPOUNDS.SOFT.wearFactor).toBeGreaterThan(
      TIRE_COMPOUNDS.MEDIUM.wearFactor,
    );
    expect(TIRE_COMPOUNDS.MEDIUM.wearFactor).toBeGreaterThan(
      TIRE_COMPOUNDS.HARD.wearFactor,
    );
  });

  it("recharges least in HOTLAP and most in CHARGE", () => {
    expect(ERS_MODES.HOTLAP.rechargeFactor).toBeLessThan(
      ERS_MODES.BALANCED.rechargeFactor,
    );
    expect(ERS_MODES.BALANCED.rechargeFactor).toBeLessThan(
      ERS_MODES.CHARGE.rechargeFactor,
    );
  });

  it("loses grip and cools more as the weather worsens", () => {
    const order = ["DRY", "CLOUDY", "WET", "STORM"];
    for (let i = 1; i < order.length; i++) {
      const prev = WEATHER_CONDITIONS[order[i - 1]];
      const curr = WEATHER_CONDITIONS[order[i]];
      expect(curr.gripFactor).toBeLessThan(prev.gripFactor);
      expect(curr.tempBias).toBeLessThanOrEqual(prev.tempBias);
    }
  });

  it("keeps DRY as the neutral weather baseline", () => {
    expect(WEATHER_CONDITIONS.DRY).toMatchObject({
      gripFactor: 1,
      wearFactor: 1,
      tempBias: 0,
    });
  });
});

describe("tire temperature model", () => {
  it("orders cold < optimal < critical around the baseline", () => {
    expect(TIRE_TEMP.COLD_THRESHOLD).toBeLessThan(TIRE_TEMP.OPTIMAL_MAX);
    expect(TIRE_TEMP.OPTIMAL_MAX).toBeLessThan(TIRE_TEMP.CRITICAL_TEMP);
    expect(TIRE_TEMP.BASELINE).toBeGreaterThan(TIRE_TEMP.COLD_THRESHOLD);
    expect(TIRE_TEMP.BASELINE).toBeLessThan(TIRE_TEMP.OPTIMAL_MAX);
  });

  it("gives peak grip in the optimal window", () => {
    expect(TIRE_TEMP.GRIP_OPTIMAL_FACTOR).toBeGreaterThan(
      TIRE_TEMP.GRIP_COLD_FACTOR,
    );
    expect(TIRE_TEMP.GRIP_OPTIMAL_FACTOR).toBeGreaterThanOrEqual(
      TIRE_TEMP.GRIP_HOT_FACTOR,
    );
  });

  it("wears faster outside the optimal window", () => {
    expect(TIRE_TEMP.WEAR_COLD_FACTOR).toBeGreaterThan(1);
    expect(TIRE_TEMP.WEAR_HOT_FACTOR).toBeGreaterThan(1);
  });
});

describe("strategy windows", () => {
  it("checks DRS on a real track segment", () => {
    expect(DRS_DETECTION.DETECTION_SEGMENT).toBeGreaterThanOrEqual(0);
    expect(DRS_DETECTION.DETECTION_SEGMENT).toBeLessThan(
      CAR_SETTINGS.TRACK_LAYOUT.length,
    );
    expect(DRS_DETECTION.ELIGIBILITY_GAP_LAPS).toBeGreaterThan(0);
    expect(DRS_DETECTION.DRS_BOOST).toBeGreaterThan(1);
  });

  it("raises urgency inside the suggestion window", () => {
    expect(PIT_WINDOW.URGENT_LAPS_REMAINING).toBeLessThanOrEqual(
      PIT_WINDOW.SUGGEST_AHEAD_LAPS,
    );
    expect(PIT_WINDOW.SUGGEST_AHEAD_LAPS).toBeLessThanOrEqual(
      PIT_WINDOW.SHOW_WINDOW_LAPS,
    );
  });

  it("runs a qualifying session shorter than the race", () => {
    expect(QUALIFYING.LAPS).toBeGreaterThan(0);
    expect(QUALIFYING.LAPS).toBeLessThan(CAR_SETTINGS.TOTAL_LAPS);
  });

  it("schedules any weather shift inside the race distance", () => {
    expect(WEATHER_SHIFT.CHANGE_LAP_MIN).toBeLessThanOrEqual(
      WEATHER_SHIFT.CHANGE_LAP_MAX,
    );
    expect(WEATHER_SHIFT.CHANGE_LAP_MAX).toBeLessThanOrEqual(
      CAR_SETTINGS.TOTAL_LAPS,
    );
    expect(WEATHER_SHIFT.FORECAST_LAPS).toBeLessThan(
      WEATHER_SHIFT.CHANGE_LAP_MIN,
    );
  });
});
