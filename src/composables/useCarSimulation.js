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
  overtakeActive,
  overheating,
  tireLife,
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
  fuelMix,
  compoundConfig,
  ersConfig,
  weatherConfig,
  normalizedRpmRatio,
  clearOvertakeTimeout,
  setLastSegmentIndex,
  paceFactor,
} from "./useCarState";

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
};

// --- LAP PROGRESS ---
const updateLapProgress = (ratio) => {
  if (raceFinished.value) return;

  currentLapTime.value += CAR_SETTINGS.LAP_TIME_PER_TICK_MS;

  const gearRatio = currentGear.value > 0
    ? (CAR_SETTINGS.GEAR_RATIOS[currentGear.value] || 0.5)
    : 0;
  const rawSpeed =
    effectiveStats.value.lapProgressBase *
    (0.3 + ratio * gearRatio) *
    weatherConfig().gripFactor *
    paceFactor.value;

  const startSeg = findSegmentAtProgress(lapProgress.value);
  const startCornerFactor =
    startSeg.segment.type === "corner"
      ? effectiveStats.value.cornerSpeedCap
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

  while (lapProgress.value >= CAR_SETTINGS.LAP_DISTANCE) {
    lapProgress.value -= CAR_SETTINGS.LAP_DISTANCE;
    if (currentLapTime.value > 0) {
      recordLap(currentLap.value, currentLapTime.value);
    }
    currentLapTime.value = 0;
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

// --- DAMAGE ---
const updateDamage = () => {
  let added = 0;
  if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL) {
    added += CAR_SETTINGS.DAMAGE_OVERHEAT_RATE;
  }
  if (tireLife.value <= 0) {
    added += CAR_SETTINGS.DAMAGE_WORN_TIRE_RATE;
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

  // Tire wear.
  if (tireLife.value > 0) {
    const wear =
      effectiveStats.value.tireWearRate *
      (1 + ratio) *
      compoundConfig().wearFactor *
      weatherConfig().wearFactor;
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
  updateDamage();
  updateLapProgress(ratio);
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
