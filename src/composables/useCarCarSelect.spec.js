import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import { CAR_PRESETS } from "@/config";
import ttsService from "@/services/textToSpeechService";

describe("useCar - car selection", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  it("defaults to the Balanced car", () => {
    const { selectedCar } = useCar();
    expect(selectedCar.value.id).toBe("balanced");
    expect(selectedCar.value.label).toBe("Balanced");
  });

  it("selects a car by id when the engine is off", async () => {
    const { selectCar, selectedCar } = useCar();
    const message = await selectCar("speedster");

    expect(message).toBe("Speedster selected. Ready to race.");
    expect(selectedCar.value.id).toBe("speedster");
    expect(ttsService.speak).toHaveBeenCalledWith(
      "Speedster selected. Ready to race.",
    );
  });

  it("rejects unknown car ids", async () => {
    const { selectCar, selectedCar } = useCar();
    const message = await selectCar("rocket");

    expect(message).toBe("Unknown car: rocket.");
    expect(selectedCar.value.id).toBe("balanced");
  });

  it("blocks car selection while the engine is running", async () => {
    const { startEngine, selectCar, selectedCar } = useCar();
    await startEngine();

    const message = await selectCar("endurance");

    expect(message).toBe("Stop the engine before selecting a car.");
    expect(selectedCar.value.id).toBe("balanced");
  });

  it("blocks car selection while pitting", async () => {
    const { selectCar, selectedCar, pitting } = useCar();
    pitting.value = true;

    const message = await selectCar("gripmaster");

    expect(message).toBe("Stop the engine before selecting a car.");
    expect(selectedCar.value.id).toBe("balanced");
  });

  it("resets to Balanced on resetRace", async () => {
    const { selectCar, resetRace, selectedCar } = useCar();
    await selectCar("endurance");
    expect(selectedCar.value.id).toBe("endurance");

    await resetRace();

    expect(selectedCar.value.id).toBe("balanced");
  });

  it("preserves car selection through a pit stop", async () => {
    vi.useFakeTimers();
    const { selectCar, performPitStop, selectedCar, startEngine } = useCar();
    await selectCar("gripmaster");
    await startEngine();

    const pit = performPitStop();
    await vi.advanceTimersByTimeAsync(5000);
    await pit;

    expect(selectedCar.value.id).toBe("gripmaster");
    vi.useRealTimers();
  });

  it("Speedster consumes more fuel than Balanced at the same RPM", async () => {
    const { selectCar, runSimulationTick, fuelLevel, rpm, engineStatus } =
      useCar();
    engineStatus.value = true;
    rpm.value = 8000;

    // Balanced (default)
    fuelLevel.value = 100;
    runSimulationTick();
    const balancedUsage = 100 - fuelLevel.value;

    // Speedster — engine must be off to select a car.
    engineStatus.value = false;
    await selectCar("speedster");
    engineStatus.value = true;
    rpm.value = 8000;
    fuelLevel.value = 100;
    runSimulationTick();
    const speedsterUsage = 100 - fuelLevel.value;

    expect(speedsterUsage).toBeGreaterThan(balancedUsage);
  });

  it("Endurance wears tires slower than Balanced at the same RPM", async () => {
    const { selectCar, runSimulationTick, tireLife, rpm, engineStatus } =
      useCar();
    engineStatus.value = true;
    rpm.value = 8000;

    tireLife.value = 100;
    runSimulationTick();
    const balancedWear = 100 - tireLife.value;

    engineStatus.value = false;
    await selectCar("endurance");
    engineStatus.value = true;
    rpm.value = 8000;
    tireLife.value = 100;
    runSimulationTick();
    const enduranceWear = 100 - tireLife.value;

    expect(enduranceWear).toBeLessThan(balancedWear);
  });

  it("Grip Master has higher corner speed than Balanced", async () => {
    const { selectCar, speedKmh, rpm, engineStatus, lapProgress } = useCar();

    lapProgress.value = 170; // first corner (slow)
    engineStatus.value = true;
    rpm.value = 8000;
    const balancedSpeed = speedKmh.value;

    engineStatus.value = false;
    await selectCar("gripmaster");
    engineStatus.value = true;
    rpm.value = 8000;
    const gripSpeed = speedKmh.value;

    expect(gripSpeed).toBeGreaterThan(balancedSpeed);
  });

  it("Speedster has higher straight-line speed than Balanced", async () => {
    const { selectCar, speedKmh, rpm, engineStatus, lapProgress } = useCar();

    lapProgress.value = 10; // start of first straight
    engineStatus.value = true;
    rpm.value = 8000;
    const balancedSpeed = speedKmh.value;

    engineStatus.value = false;
    await selectCar("speedster");
    engineStatus.value = true;
    rpm.value = 8000;
    const speedsterSpeed = speedKmh.value;

    expect(speedsterSpeed).toBeGreaterThan(balancedSpeed);
  });
});
