// src/composables/useCar.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import { CAR_SETTINGS, FUEL_MIXES } from "@/config";
import audioService from "@/services/audioService";
import ttsService from "@/services/textToSpeechService";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

describe("useCar Composable", () => {
  // The composable uses a shared singleton state, so reset it before each test
  // to keep tests independent of execution order.
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  describe("initial / reset state", () => {
    it("should have correct initial state", () => {
      const { engineStatus, rpm, fuelLevel, batteryLevel, fuelMix, tireLife } =
        useCar();
      expect(engineStatus.value).toBe(false);
      expect(rpm.value).toBe(0);
      expect(fuelLevel.value).toBe(100);
      expect(batteryLevel.value).toBe(100);
      expect(fuelMix.value).toBe(FUEL_MIXES.STANDARD);
      expect(tireLife.value).toBe(100);
    });

    it("resetRace should restore all state to defaults", async () => {
      const { startEngine, fuelLevel, resetRace, engineStatus } = useCar();
      await startEngine();
      fuelLevel.value = 42;

      const message = await resetRace();

      expect(message).toBe("Race reset. All systems nominal.");
      expect(engineStatus.value).toBe(false);
      expect(fuelLevel.value).toBe(100);
    });
  });

  describe("engine", () => {
    it("startEngine should turn the engine on and set idle RPM", async () => {
      const { startEngine, engineStatus, rpm, currentGear } = useCar();
      const message = await startEngine();

      expect(message).toBe("Engine started.");
      expect(engineStatus.value).toBe(true);
      expect(rpm.value).toBe(CAR_SETTINGS.GEAR_START_RPM);
      expect(currentGear.value).toBe(1);
      expect(audioService.playSound).toHaveBeenCalledWith("engineStart");
      expect(ttsService.speak).toHaveBeenCalledWith("Engine started.");
    });

    it("should not start the engine if it is already on", async () => {
      const { startEngine } = useCar();
      await startEngine();
      vi.clearAllMocks();

      const message = await startEngine();

      expect(message).toBe("The engine is already running.");
      expect(audioService.playSound).not.toHaveBeenCalled();
    });

    it("should not start the engine when out of fuel", async () => {
      const { startEngine, fuelLevel } = useCar();
      fuelLevel.value = 0;

      const message = await startEngine();

      expect(message).toBe("Cannot start engine. The fuel tank is empty.");
      expect(audioService.playSound).not.toHaveBeenCalled();
    });

    it("stopEngine should turn the engine off", async () => {
      const { startEngine, stopEngine, engineStatus, rpm } = useCar();
      await startEngine();
      vi.clearAllMocks();

      const message = await stopEngine();

      expect(message).toBe("Engine stopped.");
      expect(engineStatus.value).toBe(false);
      expect(rpm.value).toBe(0);
      expect(audioService.playSound).toHaveBeenCalledWith("engineStop");
    });
  });

  describe("DRS", () => {
    it("activateDrs should fail when engine is off", async () => {
      const { activateDrs, drsStatus } = useCar();
      const message = await activateDrs();

      expect(message).toBe("Cannot activate DRS. The engine is off.");
      expect(drsStatus.value).toBe(false);
    });

    it("activateDrs should enable when engine is running", async () => {
      const { startEngine, activateDrs, drsStatus } = useCar();
      await startEngine();

      const message = await activateDrs();

      expect(message).toBe("DRS enabled.");
      expect(drsStatus.value).toBe(true);
      expect(audioService.playSound).toHaveBeenCalledWith("drsOn");
    });

    it("deactivateDrs should disable an active DRS", async () => {
      const { startEngine, activateDrs, deactivateDrs, drsStatus } = useCar();
      await startEngine();
      await activateDrs();

      const message = await deactivateDrs();

      expect(message).toBe("DRS disabled.");
      expect(drsStatus.value).toBe(false);
      expect(audioService.playSound).toHaveBeenCalledWith("drsOff");
    });

    it("deactivateDrs should report when DRS already off", async () => {
      const { deactivateDrs } = useCar();
      const message = await deactivateDrs();
      expect(message).toBe("DRS is already disabled.");
    });
  });

  describe("overtake", () => {
    it("should fail if engine is off", async () => {
      const { activateOvertake, overtakeActive } = useCar();

      const message = await activateOvertake();

      expect(message).toBe("Cannot activate overtake, engine is off.");
      expect(overtakeActive.value).toBe(false);
      expect(audioService.playSound).not.toHaveBeenCalled();
    });

    it("should fail if battery is too low", async () => {
      const { startEngine, activateOvertake, batteryLevel } = useCar();
      await startEngine();
      batteryLevel.value = CAR_SETTINGS.OVERTAKE_BATTERY_COST - 1;

      const message = await activateOvertake();

      expect(message).toBe("Not enough battery for overtake.");
      expect(audioService.playSound).not.toHaveBeenCalledWith("overtakeOn");
    });

    it("should activate and spend battery when conditions are met", async () => {
      const { startEngine, activateOvertake, overtakeActive, batteryLevel } =
        useCar();
      await startEngine();
      const before = batteryLevel.value;

      const message = await activateOvertake();

      expect(message).toBe("Overtake mode activated.");
      expect(overtakeActive.value).toBe(true);
      expect(batteryLevel.value).toBe(before - CAR_SETTINGS.OVERTAKE_BATTERY_COST);
      expect(audioService.playSound).toHaveBeenCalledWith("overtakeOn");
    });

    it("should report already active when overtake is already on", async () => {
      const { startEngine, activateOvertake } = useCar();
      await startEngine();

      // First call succeeds.
      await activateOvertake();
      vi.clearAllMocks();

      // Second call while still active.
      const message = await activateOvertake();

      expect(message).toBe("Overtake is already active.");
      expect(audioService.playSound).not.toHaveBeenCalled();
    });
  });

  describe("fuel mix", () => {
    it("setFuelMix should change the mix for valid modes", async () => {
      const { setFuelMix, fuelMix } = useCar();

      expect(await setFuelMix("LEAN")).toBe("Fuel mix set to Lean.");
      expect(fuelMix.value).toBe(FUEL_MIXES.LEAN);

      expect(await setFuelMix("rich")).toBe("Fuel mix set to Rich.");
      expect(fuelMix.value).toBe(FUEL_MIXES.RICH);
    });

    it("setFuelMix should reject unknown modes", async () => {
      const { setFuelMix, fuelMix } = useCar();
      const message = await setFuelMix("turbo");
      expect(message).toBe("Unknown fuel mix: turbo.");
      expect(fuelMix.value).toBe(FUEL_MIXES.STANDARD);
    });
  });

  describe("tire status", () => {
    it("reports Cold tires before the car runs", () => {
      const { tireStatus } = useCar();
      expect(tireStatus.value).toBe("Cold");
    });

    it("derives label from tire life", async () => {
      const { startEngine, tireStatus, tireLife } = useCar();
      await startEngine();

      tireLife.value = 90;
      expect(tireStatus.value).toBe("Optimal");
      tireLife.value = 50;
      expect(tireStatus.value).toBe("Used");
      tireLife.value = 10;
      expect(tireStatus.value).toBe("Worn");
    });
  });

  describe("pit stop", () => {
    it("refuels, recharges and fits new tires", async () => {
      vi.useFakeTimers();
      const { startEngine, fuelLevel, batteryLevel, tireLife, performPitStop } =
        useCar();
      await startEngine();
      fuelLevel.value = 20;
      batteryLevel.value = 30;
      tireLife.value = 15;

      const pitStop = performPitStop();
      await vi.advanceTimersByTimeAsync(CAR_SETTINGS.PIT_STOP_DURATION_MS);
      const message = await pitStop;

      expect(message).toBe("Pit stop complete. Car serviced.");
      expect(fuelLevel.value).toBe(100);
      expect(batteryLevel.value).toBe(100);
      expect(tireLife.value).toBe(100);
      vi.useRealTimers();
    });

    it("returns race complete message when the race is finished", async () => {
      const { performPitStop, raceFinished } = useCar();
      raceFinished.value = true;

      const message = await performPitStop();

      expect(message).toBe("Race complete.");
    });
  });

  describe("car selection", () => {
    it("rejects car selection while the engine is running", async () => {
      const { selectCar, startEngine } = useCar();
      await startEngine();

      const message = await selectCar("speedster");

      expect(message).toBe("Stop the engine before selecting a car.");
    });

    it("rejects unknown car IDs", async () => {
      const { selectCar, selectedCar } = useCar();
      const before = selectedCar.value.id;

      const message = await selectCar("nonexistent");

      expect(message).toBe("Unknown car: nonexistent.");
      expect(selectedCar.value.id).toBe(before);
    });
  });
});
