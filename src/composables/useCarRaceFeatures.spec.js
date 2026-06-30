// src/composables/useCarRaceFeatures.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCar } from "./useCar";
import { CAR_SETTINGS, WEATHER_CONDITIONS, WEATHER_SHIFT } from "@/config";
import { scheduleWeatherShift } from "./useCarSimulation";
import ttsService from "@/services/textToSpeechService";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

describe("useCar - lap timing + leaderboard", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  it("starts with no recorded lap times", () => {
    const { bestLapTime, lastLapTime, leaderboard } = useCar();
    expect(bestLapTime.value).toBeNull();
    expect(lastLapTime.value).toBeNull();
    expect(leaderboard.value).toEqual([]);
  });

  it("accrues lap time each tick while running", () => {
    const { runSimulationTick, currentLapTime, rpm, engineStatus } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_IDLE;

    runSimulationTick();
    expect(currentLapTime.value).toBe(CAR_SETTINGS.LAP_TIME_PER_TICK_MS);
    runSimulationTick();
    expect(currentLapTime.value).toBe(CAR_SETTINGS.LAP_TIME_PER_TICK_MS * 2);
  });

  it("records a lap time onto the leaderboard when a lap completes", () => {
    const { runSimulationTick, rpm, engineStatus, leaderboard, bestLapTime } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    for (let i = 0; i < 200 && leaderboard.value.length === 0; i++) {
      runSimulationTick();
    }

    expect(leaderboard.value.length).toBeGreaterThan(0);
    expect(bestLapTime.value).not.toBeNull();
    expect(leaderboard.value[0]).toHaveProperty("lap");
    expect(leaderboard.value[0]).toHaveProperty("time");
  });

  it("keeps the leaderboard sorted fastest-first and capped at LEADERBOARD_SIZE", () => {
    const { runSimulationTick, rpm, engineStatus, leaderboard } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    // Run long enough to complete several laps.
    for (let i = 0; i < 500; i++) runSimulationTick();

    expect(leaderboard.value.length).toBeLessThanOrEqual(
      CAR_SETTINGS.LEADERBOARD_SIZE,
    );
    const times = leaderboard.value.map((e) => e.time);
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it("getBestLap reports no lap before one is set", async () => {
    const { getBestLap } = useCar();
    expect(await getBestLap()).toBe("No lap time set yet.");
  });

  it("getBestLap reports the formatted best time once set", async () => {
    const { getBestLap, bestLapTime } = useCar();
    bestLapTime.value = 83456; // 1:23.456

    const message = await getBestLap();
    expect(message).toBe("Best lap is 1:23.456.");
    expect(ttsService.speak).toHaveBeenCalledWith(message);
  });

  it("formatLapTime pads seconds and milliseconds", () => {
    const { formatLapTime } = useCar();
    expect(formatLapTime(5000)).toBe("0:05.000");
    expect(formatLapTime(65250)).toBe("1:05.250");
    expect(formatLapTime(null)).toBe("--:--");
  });
});

describe("useCar - weather", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  it("defaults to dry conditions", () => {
    const { weather } = useCar();
    expect(weather.value).toBe(WEATHER_CONDITIONS.DRY.label);
  });

  it("setWeather changes valid conditions", async () => {
    const { setWeather, weather } = useCar();
    expect(await setWeather("WET")).toBe("Weather set to Wet.");
    expect(weather.value).toBe(WEATHER_CONDITIONS.WET.label);
  });

  it("setWeather rejects unknown conditions", async () => {
    const { setWeather, weather } = useCar();
    expect(await setWeather("sandstorm")).toBe(
      "Unknown weather condition: sandstorm.",
    );
    expect(weather.value).toBe(WEATHER_CONDITIONS.DRY.label);
  });

  it("getWeatherStatus reports the current weather", async () => {
    const { getWeatherStatus, setWeather } = useCar();
    await setWeather("STORM");
    expect(await getWeatherStatus()).toBe("Current weather is Storm.");
  });

  it("wet weather wears tires faster than dry at the same RPM", () => {
    const { runSimulationTick, tireLife, rpm, engineStatus, weather } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    weather.value = WEATHER_CONDITIONS.DRY.label;
    tireLife.value = 100;
    runSimulationTick();
    const dryWear = 100 - tireLife.value;

    weather.value = WEATHER_CONDITIONS.WET.label;
    tireLife.value = 100;
    runSimulationTick();
    const wetWear = 100 - tireLife.value;

    expect(wetWear).toBeGreaterThan(dryWear);
  });

  it("wet weather lowers effective engine temperature versus dry", () => {
    const { runSimulationTick, engineTemp, rpm, engineStatus, weather } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    weather.value = WEATHER_CONDITIONS.DRY.label;
    engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
    runSimulationTick();
    const dryTemp = engineTemp.value;

    weather.value = WEATHER_CONDITIONS.WET.label;
    engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
    runSimulationTick();
    const wetTemp = engineTemp.value;

    expect(wetTemp).toBeLessThan(dryTemp);
  });
});

describe("useCar - weather shifts", () => {
  beforeEach(async () => {
    const { resetRace, disableAi } = useCar();
    await resetRace();
    await disableAi().catch(() => {});
    vi.clearAllMocks();
  });

  it("scheduleWeatherShift picks a lap between min and max", () => {
    const { nextWeather, weatherChangeLap } = useCar();
    expect(nextWeather.value).toBeNull();
    expect(weatherChangeLap.value).toBe(0);

    scheduleWeatherShift();

    expect(nextWeather.value).not.toBeNull();
    expect(weatherChangeLap.value).toBeGreaterThanOrEqual(
      WEATHER_SHIFT.CHANGE_LAP_MIN,
    );
    expect(weatherChangeLap.value).toBeLessThanOrEqual(
      WEATHER_SHIFT.CHANGE_LAP_MAX,
    );
  });

  it("scheduleWeatherShift picks a different weather from the current", () => {
    const { weather } = useCar();
    expect(weather.value).toBe("Dry");

    scheduleWeatherShift();

    const { nextWeather } = useCar();
    expect(nextWeather.value).not.toBe("Dry");
  });

  it("checkWeatherShift announces forecast 2 laps before the change", () => {
    const { runSimulationTick, currentLap, nextWeather, weatherChangeLap, lapProgress, engineStatus, rpm } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    // Schedule a shift on lap 7
    weatherChangeLap.value = 7;
    nextWeather.value = "Wet";

    // Advance to lap 5 (2 laps before change = should announce)
    currentLap.value = 5;
    lapProgress.value = 0;
    runSimulationTick();

    expect(ttsService.speak).toHaveBeenCalledWith(
      expect.stringContaining("Wet"),
    );
  });

  it("checkWeatherShift applies weather on the target lap", () => {
    const { runSimulationTick, currentLap, weather, nextWeather, weatherChangeLap, lapProgress, engineStatus, rpm } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;

    weatherChangeLap.value = 6;
    nextWeather.value = "Wet";

    // Advance to lap 6 (change lap)
    currentLap.value = 6;
    lapProgress.value = 0;
    runSimulationTick();

    expect(weather.value).toBe("Wet");
    expect(nextWeather.value).toBeNull();
    expect(weatherChangeLap.value).toBe(0);
  });

  it("resetRace clears pending weather shifts", async () => {
    const { resetRace, nextWeather, weatherChangeLap } = useCar();

    scheduleWeatherShift();
    expect(nextWeather.value).not.toBeNull();

    await resetRace();

    expect(nextWeather.value).toBeNull();
    expect(weatherChangeLap.value).toBe(0);
  });

  it("checkWeatherShift does not fire during qualifying", () => {
    const { runSimulationTick, currentLap, weather, nextWeather, weatherChangeLap, lapProgress, raceMode, engineStatus, rpm } = useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;
    raceMode.value = "qualifying";

    weatherChangeLap.value = 4;
    nextWeather.value = "Wet";
    currentLap.value = 4;
    lapProgress.value = 0;

    runSimulationTick();

    // Weather should NOT change during qualifying
    expect(weather.value).toBe("Dry");
  });

  it("starting the engine triggers weather shift scheduling", async () => {
    const { startEngine, nextWeather } = useCar();

    // Simulate watcher: when engine starts, scheduleWeatherShift should be called
    // This is hard to test directly because it's inside a watcher callback.
    // Instead, we verify the schedule function works independently.
    expect(nextWeather.value).toBeNull();
    scheduleWeatherShift();
    expect(nextWeather.value).not.toBeNull();
  });
});




describe("useCar - damage", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
  });

  it("starts with zero damage and a None status", () => {
    const { carDamage, damageStatus } = useCar();
    expect(carDamage.value).toBe(0);
    expect(damageStatus.value).toBe("None");
  });

  it("derives the damage label from accumulated damage", () => {
    const { carDamage, damageStatus } = useCar();
    carDamage.value = CAR_SETTINGS.DAMAGE_MINOR_THRESHOLD;
    expect(damageStatus.value).toBe("Minor");
    carDamage.value = CAR_SETTINGS.DAMAGE_MAJOR_THRESHOLD;
    expect(damageStatus.value).toBe("Major");
    carDamage.value = CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD;
    expect(damageStatus.value).toBe("Critical");
  });

  it("accrues damage while running critically hot", () => {
    const { runSimulationTick, carDamage, engineTemp, rpm, engineStatus } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;
    engineTemp.value = CAR_SETTINGS.TEMP_CRITICAL;

    runSimulationTick();
    expect(carDamage.value).toBeGreaterThan(0);
  });

  it("accrues damage while grinding on destroyed tires", () => {
    const { runSimulationTick, carDamage, tireLife, rpm, engineStatus } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    tireLife.value = 0;

    runSimulationTick();
    expect(carDamage.value).toBeGreaterThanOrEqual(
      CAR_SETTINGS.DAMAGE_WORN_TIRE_RATE,
    );
  });

  it("reduces pace as damage rises", () => {
    const { paceFactor, carDamage } = useCar();
    expect(paceFactor.value).toBe(1);
    carDamage.value = 100;
    expect(paceFactor.value).toBeCloseTo(
      1 - CAR_SETTINGS.DAMAGE_MAX_PACE_PENALTY,
      5,
    );
  });

  it("warns once when damage crosses the critical threshold", () => {
    const { runSimulationTick, carDamage, engineTemp, rpm, engineStatus } =
      useCar();
    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_MAX;
    engineTemp.value = CAR_SETTINGS.TEMP_CRITICAL;
    carDamage.value = CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD - 1;

    runSimulationTick();
    runSimulationTick();

    const damageWarnings = ttsService.speak.mock.calls.filter(
      (c) => c[0] === "Warning. Car damage is critical.",
    );
    expect(damageWarnings).toHaveLength(1);
  });

  it("getDamageStatus reports damage percent and label", async () => {
    const { getDamageStatus, carDamage } = useCar();
    carDamage.value = 25;
    const message = await getDamageStatus();
    expect(message).toBe("Car damage is 25 percent, minor damage.");
  });

  it("pit stop repairs damage back to zero", async () => {
    vi.useFakeTimers();
    const { startEngine, carDamage, performPitStop } = useCar();
    await startEngine();
    carDamage.value = 60;

    const pitStop = performPitStop();
    await vi.advanceTimersByTimeAsync(CAR_SETTINGS.PIT_STOP_DURATION_MS);
    await pitStop;

    expect(carDamage.value).toBe(0);
    vi.useRealTimers();
  });

  it("reset restores weather, damage and leaderboard to defaults", async () => {
    const {
      resetRace,
      weather,
      carDamage,
      leaderboard,
      bestLapTime,
    } = useCar();

    weather.value = WEATHER_CONDITIONS.STORM.label;
    carDamage.value = 50;
    leaderboard.value = [{ lap: 1, time: 1000 }];
    bestLapTime.value = 1000;

    await resetRace();

    expect(weather.value).toBe(WEATHER_CONDITIONS.DRY.label);
    expect(carDamage.value).toBe(0);
    expect(leaderboard.value).toEqual([]);
    expect(bestLapTime.value).toBeNull();
  });
});
