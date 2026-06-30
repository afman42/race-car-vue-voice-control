// src/composables/useCarState.js
//
// Module-scoped singleton state for the car simulation. Every composable
// that imports from this file shares the same reactive instances.
//
// Separated from useCar.js to keep the orchestrator focused on coordination
// and to keep simulation state in one place.

import { ref, computed } from "vue";
import {
  CAR_SETTINGS,
  CAR_PRESETS,
  FUEL_MIXES,
  TIRE_COMPOUNDS,
  ERS_MODES,
  WEATHER_CONDITIONS,
  QUALIFYING,
  TIRE_TEMP,
  DRS_DETECTION,
} from "@/config";
import audioService from "@/services/audioService";
import { t } from "@/i18n";
import { useAiRival } from "@/composables/useAiRival";

// Maps a canonical status label to its i18n key for spoken output.
export const STATUS_KEYS = {
  Cold: "status.cold",
  Optimal: "status.optimal",
  Used: "status.used",
  Worn: "status.worn",
  Hot: "status.hot",
  Critical: "status.critical",
  None: "status.none",
  Minor: "status.minor",
  Major: "status.major",
};

export const statusWord = (label) => t(STATUS_KEYS[label] || "status.optimal");

if (typeof window !== "undefined" && typeof window.Audio !== "undefined") {
  audioService.loadSounds();
}

// --- SHARED STATE (SINGLETON PATTERN) ---
export const engineStatus = ref(false);
export const rpm = ref(0);
export const currentGear = ref(0); // 0 = neutral, 1-7 = in gear
export const currentSegmentIndex = ref(0);
export const drsStatus = ref(false);
export const overtakeActive = ref(false);
export const tireLife = ref(100);
export const tireCompound = ref(TIRE_COMPOUNDS.MEDIUM.label);
export const fuelLevel = ref(100);
export const batteryLevel = ref(100);
export const fuelMix = ref(FUEL_MIXES.STANDARD);
export const ersMode = ref(ERS_MODES.BALANCED.label);
export const engineTemp = ref(CAR_SETTINGS.TEMP_AMBIENT);
export const overheating = ref(false);
export const currentLap = ref(1);
export const lapProgress = ref(0);
export const raceFinished = ref(false);
export const pitting = ref(false);

// Lap timing + leaderboard
export const currentLapTime = ref(0);
export const lastLapTime = ref(null);
export const bestLapTime = ref(null);
export const leaderboard = ref([]);

// Weather + damage
export const weather = ref(WEATHER_CONDITIONS.DRY.label);
export const carDamage = ref(0);

// Tire temperature (degrees). Starts at optimal baseline, heats while driving.
export const tireTemp = ref(TIRE_TEMP.BASELINE);
export const tireTempStatus = ref("Optimal");
export const tireTempWarned = ref(false);

// DRS eligibility — computed each tick when the player enters the detection zone.
export const drsEligible = ref(false);

// Pit window strategy: recommended pit stop lap based on tire/fuel projections.
export const pitWindowStart = ref(null); // lap number to recommend pitting
export const pitWindowVisible = ref(false); // show the pit window indicator
export const pitWindowUrgent = ref(false); // true = "box now"

// Sector timing (3 sectors per lap)
export const sectorTimes = ref([0, 0, 0]); // current lap sector times
export const bestSectorTimes = ref([null, null, null]); // best sector 1/2/3
export const lastSectorTimes = ref([null, null, null]); // last lap sectors
export const currentSector = ref(1); // 1, 2, or 3

// Dynamic weather shift state
export const nextWeather = ref(null); // pending weather label, null = none
export const weatherChangeLap = ref(0); // lap on which weather will change, 0 = none
export const weatherChangeAnnounced = ref(false); // latch for TTS forecast

// Qualifying mode (3-lap shootout)
export const raceMode = ref("race"); // "race" | "qualifying"
export const qualifyingLapsRemaining = ref(QUALIFYING.LAPS);
export const qualifyingResults = ref([]); // { lap, time } for player
export const qualifyingBestLap = ref(null);
export const qualifyingPosition = ref(1); // 1 or 2 based on quali comparison

// Selected car preset
export const selectedCar = ref(CAR_PRESETS[1]); // default: Balanced

// Effective stats computed from the selected car's multipliers.
export const effectiveStats = computed(() => {
  const s = selectedCar.value.stats;
  return {
    lapProgressBase: CAR_SETTINGS.LAP_PROGRESS_BASE * s.speedMul,
    cornerSpeedCap: Math.min(1, CAR_SETTINGS.CORNER_SPEED_CAP * s.gripMul),
    tireWearRate: CAR_SETTINGS.TIRE_WEAR_RATE * s.wearMul,
    fuelRate: {
      LEAN: CAR_SETTINGS.FUEL_CONSUMPTION_RATE.LEAN * s.fuelMul,
      STANDARD: CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD * s.fuelMul,
      RICH: CAR_SETTINGS.FUEL_CONSUMPTION_RATE.RICH * s.fuelMul,
    },
    gearRpmClimb: CAR_SETTINGS.GEAR_RPM_CLIMB * s.tempoMul,
  };
});

// AI rival singleton (lap-time generator)
export const ai = useAiRival();

// Module-scoped variables for the simulation lifecycle.
export let simulationInterval = null;
export let overtakeTimeout = null;
export let lastSegmentIndex = -1;
export let simWatcherRegistered = false;

// Warning latches — each crossing triggers exactly one voice alert.
export const lowFuelWarned = ref(false);
export const lowBatteryWarned = ref(false);
export const overheatWarned = ref(false);
export const damageWarned = ref(false);

// Allow the watcher / cleanup in useCar to clear these.
export function clearSimulationInterval() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

export function setSimulationInterval(interval) {
  simulationInterval = interval;
}

export function clearOvertakeTimeout() {
  if (overtakeTimeout) {
    clearTimeout(overtakeTimeout);
    overtakeTimeout = null;
  }
}

export function setOvertakeTimeout(timeout) {
  overtakeTimeout = timeout;
}

export function setLastSegmentIndex(index) {
  lastSegmentIndex = index;
}

export function setSimWatcherRegistered(val) {
  simWatcherRegistered = val;
}

// Find which track segment a lap progress value falls within.
// Handles wrapping so progress > LAP_DISTANCE wraps back to the start.
export const findSegmentAtProgress = (progress) => {
  const safeProgress = ((progress % CAR_SETTINGS.LAP_DISTANCE) + CAR_SETTINGS.LAP_DISTANCE) % CAR_SETTINGS.LAP_DISTANCE;
  let accumulated = 0;
  for (let i = 0; i < CAR_SETTINGS.TRACK_LAYOUT.length; i++) {
    accumulated += CAR_SETTINGS.TRACK_LAYOUT[i].length;
    if (safeProgress < accumulated) {
      return { index: i, segment: CAR_SETTINGS.TRACK_LAYOUT[i] };
    }
  }
  return { index: 0, segment: CAR_SETTINGS.TRACK_LAYOUT[0] };
};

// Pace multiplier: how much of the car's potential speed is available
// after damage. At full damage the car keeps (1 - DAMAGE_MAX_PACE_PENALTY).
export const paceFactor = computed(() => {
  const penalty =
    (carDamage.value / 100) * CAR_SETTINGS.DAMAGE_MAX_PACE_PENALTY;
  return Math.max(0, 1 - penalty);
});

// Configuration helpers
export const compoundConfig = () =>
  Object.values(TIRE_COMPOUNDS).find(
    (c) => c.label === tireCompound.value,
  ) || TIRE_COMPOUNDS.MEDIUM;

export const ersConfig = () =>
  Object.values(ERS_MODES).find((m) => m.label === ersMode.value) ||
  ERS_MODES.BALANCED;

// Compute tire temperature status label from raw temperature value.
export const computeTireTempStatus = (temp) => {
  if (temp < TIRE_TEMP.COLD_THRESHOLD) return "Cold";
  if (temp <= TIRE_TEMP.OPTIMAL_MAX) return "Optimal";
  if (temp <= TIRE_TEMP.CRITICAL_TEMP) return "Hot";
  return "Overheated";
};

// Determine which sector (1, 2, or 3) a given normalized lap progress falls in.
export const sectorAtProgress = (progress) => {
  const safeProgress = ((progress % CAR_SETTINGS.LAP_DISTANCE) + CAR_SETTINGS.LAP_DISTANCE) % CAR_SETTINGS.LAP_DISTANCE;
  const frac = safeProgress / CAR_SETTINGS.LAP_DISTANCE;
  // Sector boundaries: 0-0.3 = S1, 0.3-0.65 = S2, 0.65-1.0 = S3
  if (frac < 0.3) return 1;
  if (frac < 0.65) return 2;
  return 3;
};

export const weatherConfig = () =>
  Object.values(WEATHER_CONDITIONS).find((w) => w.label === weather.value) ||
  WEATHER_CONDITIONS.DRY;

export const normalizedRpmRatio = () => {
  const rpmRatio =
    (rpm.value - CAR_SETTINGS.RPM_IDLE) /
    (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
  return Math.max(0, rpmRatio);
};

/**
 * Reset all module-scope singleton refs to their initial values.
 * Used by tests and HMR to avoid state leaking across module reloads.
 */
export function _resetSingletons() {
  clearSimulationInterval();
  clearOvertakeTimeout();
  lastSegmentIndex = -1;
  simWatcherRegistered = false;
  engineStatus.value = false;
  rpm.value = 0;
  currentGear.value = 0;
  currentSegmentIndex.value = 0;
  drsStatus.value = false;
  overtakeActive.value = false;
  pitting.value = false;
  tireLife.value = 100;
  tireCompound.value = TIRE_COMPOUNDS.MEDIUM.label;
  fuelLevel.value = 100;
  batteryLevel.value = 100;
  fuelMix.value = FUEL_MIXES.STANDARD;
  ersMode.value = ERS_MODES.BALANCED.label;
  engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
  overheating.value = false;
  currentLap.value = 1;
  lapProgress.value = 0;
  raceFinished.value = false;
  currentLapTime.value = 0;
  lastLapTime.value = null;
  bestLapTime.value = null;
  leaderboard.value = [];
  weather.value = WEATHER_CONDITIONS.DRY.label;
  carDamage.value = 0;
  selectedCar.value = CAR_PRESETS[1];
  // Tire temp reset
  tireTemp.value = TIRE_TEMP.BASELINE;
  tireTempStatus.value = "Optimal";
  tireTempWarned.value = false;
  // DRS reset
  drsEligible.value = false;
  // Pit window reset
  pitWindowStart.value = null;
  pitWindowVisible.value = false;
  pitWindowUrgent.value = false;
  // Sector timing reset
  sectorTimes.value = [0, 0, 0];
  bestSectorTimes.value = [null, null, null];
  lastSectorTimes.value = [null, null, null];
  currentSector.value = 1;
  // Weather shift reset
  nextWeather.value = null;
  weatherChangeLap.value = 0;
  weatherChangeAnnounced.value = false;
  // Qualifying reset
  raceMode.value = "race";
  qualifyingLapsRemaining.value = QUALIFYING.LAPS;
  qualifyingResults.value = [];
  qualifyingBestLap.value = null;
  qualifyingPosition.value = 1;
  lowFuelWarned.value = false;
  lowBatteryWarned.value = false;
  overheatWarned.value = false;
  damageWarned.value = false;
}
