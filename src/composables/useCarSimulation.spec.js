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
});
