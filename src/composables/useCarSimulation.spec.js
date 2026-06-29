// src/composables/useCarSimulation.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import { CAR_SETTINGS, FUEL_MIXES } from "@/config";
import ttsService from "@/services/textToSpeechService";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

describe("useCar - runSimulationTick", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // autoShift edge cases
  // ──────────────────────────────────────────────
  describe("autoShift", () => {
    it("sets gear to 0 (neutral) when the engine is off", () => {
      const { runSimulationTick, currentGear } = useCar();
      currentGear.value = 5;

      runSimulationTick();

      // Engine is off → autoShift should force neutral.
      expect(currentGear.value).toBe(0);
    });

    it("engages gear 1 when gear is 0 and engine is running", () => {
      const { runSimulationTick, currentGear, engineStatus, rpm } = useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.GEAR_SHIFT_RPM - 100;
      currentGear.value = 0;

      runSimulationTick();

      expect(currentGear.value).toBe(1);
    });

    it("does not upshift when RPM after climb is still below shift threshold", () => {
      const { runSimulationTick, currentGear, rpm, engineStatus, lapProgress } =
        useCar();
      engineStatus.value = true;
      // RPM climbs +1000/tick, so start below 7500-1000=6500 to stay under.
      rpm.value = CAR_SETTINGS.GEAR_SHIFT_RPM - CAR_SETTINGS.GEAR_RPM_CLIMB - 100; // 6400 → climbs to 7400
      lapProgress.value = 0; // straight, target = 7
      currentGear.value = 2;

      runSimulationTick();

      expect(currentGear.value).toBe(2);
    });

    it("applies safety downshift when RPM is near idle and gear > 1", () => {
      const { runSimulationTick, currentGear, rpm, engineStatus, overheating, lapProgress } =
        useCar();
      engineStatus.value = true;
      overheating.value = true; // prevents RPM climb (+1000/tick normally)
      rpm.value = CAR_SETTINGS.RPM_IDLE + 400; // 1150, within safety window (≤ 1250)
      currentGear.value = 3;
      lapProgress.value = 0; // straight, target = 7

      runSimulationTick();

      // Safety downshift: gear 3 → 2, RPM reset to drop RPM.
      expect(currentGear.value).toBe(2);
      expect(rpm.value).toBe(CAR_SETTINGS.GEAR_DROP_RPM);
    });

    it("drops 2 gears/tick toward the corner target when entering a corner", () => {
      const { runSimulationTick, currentGear, rpm, engineStatus, lapProgress } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.GEAR_SHIFT_RPM;
      currentGear.value = 6;
      // Segment 1 is a slow corner (150-198, target gear = 2).
      lapProgress.value = 170;

      runSimulationTick();

      // Should drop 2 gears (6 → 4), resetting RPM.
      expect(currentGear.value).toBe(4);
      expect(rpm.value).toBe(CAR_SETTINGS.GEAR_DROP_RPM);
    });
  });

  // ──────────────────────────────────────────────
  // stall / overheat edge cases
  // ──────────────────────────────────────────────
  describe("stall and overheat", () => {
    it("clears DRS and overtake status on stall", async () => {
      const { runSimulationTick, drsStatus, overtakeActive, engineStatus, fuelLevel, rpm } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      drsStatus.value = true;
      overtakeActive.value = true;
      fuelLevel.value = 0;

      runSimulationTick();
      await Promise.resolve();

      expect(drsStatus.value).toBe(false);
      expect(overtakeActive.value).toBe(false);
      expect(engineStatus.value).toBe(false);
    });

    it("clears DRS, overtake and sets gear to 0 on overheat", async () => {
      const { runSimulationTick, drsStatus, overtakeActive, overheating, engineTemp, rpm, engineStatus } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      drsStatus.value = true;
      overtakeActive.value = true;
      engineTemp.value = CAR_SETTINGS.TEMP_CRITICAL; // triggers overheat

      runSimulationTick();
      await Promise.resolve();

      expect(drsStatus.value).toBe(false);
      expect(overtakeActive.value).toBe(false);
      expect(overheating.value).toBe(true);
      expect(rpm.value).toBe(CAR_SETTINGS.RPM_IDLE);
    });

    it("recovers from overheating when temperature drops below optimal max", () => {
      const { runSimulationTick, overheating, engineTemp, rpm, engineStatus } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_IDLE; // idle → temperature will drop
      overheating.value = true;
      engineTemp.value = CAR_SETTINGS.TEMP_OPTIMAL_MAX - 1; // 119 < 120

      runSimulationTick();

      expect(overheating.value).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // pitting guard
  // ──────────────────────────────────────────────
  describe("pitting guard", () => {
    it("does nothing while the car is pitting", () => {
      const { runSimulationTick, fuelLevel, batteryLevel, tireLife, engineStatus, rpm, pitting } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      fuelLevel.value = 50;
      batteryLevel.value = 50;
      tireLife.value = 50;
      pitting.value = true;

      runSimulationTick();

      // All values should be unchanged because the tick returns early.
      expect(fuelLevel.value).toBe(50);
      expect(batteryLevel.value).toBe(50);
      expect(tireLife.value).toBe(50);
    });
  });

  // ──────────────────────────────────────────────
  // safety floors
  // ──────────────────────────────────────────────
  describe("safety floors", () => {
    it("does not let fuel level drop below 0", () => {
      const { runSimulationTick, fuelLevel, rpm, engineStatus } = useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      fuelLevel.value = 0.01;

      runSimulationTick();

      expect(fuelLevel.value).toBe(0);
    });

    it("does not let tire life drop below 0", () => {
      const { runSimulationTick, tireLife, rpm, engineStatus } = useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      tireLife.value = 0.1;

      runSimulationTick();

      expect(tireLife.value).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // original tests follow
  // ──────────────────────────────────────────────

  it("does not consume fuel below idle RPM beyond the minimum multiplier", () => {
    const { runSimulationTick, fuelLevel, rpm, engineStatus } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_IDLE;

    const before = fuelLevel.value;
    runSimulationTick();

    // At idle, consumption = STANDARD * RPM_MULTIPLIER_MIN
    const expected = parseFloat(
      (
        before -
        CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD *
          CAR_SETTINGS.RPM_MULTIPLIER_MIN
      ).toFixed(2),
    );
    expect(fuelLevel.value).toBeCloseTo(expected, 2);
  });

  it("consumes more fuel at higher RPM", () => {
    const { runSimulationTick, fuelLevel, rpm, engineStatus } = useCar();
    engineStatus.value = true;

    rpm.value = CAR_SETTINGS.RPM_IDLE;
    let before = fuelLevel.value;
    runSimulationTick();
    const lowRpmUsage = before - fuelLevel.value;

    fuelLevel.value = 100;
    rpm.value = CAR_SETTINGS.RPM_MAX;
    before = fuelLevel.value;
    runSimulationTick();
    const highRpmUsage = before - fuelLevel.value;

    expect(highRpmUsage).toBeGreaterThan(lowRpmUsage);
  });

  it("consumes more fuel on a rich mix than a lean mix", () => {
    const { runSimulationTick, fuelLevel, rpm, engineStatus, fuelMix } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    fuelMix.value = FUEL_MIXES.LEAN;
    fuelLevel.value = 100;
    runSimulationTick();
    const leanUsage = 100 - fuelLevel.value;

    fuelMix.value = FUEL_MIXES.RICH;
    fuelLevel.value = 100;
    runSimulationTick();
    const richUsage = 100 - fuelLevel.value;

    expect(richUsage).toBeGreaterThan(leanUsage);
  });

  it("recharges the battery at a constant rate regardless of RPM", () => {
    const { runSimulationTick, batteryLevel, rpm, engineStatus } = useCar();
    engineStatus.value = true;
    batteryLevel.value = 50;

    rpm.value = CAR_SETTINGS.RPM_MAX;
    runSimulationTick();

    expect(batteryLevel.value).toBeCloseTo(
      50 + CAR_SETTINGS.BATTERY_RECHARGE_RATE,
      2,
    );
  });

  it("wears tires faster at higher RPM", () => {
    const { runSimulationTick, tireLife, rpm, engineStatus } = useCar();
    engineStatus.value = true;

    rpm.value = CAR_SETTINGS.RPM_IDLE;
    tireLife.value = 100;
    runSimulationTick();
    const idleWear = 100 - tireLife.value;

    rpm.value = CAR_SETTINGS.RPM_MAX;
    tireLife.value = 100;
    runSimulationTick();
    const maxWear = 100 - tireLife.value;

    expect(maxWear).toBeGreaterThan(idleWear);
  });

  it("announces a low-fuel warning once when crossing the threshold", () => {
    const { runSimulationTick, fuelLevel, rpm, engineStatus } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    fuelLevel.value = CAR_SETTINGS.LOW_FUEL_THRESHOLD + 0.1;

    runSimulationTick(); // crosses below threshold
    runSimulationTick(); // still below, should NOT warn again

    const fuelWarnings = ttsService.speak.mock.calls.filter(
      (c) => c[0] === "Warning. Fuel level critical.",
    );
    expect(fuelWarnings).toHaveLength(1);
  });

  it("stalls the engine when fuel runs out", async () => {
    const { runSimulationTick, fuelLevel, rpm, engineStatus } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;
    fuelLevel.value = 0.1;

    runSimulationTick();
    await Promise.resolve(); // let the async stall settle

    expect(fuelLevel.value).toBe(0);
    expect(engineStatus.value).toBe(false);
    expect(rpm.value).toBe(0);
    expect(ttsService.speak).toHaveBeenCalledWith("Out of fuel. Engine stalling.");
  });

  it("does not recharge the battery beyond 100%", () => {
    const { runSimulationTick, batteryLevel, rpm, engineStatus } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    // Start at 100% and run several ticks — should stay at 100.
    batteryLevel.value = 100;
    for (let i = 0; i < 10; i++) runSimulationTick();

    expect(batteryLevel.value).toBe(100);
  });

  it("still consumes fuel while the engine runs after the race finishes", () => {
    const { runSimulationTick, fuelLevel, rpm, engineStatus, raceFinished } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;
    raceFinished.value = true;

    const before = fuelLevel.value;
    runSimulationTick();

    // Fuel should still decrease because the engine is still running.
    expect(fuelLevel.value).toBeLessThan(before);
  });
});
