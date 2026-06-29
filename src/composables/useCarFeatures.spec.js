// src/composables/useCarFeatures.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import {
  CAR_SETTINGS,
  TIRE_COMPOUNDS,
  ERS_MODES,
  FUEL_MIXES,
} from "@/config";
import ttsService from "@/services/textToSpeechService";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

describe("useCar - extended features", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  describe("tire compounds", () => {
    it("fits a new compound when the engine is off and resets life", async () => {
      const { setTireCompound, tireCompound, tireLife } = useCar();
      tireLife.value = 40;

      const message = await setTireCompound("SOFT");

      expect(message).toBe("Soft tires fitted.");
      expect(tireCompound.value).toBe(TIRE_COMPOUNDS.SOFT.label);
      expect(tireLife.value).toBe(100);
    });

    it("refuses to change compound while the engine runs", async () => {
      const { startEngine, setTireCompound, tireCompound } = useCar();
      await startEngine();

      const message = await setTireCompound("HARD");

      expect(message).toBe("Pit the car before changing tire compound.");
      expect(tireCompound.value).toBe(TIRE_COMPOUNDS.MEDIUM.label);
    });

    it("rejects unknown compounds", async () => {
      const { setTireCompound } = useCar();
      expect(await setTireCompound("ice")).toBe("Unknown tire compound: ice.");
    });

    it("soft compound wears faster than hard at the same RPM", async () => {
      const { runSimulationTick, tireLife, rpm, engineStatus, setTireCompound } =
        useCar();

      await setTireCompound("SOFT");
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      tireLife.value = 100;
      runSimulationTick();
      const softWear = 100 - tireLife.value;

      engineStatus.value = false;
      await setTireCompound("HARD");
      engineStatus.value = true;
      tireLife.value = 100;
      runSimulationTick();
      const hardWear = 100 - tireLife.value;

      expect(softWear).toBeGreaterThan(hardWear);
    });
  });

  describe("ERS modes", () => {
    it("sets a valid mode", async () => {
      const { setErsMode, ersMode } = useCar();
      expect(await setErsMode("CHARGE")).toBe("ERS mode set to Charge.");
      expect(ersMode.value).toBe(ERS_MODES.CHARGE.label);
    });

    it("rejects unknown modes", async () => {
      const { setErsMode, ersMode } = useCar();
      expect(await setErsMode("nitro")).toBe("Unknown ERS mode: nitro.");
      expect(ersMode.value).toBe(ERS_MODES.BALANCED.label);
    });

    it("charge mode recharges faster than hotlap", () => {
      const { runSimulationTick, batteryLevel, engineStatus, ersMode } =
        useCar();
      engineStatus.value = true;

      ersMode.value = ERS_MODES.HOTLAP.label;
      batteryLevel.value = 50;
      runSimulationTick();
      const hotlapGain = batteryLevel.value - 50;

      ersMode.value = ERS_MODES.CHARGE.label;
      batteryLevel.value = 50;
      runSimulationTick();
      const chargeGain = batteryLevel.value - 50;

      expect(chargeGain).toBeGreaterThan(hotlapGain);
    });
  });

  describe("engine temperature", () => {
    it("rises at high RPM and cools at idle", () => {
      const { runSimulationTick, engineTemp, rpm, engineStatus } = useCar();
      engineStatus.value = true;

      rpm.value = CAR_SETTINGS.RPM_MAX;
      runSimulationTick();
      const hot = engineTemp.value;
      expect(hot).toBeGreaterThan(CAR_SETTINGS.TEMP_AMBIENT);

      rpm.value = CAR_SETTINGS.RPM_IDLE;
      runSimulationTick();
      expect(engineTemp.value).toBeLessThan(hot);
    });

    it("never drops below ambient", () => {
      const { runSimulationTick, engineTemp, rpm, engineStatus } = useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_IDLE;

      for (let i = 0; i < 20; i++) runSimulationTick();

      expect(engineTemp.value).toBeGreaterThanOrEqual(CAR_SETTINGS.TEMP_AMBIENT);
    });

    it("cuts power and overheats when crossing the critical threshold", async () => {
      const { runSimulationTick, engineTemp, rpm, engineStatus, overheating } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      engineTemp.value = CAR_SETTINGS.TEMP_CRITICAL - 1;

      runSimulationTick();
      await Promise.resolve();

      expect(engineTemp.value).toBeGreaterThanOrEqual(CAR_SETTINGS.TEMP_CRITICAL);
      expect(overheating.value).toBe(true);
      expect(rpm.value).toBe(CAR_SETTINGS.RPM_IDLE);
      expect(ttsService.speak).toHaveBeenCalledWith(
        "Engine overheating. Cutting power.",
      );
    });

    it("blocks overtake while overheating", async () => {
      const { activateOvertake, engineStatus, overheating } = useCar();
      engineStatus.value = true;
      overheating.value = true;

      const message = await activateOvertake();
      expect(message).toBe("Cannot activate overtake, engine is overheating.");
    });
  });

  describe("lap timer", () => {
    it("advances laps as distance accumulates", () => {
      const { runSimulationTick, currentLap, rpm, engineStatus } = useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;

      const startLap = currentLap.value;
      for (let i = 0; i < 200; i++) runSimulationTick();

      expect(currentLap.value).toBeGreaterThan(startLap);
    });

    it("finishes the race after the final lap and stops the engine", () => {
      const { runSimulationTick, raceFinished, currentLap, rpm, engineStatus, currentGear } =
        useCar();
      engineStatus.value = true;
      rpm.value = CAR_SETTINGS.RPM_MAX;
      currentGear.value = 5;
      currentLap.value = CAR_SETTINGS.TOTAL_LAPS;

      for (let i = 0; i < 200 && !raceFinished.value; i++) runSimulationTick();

      expect(raceFinished.value).toBe(true);
      // Engine must stop so dashboard items freeze.
      expect(engineStatus.value).toBe(false);
      expect(rpm.value).toBe(0);
      expect(currentGear.value).toBe(0);
      expect(ttsService.speak).toHaveBeenCalledWith(
        "Checkered flag. Race complete.",
      );
    });

    it("getLapStatus reports the current lap", async () => {
      const { getLapStatus } = useCar();
      const message = await getLapStatus();
      expect(message).toBe(`On lap 1 of ${CAR_SETTINGS.TOTAL_LAPS}.`);
    });
  });

  describe("help", () => {
    it("returns a list of commands and speaks it", async () => {
      const { getHelp } = useCar();
      const message = await getHelp();
      expect(message).toContain("Available commands");
      expect(ttsService.speak).toHaveBeenCalledWith(message);
    });
  });

  describe("reset", () => {
    it("restores extended state to defaults", async () => {
      const {
        resetRace,
        ersMode,
        tireCompound,
        engineTemp,
        currentLap,
        fuelMix,
        raceFinished,
      } = useCar();

      ersMode.value = ERS_MODES.CHARGE.label;
      tireCompound.value = TIRE_COMPOUNDS.SOFT.label;
      engineTemp.value = 125;
      currentLap.value = 5;
      raceFinished.value = true;

      await resetRace();

      expect(ersMode.value).toBe(ERS_MODES.BALANCED.label);
      expect(tireCompound.value).toBe(TIRE_COMPOUNDS.MEDIUM.label);
      expect(engineTemp.value).toBe(CAR_SETTINGS.TEMP_AMBIENT);
      expect(currentLap.value).toBe(1);
      expect(fuelMix.value).toBe(FUEL_MIXES.STANDARD);
      expect(raceFinished.value).toBe(false);
    });
  });
});
