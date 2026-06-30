// src/composables/useCarSimulation.js
//
// Core simulation logic extracted from useCar.js. All state lives in
// useCarState.js; this module only contains pure-ish simulation functions
// that read / write that shared state.
//
// Separating simulation from the orchestrator (useCar.js) keeps concerns
// clean: useCarSimulation = "how the car physics works", useCar.js = "what
// the driver (or test) can ask the car to do".

import {
  CAR_SETTINGS,
  TIRE_COMPOUNDS,
  WEATHER_CONDITIONS,
  QUALIFYING,
  WEATHER_SHIFT,
  TIRE_TEMP,
  DRS_DETECTION,
  PIT_WINDOW,
} from "@/config";
import engineAudioService from "@/services/engineAudioService";
import ttsService from "@/services/textToSpeechService";
import { t } from "@/i18n";
import {
  engineStatus,
  rpm,
  currentGear,
  currentSegmentIndex,
  drsStatus,
  drsEligible,
  overtakeActive,
  overheating,
  tireLife,
  tireTemp,
  tireTempStatus,
  tireTempWarned,
  fuelLevel,
  batteryLevel,
  engineTemp,
  currentLap,
  lapProgress,
  raceFinished,
  pitting,
  currentLapTime,
  lastLapTime,
  bestLapTime,
  leaderboard,
  carDamage,
  effectiveStats,
  ai,
  lowFuelWarned,
  lowBatteryWarned,
  overheatWarned,
  damageWarned,
  findSegmentAtProgress,
  sectorAtProgress,
  computeTireTempStatus,
  fuelMix,
  compoundConfig,
  ersConfig,
  weatherConfig,
  normalizedRpmRatio,
  clearOvertakeTimeout,
  setLastSegmentIndex,
  paceFactor,
  // Sector timing state
  currentSector,
  sectorTimes,
  bestSectorTimes,
  lastSectorTimes,
  // Qualifying state
  raceMode,
  qualifyingLapsRemaining,
  qualifyingResults,
  qualifyingBestLap,
  // Weather shift state
  nextWeather,
  weatherChangeLap,
  weatherChangeAnnounced,
  weather,
  // Pit window state
  pitWindowStart,
  pitWindowVisible,
  pitWindowUrgent,
} from "./useCarState";

// Pit urgent warning latch (local to this module)
let pitUrgentWarned = false;

// --- TRACK-AWARE GEAR LOGIC ---
const getTargetGearForSegment = (seg) => {
  if (seg.type === "straight") return CAR_SETTINGS.GEAR_COUNT;
  return CAR_SETTINGS.CORNER_TARGET_GEARS[seg.speed] || 3;
};

export const autoShift = () => {
  if (!engineStatus.value) {
    currentGear.value = 0;
    return;
  }

  if (currentGear.value === 0) {
    currentGear.value = 1;
    engineAudioService.onShiftUp();
    return;
  }

  const prevGear = currentGear.value;
  const segInfo = findSegmentAtProgress(lapProgress.value);
  const targetGear = getTargetGearForSegment(segInfo.segment);
  currentSegmentIndex.value = segInfo.index;
  setLastSegmentIndex(segInfo.index);

  // On a straight: upshift when RPM is high enough.
  if (currentGear.value < targetGear) {
    if (rpm.value >= CAR_SETTINGS.GEAR_SHIFT_RPM) {
      currentGear.value++;
      rpm.value = CAR_SETTINGS.GEAR_DROP_RPM;
    }
  }

  // In or entering a corner: drop gears toward the target (2/tick).
  if (currentGear.value > targetGear) {
    const drop = Math.min(2, currentGear.value - targetGear);
    currentGear.value -= drop;
    rpm.value = CAR_SETTINGS.GEAR_DROP_RPM;
  }

  // Safety downshift: RPM dropped to near-idle.
  if (rpm.value <= CAR_SETTINGS.RPM_IDLE + 500 && currentGear.value > 1) {
    currentGear.value--;
    rpm.value = CAR_SETTINGS.GEAR_DROP_RPM;
  }

  // Shift sounds.
  if (currentGear.value !== prevGear) {
    if (currentGear.value > prevGear) {
      engineAudioService.onShiftUp();
    } else {
      engineAudioService.onShiftDown();
    }
  }
};

// --- RECORD LAP ---
const recordLap = (lapNumber, timeMs) => {
  const time = Math.round(timeMs);
  lastLapTime.value = time;
  if (bestLapTime.value === null || time < bestLapTime.value) {
    bestLapTime.value = time;
  }
  const next = [...leaderboard.value, { lap: lapNumber, time }];
  next.sort((a, b) => a.time - b.time);
  leaderboard.value = next.slice(0, CAR_SETTINGS.LEADERBOARD_SIZE);

  // Track qualifying results
  if (raceMode.value === "qualifying") {
    if (qualifyingBestLap.value === null || time < qualifyingBestLap.value) {
      qualifyingBestLap.value = time;
    }
    qualifyingResults.value.push({ lap: lapNumber, time });
    qualifyingLapsRemaining.value = Math.max(0, QUALIFYING.LAPS - qualifyingResults.value.length);
  }
};

// --- SECTOR TIMING ---
const updateSectorTiming = () => {
  const prevSector = currentSector.value;
  const newSector = sectorAtProgress(lapProgress.value);
  if (newSector !== prevSector) {
    const sectorIdx = prevSector - 1;
    const prevSectorsSum = sectorTimes.value.slice(0, sectorIdx).reduce((a, b) => a + b, 0);
    const sectorTime = currentLapTime.value - prevSectorsSum;
    sectorTimes.value[sectorIdx] = sectorTime;
    if (bestSectorTimes.value[sectorIdx] === null || sectorTime < bestSectorTimes.value[sectorIdx]) {
      bestSectorTimes.value[sectorIdx] = sectorTime;
    }
    lastSectorTimes.value[sectorIdx] = sectorTime;
    currentSector.value = newSector;
  }
};

// --- LAP PROGRESS ---
const updateLapProgress = (ratio) => {
  if (raceFinished.value) return;

  currentLapTime.value += CAR_SETTINGS.LAP_TIME_PER_TICK_MS;

  // Tire temperature grip factor
  const tireGripFactor = (() => {
    if (tireTemp.value < TIRE_TEMP.COLD_THRESHOLD) return TIRE_TEMP.GRIP_COLD_FACTOR;
    if (tireTemp.value <= TIRE_TEMP.OPTIMAL_MAX) return TIRE_TEMP.GRIP_OPTIMAL_FACTOR;
    if (tireTemp.value <= TIRE_TEMP.CRITICAL_TEMP) return TIRE_TEMP.GRIP_HOT_FACTOR;
    return TIRE_TEMP.GRIP_COLD_FACTOR;
  })();

  const gearRatio = currentGear.value > 0
    ? (CAR_SETTINGS.GEAR_RATIOS[currentGear.value] || 0.5)
    : 0;
  const rawSpeed =
    effectiveStats.value.lapProgressBase *
    (0.3 + ratio * gearRatio) *
    weatherConfig().gripFactor *
    paceFactor.value *
    tireGripFactor;

  const startSeg = findSegmentAtProgress(lapProgress.value);
  const startCornerFactor =
    startSeg.segment.type === "corner"
      ? effectiveStats.value.cornerSpeedCap * tireGripFactor
      : 1.0;

  const drsBoost =
    drsStatus.value && startSeg.segment.type === "straight" ? 1.12 : 1.0;

  const beforeProgress = lapProgress.value;
  lapProgress.value += rawSpeed * startCornerFactor * drsBoost;

  const endSeg = findSegmentAtProgress(lapProgress.value);
  if (endSeg.index !== startSeg.index) {
    const endCornerFactor =
      endSeg.segment.type === "corner"
        ? effectiveStats.value.cornerSpeedCap
        : 1.0;
    lapProgress.value = beforeProgress + rawSpeed * endCornerFactor;
  }

  // Update sector timing on progress change
  updateSectorTiming();

  while (lapProgress.value >= CAR_SETTINGS.LAP_DISTANCE) {
    // Record final sector time for this lap
    const lastSectorIdx = currentSector.value - 1;
    const sectorTime = currentLapTime.value - sectorTimes.value.slice(0, lastSectorIdx).reduce((a, b) => a + b, 0);
    sectorTimes.value[lastSectorIdx] = sectorTime;
    if (bestSectorTimes.value[lastSectorIdx] === null || sectorTime < bestSectorTimes.value[lastSectorIdx]) {
      bestSectorTimes.value[lastSectorIdx] = sectorTime;
    }
    lastSectorTimes.value[lastSectorIdx] = sectorTime;

    lapProgress.value -= CAR_SETTINGS.LAP_DISTANCE;
    if (currentLapTime.value > 0) {
      recordLap(currentLap.value, currentLapTime.value);
    }
    currentLapTime.value = 0;
    // Reset sector timing for new lap
    sectorTimes.value = [0, 0, 0];
    currentSector.value = 1;
    // Clear DRS eligibility at start/finish
    drsEligible.value = false;
    // Check for qualifying session end (3 laps completed)
    if (raceMode.value === "qualifying" && qualifyingLapsRemaining.value <= 0) {
      raceFinished.value = true;
      lapProgress.value = 0;
      engineStatus.value = false;
      rpm.value = 0;
      currentGear.value = 0;
      drsStatus.value = false;
      overtakeActive.value = false;
      clearOvertakeTimeout();
      engineAudioService.stop();
      ttsService.speak(t("msg.qualiComplete"));
      return;
    }

    if (currentLap.value >= CAR_SETTINGS.TOTAL_LAPS) {
      raceFinished.value = true;
      lapProgress.value = 0;
      engineStatus.value = false;
      rpm.value = 0;
      currentGear.value = 0;
      drsStatus.value = false;
      overtakeActive.value = false;
      clearOvertakeTimeout();
      engineAudioService.stop();
      ttsService.speak(t("msg.checkeredFlag"));
      return;
    }
    currentLap.value += 1;
    ttsService.speak(t("msg.lapAnnounce", { lap: currentLap.value }));
  }
};

// --- TEMPERATURE ---
const updateTemperature = (ratio) => {
  let next = engineTemp.value;
  const heat = CAR_SETTINGS.TEMP_RISE_RATE * ratio;
  const cool = CAR_SETTINGS.TEMP_COOL_RATE * (1 - ratio);
  next += heat - cool;
  if (overtakeActive.value) next += CAR_SETTINGS.TEMP_OVERTAKE_PENALTY;
  next += weatherConfig().tempBias;
  engineTemp.value = parseFloat(
    Math.max(CAR_SETTINGS.TEMP_AMBIENT, next).toFixed(1),
  );
};

// --- TIRE TEMPERATURE ---
const updateTireTemperature = (ratio) => {
  let next = tireTemp.value;
  if (engineStatus.value && ratio > 0.1) {
    // Heat up while driving
    next += TIRE_TEMP.HEAT_RATE * ratio;
  } else {
    // Cool down while coasting/stopped
    next -= TIRE_TEMP.COOL_RATE;
  }
  // Ambient drift toward baseline
  if (next > TIRE_TEMP.BASELINE) next -= TIRE_TEMP.AMBIENT_COOL;
  else if (next < TIRE_TEMP.BASELINE) next += TIRE_TEMP.AMBIENT_COOL;
  // Weather bias: wet/storm cools tires, dry heat builds
  next += weatherConfig().tempBias * 0.3;
  // Clamp
  next = Math.max(20, Math.min(TIRE_TEMP.CRITICAL_TEMP + 20, next));
  tireTemp.value = parseFloat(next.toFixed(1));
  tireTempStatus.value = computeTireTempStatus(tireTemp.value);

  // Tire temp warning (only once per crossing into critical)
  if (tireTemp.value >= TIRE_TEMP.CRITICAL_TEMP && !tireTempWarned.value) {
    tireTempWarned.value = true;
    ttsService.speak(t("msg.warnTireTemp"));
  } else if (tireTemp.value < TIRE_TEMP.CRITICAL_TEMP) {
    tireTempWarned.value = false;
  }
};

// --- DRS ELIGIBILITY ---
// Check if the player is in the DRS detection zone and close enough to the
// AI rival. Sets drsEligible so the DRS activation button will work.
const updateDrsEligibility = () => {
  if (!ai.enabled.value || !engineStatus.value) {
    drsEligible.value = false;
    return;
  }

  // Find which segment we're currently in
  const seg = findSegmentAtProgress(lapProgress.value);

  if (seg.index === DRS_DETECTION.DETECTION_SEGMENT) {
    // We're on the DRS detection segment. Check gap to rival.
    const playerProg = (currentLap.value - 1) + (lapProgress.value / CAR_SETTINGS.LAP_DISTANCE);
    const rivalProg = (ai.currentLap.value - 1) + ai.lapProgress.value;
    const gap = playerProg - rivalProg;

    // DRS works when trailing (behind) the rival, within threshold
    if (gap < 0 && Math.abs(gap) <= DRS_DETECTION.ELIGIBILITY_GAP_LAPS) {
      drsEligible.value = true;
    }
  } else if (drsEligible.value) {
    // Clear DRS eligibility when exiting the detection segment
    drsEligible.value = false;
  }
};

// --- PIT WINDOW STRATEGY ---
// Project tire-wear and fuel-consumption rates to recommend the optimal
// pit-stop lap. Updates reactive state the UI reads.
const updatePitWindow = () => {
  if (raceFinished.value || raceMode.value === "qualifying") {
    pitWindowVisible.value = false;
    return;
  }

  // Estimate wear per lap from current simulation rates
  const ratio = normalizedRpmRatio();
  const wearPerTick =
    effectiveStats.value.tireWearRate *
    (1 + ratio) *
    compoundConfig().wearFactor *
    weatherConfig().wearFactor;
  const ticksPerLap = CAR_SETTINGS.LAP_DISTANCE / (CAR_SETTINGS.LAP_PROGRESS_BASE * 0.8);
  const wearPerLap = wearPerTick * ticksPerLap;
  const lapsOfTireLifeRemaining = wearPerLap > 0 ? tireLife.value / wearPerLap : 99;

  // Estimate fuel per lap
  const baseConsumptionRate =
    effectiveStats.value.fuelRate[fuelMix.value.toUpperCase()] ||
    effectiveStats.value.fuelRate.STANDARD;
  const rpmMultiplier =
    CAR_SETTINGS.RPM_MULTIPLIER_MIN +
    ratio * (CAR_SETTINGS.RPM_MULTIPLIER_MAX - CAR_SETTINGS.RPM_MULTIPLIER_MIN);
  const fuelPerTick = baseConsumptionRate * rpmMultiplier;
  const fuelPerLap = fuelPerTick * ticksPerLap;
  const lapsOfFuelRemaining = fuelPerLap > 0 ? fuelLevel.value / fuelPerLap : 99;

  const limitingLaps = Math.min(lapsOfTireLifeRemaining, lapsOfFuelRemaining);
  const currentLapNumber = currentLap.value;

  if (limitingLaps <= PIT_WINDOW.SHOW_WINDOW_LAPS && !raceFinished.value) {
    pitWindowVisible.value = true;
    pitWindowStart.value = currentLapNumber + Math.max(0, Math.ceil(limitingLaps - PIT_WINDOW.SUGGEST_AHEAD_LAPS));
    pitWindowUrgent.value = limitingLaps <= PIT_WINDOW.URGENT_LAPS_REMAINING;

    // "Box now" TTS announcement (once per transition)
    if (pitWindowUrgent.value && !pitUrgentWarned) {
      pitUrgentWarned = true;
      ttsService.speak(t("msg.pitWindowUrgent", { lap: pitWindowStart.value }));
    }
  } else {
    pitWindowVisible.value = false;
    pitWindowStart.value = null;
    pitWindowUrgent.value = false;
    pitUrgentWarned = false;
  }
};

// --- WEATHER SHIFT ---
const checkWeatherShift = () => {
  if (!WEATHER_SHIFT.ENABLED) return;
  if (nextWeather.value === null || weatherChangeLap.value === 0) return;
  if (raceMode.value === "qualifying") return; // No weather shifts in qualifying

  // Announce weather change FORECAST_LAPS laps in advance (only once)
  if (!weatherChangeAnnounced.value && currentLap.value >= weatherChangeLap.value - WEATHER_SHIFT.FORECAST_LAPS) {
    weatherChangeAnnounced.value = true;
    ttsService.speak(t("msg.weatherChangeAnnounce", { weather: nextWeather.value }));
  }

  // Apply weather change
  if (currentLap.value >= weatherChangeLap.value) {
    weather.value = nextWeather.value;
    nextWeather.value = null;
    weatherChangeLap.value = 0;
    ttsService.speak(t("msg.weatherChanged", { weather: weather.value }));
  }
};

// Schedule a random weather shift: pick a lap and a different condition.
// Exported so useCar.js can call it when the race simulation starts.
export const scheduleWeatherShift = () => {
  if (!WEATHER_SHIFT.ENABLED || raceMode.value === "qualifying") return;

  const changeLap = Math.floor(
    Math.random() * (WEATHER_SHIFT.CHANGE_LAP_MAX - WEATHER_SHIFT.CHANGE_LAP_MIN + 1)
  ) + WEATHER_SHIFT.CHANGE_LAP_MIN;

  // Pick a different weather condition (not the current one)
  const conditions = Object.values(WEATHER_CONDITIONS);
  const currentIdx = conditions.findIndex((c) => c.label === weather.value);
  let nextIdx;
  do {
    nextIdx = Math.floor(Math.random() * conditions.length);
  } while (nextIdx === currentIdx && conditions.length > 1);

  nextWeather.value = conditions[nextIdx].label;
  weatherChangeLap.value = changeLap;
  weatherChangeAnnounced.value = false;
};

// --- DAMAGE ---
const updateDamage = () => {
  let added = 0;
  if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL) {
    added += CAR_SETTINGS.DAMAGE_OVERHEAT_RATE;
  }
  if (tireLife.value <= 0) {
    added += CAR_SETTINGS.DAMAGE_WORN_TIRE_RATE;
  }
  // Overheated tires stress suspension/components
  if (tireTemp.value >= TIRE_TEMP.CRITICAL_TEMP) {
    added += CAR_SETTINGS.DAMAGE_OVERHEAT_RATE * 0.3;
  }
  if (added > 0) {
    carDamage.value = parseFloat(
      Math.min(100, carDamage.value + added).toFixed(2),
    );
  }
};

// --- WARNINGS ---
const checkWarnings = () => {
  const isLowFuel = fuelLevel.value < CAR_SETTINGS.LOW_FUEL_THRESHOLD;
  const isLowBattery = batteryLevel.value < CAR_SETTINGS.LOW_BATTERY_THRESHOLD;

  if (isLowFuel && !lowFuelWarned.value) {
    lowFuelWarned.value = true;
    ttsService.speak(t("msg.warnFuel"));
  } else if (!isLowFuel) {
    lowFuelWarned.value = false;
  }

  if (isLowBattery && !lowBatteryWarned.value) {
    lowBatteryWarned.value = true;
    ttsService.speak(t("msg.warnBattery"));
  } else if (!isLowBattery) {
    lowBatteryWarned.value = false;
  }

  if (engineTemp.value > CAR_SETTINGS.TEMP_OPTIMAL_MAX && !overheatWarned.value) {
    overheatWarned.value = true;
    ttsService.speak(t("msg.warnTemp"));
  } else if (engineTemp.value <= CAR_SETTINGS.TEMP_OPTIMAL_MAX) {
    overheatWarned.value = false;
  }

  const damageCritical = carDamage.value >= CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD;
  if (damageCritical && !damageWarned.value) {
    damageWarned.value = true;
    ttsService.speak(t("msg.warnDamage"));
  } else if (!damageCritical) {
    damageWarned.value = false;
  }
};

// --- STALL ---
export const stallEngine = async () => {
  clearOvertakeTimeout();
  engineStatus.value = false;
  rpm.value = 0;
  currentGear.value = 0;
  drsStatus.value = false;
  overtakeActive.value = false;
  engineAudioService.stop();
  await ttsService.speak(t("msg.stalling"));
};

// --- OVERHEAT ---
export const overheatEngine = async () => {
  clearOvertakeTimeout();
  overheating.value = true;
  drsStatus.value = false;
  overtakeActive.value = false;
  rpm.value = CAR_SETTINGS.RPM_IDLE;
  currentGear.value = 0;
  await ttsService.speak(t("msg.overheatCut"));
};

// --- MAIN SIMULATION TICK ---
export const runSimulationTick = () => {
  if (pitting.value) return;
  const ratio = normalizedRpmRatio();

  // Fuel consumption.
  const baseConsumptionRate =
    effectiveStats.value.fuelRate[fuelMix.value.toUpperCase()] ||
    effectiveStats.value.fuelRate.STANDARD;
  const rpmMultiplier =
    CAR_SETTINGS.RPM_MULTIPLIER_MIN +
    ratio * (CAR_SETTINGS.RPM_MULTIPLIER_MAX - CAR_SETTINGS.RPM_MULTIPLIER_MIN);
  const totalConsumptionRate = baseConsumptionRate * rpmMultiplier;

  if (fuelLevel.value > 0) {
    fuelLevel.value = parseFloat(
      Math.max(0, fuelLevel.value - totalConsumptionRate).toFixed(2),
    );
  }

  // Tire wear (with tire temperature multiplier).
  if (tireLife.value > 0) {
    const tireWearTempFactor = (() => {
      if (tireTemp.value < TIRE_TEMP.COLD_THRESHOLD) return TIRE_TEMP.WEAR_COLD_FACTOR;
      if (tireTemp.value <= TIRE_TEMP.OPTIMAL_MAX) return 1.0;
      return TIRE_TEMP.WEAR_HOT_FACTOR;
    })();
    const wear =
      effectiveStats.value.tireWearRate *
      (1 + ratio) *
      compoundConfig().wearFactor *
      weatherConfig().wearFactor *
      tireWearTempFactor;
    tireLife.value = parseFloat(
      Math.max(0, tireLife.value - wear).toFixed(2),
    );
  }

  // Battery recharge.
  if (batteryLevel.value < 100) {
    const recharge =
      CAR_SETTINGS.BATTERY_RECHARGE_RATE * ersConfig().rechargeFactor;
    batteryLevel.value = parseFloat(
      Math.min(100, batteryLevel.value + recharge).toFixed(2),
    );
  }

  updateTemperature(ratio);
  updateTireTemperature(ratio);
  updateDamage();
  updateLapProgress(ratio);
  checkWeatherShift();
  updateDrsEligibility();
  updatePitWindow();
  ai.tick();
  checkWarnings();

  // RPM climbs while engine is running.
  if (engineStatus.value && !overheating.value) {
    rpm.value = Math.min(
      CAR_SETTINGS.RPM_MAX,
      rpm.value + effectiveStats.value.gearRpmClimb,
    );
  }

  autoShift();

  if (engineAudioService.isActive) {
    engineAudioService.setRpm(rpm.value);
  }

  // Out of fuel: stall.
  if (fuelLevel.value <= 0 && engineStatus.value) {
    stallEngine();
    return;
  }

  // Overheating check.
  if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL && engineStatus.value) {
    overheatEngine();
  } else if (overheating.value && engineTemp.value < CAR_SETTINGS.TEMP_OPTIMAL_MAX) {
    overheating.value = false;
  }
};
