// src/composables/useCar.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import audioService from "@/services/audioService";
import ttsService from "@/services/textToSpeechService";

// Mock the services
vi.mock("@/services/audioService", () => ({
  default: {
    loadSounds: vi.fn(),
    playSound: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@/services/textToSpeechService", () => ({
  default: {
    speak: vi.fn(() => Promise.resolve()),
  },
}));

describe("useCar Composable", () => {
  // Clear mock history before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Resetting state is tricky with this singleton pattern.
    // For robust testing, the composable could expose a `resetState` method.
    // For now, we'll test actions sequentially.
  });

  it("should have correct initial state", () => {
    const { engineStatus, rpm, fuelLevel } = useCar();
    expect(engineStatus.value).toBe(false);
    expect(rpm.value).toBe(0);
    expect(fuelLevel.value).toBe(100);
  });

  it("startEngine action should turn the engine on and set idle RPM", async () => {
    const { startEngine, engineStatus, rpm } = useCar();
    await startEngine();

    expect(engineStatus.value).toBe(true);
    expect(rpm.value).toBe(750);
    expect(audioService.playSound).toHaveBeenCalledWith("engineStart");
    expect(ttsService.speak).toHaveBeenCalledWith("Engine started.");
  });

  // --- CORRECTED TEST 1 ---
  it("should not start the engine if it is already on", async () => {
    const { startEngine, engineStatus } = useCar();

    // The engine is already on from the previous test
    expect(engineStatus.value).toBe(true);

    // Try to start again
    const responseMessage = await startEngine();

    // THE FIX: Check the response string directly, not response.message
    expect(responseMessage).toBe("The engine is already running.");

    // Ensure playSound was not called again
    expect(audioService.playSound).not.toHaveBeenCalled();
  });

  it("stopEngine action should turn the engine off", async () => {
    const { stopEngine, engineStatus, rpm } = useCar();

    // Engine is on, so we can test stopping it
    await stopEngine();

    expect(engineStatus.value).toBe(false);
    expect(rpm.value).toBe(0);
    expect(audioService.playSound).toHaveBeenCalledWith("engineStop");
    expect(ttsService.speak).toHaveBeenCalledWith("Engine stopped.");
  });

  it("activateDrs should provide feedback when engine is off", async () => {
    const { stopEngine, activateDrs } = useCar();

    await stopEngine();

    const responseMessage = await activateDrs();

    expect(responseMessage).toBe("Cannot activate DRS. The engine is off.");
    expect(ttsService.speak).toHaveBeenCalledWith(
      "Cannot activate DRS. The engine is off.",
    );
  });

  it("activateDrs should enable the system when engine is running", async () => {
    const { startEngine, stopEngine, activateDrs, drsStatus } = useCar();

    await startEngine();
    const responseMessage = await activateDrs();

    expect(responseMessage).toBe("DRS enabled.");
    expect(drsStatus.value).toBe(true);
    expect(audioService.playSound).toHaveBeenCalledWith("drsOn");
    expect(ttsService.speak).toHaveBeenCalledWith("DRS enabled.");

    await stopEngine();
  });

  // --- CORRECTED TEST 2 ---
  it("activateOvertake should fail if battery is too low", async () => {
    const { startEngine, activateOvertake, batteryLevel } = useCar();

    // Setup: Start engine and manually drain battery for the test
    await startEngine();
    batteryLevel.value = 10;

    const responseMessage = await activateOvertake();

    // THE FIX: Check the response string directly, not response.message
    expect(responseMessage).toBe("Not enough battery for overtake.");

    // Ensure overtake sound was not played
    expect(audioService.playSound).not.toHaveBeenCalledWith("overtakeOn");
  });
});
