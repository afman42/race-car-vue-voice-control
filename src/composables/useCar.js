// src/composables/useCar.js
//
// Orchestrator for the car simulation. Imports shared state from
// useCarState.js and simulation logic from useCarSimulation.js, then
// layers on all public actions (engine, DRS, overtake, pit stop, etc.)
// and the simulation watcher.
//
// Every component that calls useCar() gets the same reactive singleton.

import { computed, watch, onUnmounted, getCurrentInstance } from "vue";
import {
  CAR_SETTINGS,
  CAR_PRESETS,
  FUEL_MIXES,
  TIRE_COMPOUNDS,
  ERS_MODES,
  WEATHER_CONDITIONS,
  DRS_DETECTION,
} from "@/config";
import audioService from "@/services/audioService";
import engineAudioService from "@/services/engineAudioService";
import ttsService from "@/services/textToSpeechService";
import { t } from "@/i18n";
import { formatLapTime } from "@/utils/formatLapTime";
import {
  totalProgress,
  loopPosition,
  computeStandings,
  formatPosition,
} from "@/utils/raceStanding";
import {
  engineStatus,
  rpm,
  currentGear,
  currentSegmentIndex,
  drsStatus,
  drsEligible,
  overtakeActive,
  tireLife,
  tireTemp,
  tireCompound,
  fuelLevel,
  batteryLevel,
  fuelMix,
  ersMode,
  engineTemp,
  overheating,
  currentLap,
  lapProgress,
  raceFinished,
  pitting,
  currentLapTime,
  lastLapTime,
  bestLapTime,
  leaderboard,
  weather,
  carDamage,
  selectedCar,
  effectiveStats,
  ai,
  lowFuelWarned,
  lowBatteryWarned,
  overheatWarned,
  damageWarned,
  tireGripFactor,
  findSegmentAtProgress,
  weatherConfig,
  normalizedRpmRatio,
  statusWord,
  paceFactor,
  simulationInterval,
  clearSimulationInterval,
  setSimulationInterval,
  clearOvertakeTimeout,
  setOvertakeTimeout,
  setSimWatcherRegistered,
  simWatcherRegistered,
  // Qualifying state
  raceMode,
  qualifyingLapsRemaining,
  qualifyingResults,
  qualifyingBestLap,
  // Weather shift state
  nextWeather,
  weatherChangeLap,
  // Pit window state
  pitWindowStart,
  pitWindowVisible,
  pitWindowUrgent,
  // Shared helpers
  computeTireTempStatus,
  _resetSingletons,
} from "./useCarState";
import { runSimulationTick, scheduleWeatherShift } from "./useCarSimulation";
import { useQualifying } from "./useQualifying";

// Re-export for UI and tests that import from useCar.
export { findSegmentAtProgress, _resetSingletons } from "./useCarState";

export function useCar() {
  // --- COMPUTED PROPERTIES ---
  const isLowBattery = computed(
    () => batteryLevel.value < CAR_SETTINGS.LOW_BATTERY_THRESHOLD,
  );
  const isLowFuel = computed(
    () => fuelLevel.value < CAR_SETTINGS.LOW_FUEL_THRESHOLD,
  );

  // Tire temperature display status (for UI)
  const tireTempDisplayStatus = computed(() => computeTireTempStatus(tireTemp.value));

  // Pit window info for display
  const pitWindowInfo = computed(() => {
    if (!pitWindowVisible.value || raceMode.value === "qualifying") return null;
    return {
      startLap: pitWindowStart.value,
      urgent: pitWindowUrgent.value,
      currentLap: currentLap.value,
    };
  });

  const tireStatus = computed(() => {
    if (!engineStatus.value && tireLife.value >= 100) return "Cold";
    if (tireLife.value >= CAR_SETTINGS.TIRE_OPTIMAL_THRESHOLD) return "Optimal";
    if (tireLife.value >= CAR_SETTINGS.TIRE_WORN_THRESHOLD) return "Used";
    return "Worn";
  });

  const tempStatus = computed(() => {
    if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL) return "Critical";
    if (engineTemp.value > CAR_SETTINGS.TEMP_OPTIMAL_MAX) return "Hot";
    return "Optimal";
  });

  const damageStatus = computed(() => {
    if (carDamage.value >= CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD)
      return "Critical";
    if (carDamage.value >= CAR_SETTINGS.DAMAGE_MAJOR_THRESHOLD) return "Major";
    if (carDamage.value >= CAR_SETTINGS.DAMAGE_MINOR_THRESHOLD) return "Minor";
    return "None";
  });

  const speedKmh = computed(() => {
    const ratio = normalizedRpmRatio();
    const gearRatio = currentGear.value > 0
      ? (CAR_SETTINGS.GEAR_RATIOS[currentGear.value] || 0.5)
      : 0;
    const grip = tireGripFactor();
    // Same factor stack as updateLapProgress in useCarSimulation.js:
    // lapProgressBase × (0.3 + ratio×gear) × weather grip × pace × tire grip,
    // then corner cap and DRS boost — so the speedometer tracks real pace.
    const rawSpeed =
      effectiveStats.value.lapProgressBase *
      (0.3 + ratio * gearRatio) *
      weatherConfig().gripFactor *
      paceFactor.value *
      grip;
    const seg = findSegmentAtProgress(lapProgress.value);
    const cornerFactor = seg.segment.type === "corner" ? effectiveStats.value.cornerSpeedCap * grip : 1.0;
    const drsBoost = drsStatus.value && seg.segment.type === "straight" ? DRS_DETECTION.DRS_BOOST : 1.0;
    return Math.round(rawSpeed * cornerFactor * drsBoost * CAR_SETTINGS.SPEED_KMH_SCALE);
  });

  const playerProgress = computed(() =>
    totalProgress(
      currentLap.value,
      lapProgress.value / CAR_SETTINGS.LAP_DISTANCE,
      CAR_SETTINGS.TOTAL_LAPS,
    ),
  );

  const rivalProgress = computed(() =>
    totalProgress(ai.currentLap.value, ai.lapProgress.value, CAR_SETTINGS.TOTAL_LAPS),
  );

  const standings = computed(() =>
    computeStandings(
      { progress: playerProgress.value },
      ai.enabled.value ? { progress: rivalProgress.value } : null,
    ),
  );

  const playerLoopPos = computed(() => loopPosition(playerProgress.value));
  const rivalLoopPos = computed(() => loopPosition(rivalProgress.value));

  // --- QUALIFYING ---
  const {
    computedQualifyingPosition,
    qualifyingInfo,
    startQualifying,
    getQualifyingStatus,
    getQualifyingBestLap,
  } = useQualifying();

  // --- HELPERS ---
  const speakAndReturn = async (key, params) => {
    const msg = t(key, params);
    await ttsService.speak(msg);
    return msg;
  };

  // --- ACTIONS (PUBLIC METHODS) ---
  const startEngine = async () => {
    if (engineStatus.value) {
      const message = t("msg.engineAlreadyRunning");
      await ttsService.speak(message);
      return message;
    }

    if (fuelLevel.value <= 0) {
      const message = t("msg.tankEmpty");
      await ttsService.speak(message);
      return message;
    }

    engineStatus.value = true;
    currentGear.value = 1;
    rpm.value = CAR_SETTINGS.GEAR_START_RPM;
    overheating.value = false;

    engineAudioService.start(CAR_SETTINGS.GEAR_START_RPM);

    const message = t("msg.engineStarted");
    await audioService.playSound("engineStart");
    await ttsService.speak(message);
    return message;
  };

  const stopEngine = async () => {
    if (!engineStatus.value) {
      const message = t("msg.engineAlreadyOff");
      await ttsService.speak(message);
      return message;
    }

    clearOvertakeTimeout();
    overtakeActive.value = false;
    engineStatus.value = false;
    rpm.value = 0;
    currentGear.value = 0;
    drsStatus.value = false;

    engineAudioService.stop();

    const message = t("msg.engineStopped");
    await audioService.playSound("engineStop");
    await ttsService.speak(message);
    return message;
  };

  const activateDrs = async () => {
    if (!engineStatus.value) return speakAndReturn("msg.drsEngineOff");
    if (drsStatus.value) return speakAndReturn("msg.drsAlreadyActive");
    if (ai.enabled.value && !drsEligible.value) return speakAndReturn("msg.drsNotEligible");
    drsStatus.value = true;
    await audioService.playSound("drsOn");
    return speakAndReturn("msg.drsEnabled");
  };

  const deactivateDrs = async () => {
    if (!drsStatus.value) return speakAndReturn("msg.drsAlreadyDisabled");
    drsStatus.value = false;
    await audioService.playSound("drsOff");
    return speakAndReturn("msg.drsDisabled");
  };

  const activateOvertake = async () => {
    if (overtakeActive.value) return speakAndReturn("msg.overtakeAlreadyActive");
    if (!engineStatus.value) return speakAndReturn("msg.overtakeEngineOff");
    if (overheating.value) return speakAndReturn("msg.overtakeOverheating");
    if (batteryLevel.value < CAR_SETTINGS.OVERTAKE_BATTERY_COST) {
      return speakAndReturn("msg.overtakeLowBattery");
    }

    overtakeActive.value = true;
    batteryLevel.value -= CAR_SETTINGS.OVERTAKE_BATTERY_COST;
    // Clamp to RPM_MAX and restore the pre-boost value at expiry so the
    // boost never double-counts when the climb already erased it.
    const rpmBeforeBoost = rpm.value;
    rpm.value = Math.min(CAR_SETTINGS.RPM_MAX, rpm.value + CAR_SETTINGS.RPM_OVERTAKE_BOOST);
    const message = t("msg.overtakeActivated");

    await audioService.playSound("overtakeOn");
    await ttsService.speak(message);

    // Re-check after the awaits: the engine may have stalled/overheated
    // or stopped mid-flight; don't arm a boost timer for a dead engine.
    if (!engineStatus.value || !overtakeActive.value) return message;

    clearOvertakeTimeout();
    const timeout = setTimeout(async () => {
      overtakeActive.value = false;
      rpm.value = engineStatus.value
        ? Math.max(CAR_SETTINGS.RPM_IDLE, rpmBeforeBoost)
        : 0;
      await ttsService.speak(t("msg.overtakeFinished"));
    }, CAR_SETTINGS.OVERTAKE_DURATION_MS);
    setOvertakeTimeout(timeout);

    return message;
  };

  const setFuelMix = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!FUEL_MIXES[key]) return speakAndReturn("msg.unknownFuelMix", { mode });
    fuelMix.value = FUEL_MIXES[key];
    return speakAndReturn("msg.fuelMixSet", { label: FUEL_MIXES[key] });
  };

  const setErsMode = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!ERS_MODES[key]) return speakAndReturn("msg.unknownErsMode", { mode });
    ersMode.value = ERS_MODES[key].label;
    return speakAndReturn("msg.ersModeSet", { label: ERS_MODES[key].label });
  };

  const setTireCompound = async (compound) => {
    const key = String(compound).toUpperCase();
    if (!TIRE_COMPOUNDS[key]) return speakAndReturn("msg.unknownCompound", { compound });
    if (engineStatus.value && !pitting.value) return speakAndReturn("msg.compoundPitFirst");
    tireCompound.value = TIRE_COMPOUNDS[key].label;
    if (pitting.value) tireLife.value = 100;
    return speakAndReturn("msg.compoundFitted", { label: TIRE_COMPOUNDS[key].label });
  };

  const checkTireStatus = () =>
    speakAndReturn("msg.tireStatus", {
      compound: tireCompound.value,
      status: statusWord(tireStatus.value),
      life: tireLife.value,
    });

  const getFuelStatus = () =>
    speakAndReturn("msg.fuelStatus", { level: fuelLevel.value });

  const getBatteryStatus = () => {
    const key = isLowBattery.value ? "msg.batteryCritical" : "msg.batteryStatus";
    return speakAndReturn(key, { level: batteryLevel.value });
  };

  const getTempStatus = () =>
    speakAndReturn("msg.tempStatus", {
      temp: engineTemp.value,
      status: statusWord(tempStatus.value),
    });

  const getLapStatus = () => {
    if (raceFinished.value) return speakAndReturn("msg.raceComplete");
    return speakAndReturn("msg.lapStatus", {
      lap: currentLap.value,
      total: CAR_SETTINGS.TOTAL_LAPS,
    });
  };

  const getHelp = () => speakAndReturn("msg.help");

  const getPosition = () => {
    const s = standings.value;
    if (s.leader === null) return speakAndReturn("msg.positionSolo");
    const gapLaps = Math.abs(s.gap).toFixed(1);
    const gap = t(
      s.leader === "player" ? "msg.gapAhead" : "msg.gapBehind",
      { laps: gapLaps },
    );
    return speakAndReturn("msg.position", {
      pos: formatPosition(s.playerPosition),
      gap,
    });
  };

  const getTireTempStatus = () =>
    speakAndReturn("msg.tireTempStatus", {
      temp: tireTemp.value,
      status: statusWord(tireTempDisplayStatus.value),
    });

  const getPitWindowStatus = () => {
    if (!pitWindowVisible.value) return speakAndReturn("msg.pitWindowOk");
    if (pitWindowUrgent.value) return speakAndReturn("msg.pitWindowUrgent", { lap: pitWindowStart.value });
    return speakAndReturn("msg.pitWindowRecommend", { lap: pitWindowStart.value });
  };

  const getBestLap = () => {
    if (bestLapTime.value === null) return speakAndReturn("msg.noLapYet");
    return speakAndReturn("msg.bestLap", {
      time: formatLapTime(bestLapTime.value),
    });
  };

  const getDamageStatus = () =>
    speakAndReturn("msg.damageStatus", {
      damage: carDamage.value,
      status: statusWord(damageStatus.value),
    });

  const getWeatherStatus = () =>
    speakAndReturn("msg.weatherStatus", { weather: weather.value });

  const setWeather = async (condition) => {
    const key = String(condition).toUpperCase();
    if (!WEATHER_CONDITIONS[key]) return speakAndReturn("msg.unknownWeather", { condition });
    weather.value = WEATHER_CONDITIONS[key].label;
    return speakAndReturn("msg.weatherSet", { label: WEATHER_CONDITIONS[key].label });
  };

  const performPitStop = async () => {
    if (raceFinished.value) return speakAndReturn("msg.raceComplete");
    pitting.value = true;
    try {
      await stopEngine();
      await new Promise((resolve) =>
        setTimeout(resolve, CAR_SETTINGS.PIT_STOP_DURATION_MS),
      );
      fuelLevel.value = 100;
      batteryLevel.value = 100;
      tireLife.value = 100;
      carDamage.value = 0;
      engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
      overheating.value = false;
      lowFuelWarned.value = false;
      lowBatteryWarned.value = false;
      overheatWarned.value = false;
      damageWarned.value = false;

      await startEngine();
      const message = t("msg.pitComplete");
      await ttsService.speak(message);
      return message;
    } finally {
      pitting.value = false;
    }
  };

  const resetRace = async () => {
    _resetSingletons();
    ai.resetProgress();
    return speakAndReturn("msg.raceReset");
  };

  const selectCar = async (carId) => {
    if (engineStatus.value || pitting.value) return speakAndReturn("msg.carSelectEngineRunning");
    const car = CAR_PRESETS.find((c) => c.id === carId);
    if (!car) return speakAndReturn("msg.carSelectUnknown", { id: carId });
    selectedCar.value = car;
    return speakAndReturn("msg.carSelected", { label: car.label });
  };
  // --- WATCHER FOR SIMULATION ---
  if (!simWatcherRegistered) {
    watch(
      [engineStatus, ai.enabled, ai.finished, ai.qualifyingFinished, pitting],
      () => {
        const aiShouldRun =
          ai.enabled.value &&
          !ai.finished.value &&
          !ai.qualifyingFinished.value;
        const shouldRun =
          !pitting.value &&
          (engineStatus.value || aiShouldRun);
        if (shouldRun) {
          // Schedule weather shift when a new race session starts
          if (simulationInterval === null && raceMode.value !== "qualifying" && nextWeather.value === null) {
            scheduleWeatherShift();
          }
          clearSimulationInterval();
          setSimulationInterval(
            setInterval(runSimulationTick, CAR_SETTINGS.SIMULATION_TICK_MS),
          );
        } else {
          clearSimulationInterval();
        }
      },
      { immediate: true },
    );
  }

  // Clean up on unmount.
  if (getCurrentInstance()) {
    onUnmounted(() => {
      clearSimulationInterval();
      clearOvertakeTimeout();
      engineAudioService.stop();
      if (typeof engineAudioService.close === "function") {
        engineAudioService.close();
      }
    });
  }
  // --- EXPOSE PUBLIC API ---
  return {
    // State
    engineStatus,
    rpm,
    currentGear,
    currentSegmentIndex,
    drsStatus,
    overtakeActive,
    tireLife,
    tireCompound,
    fuelLevel,
    batteryLevel,
    fuelMix,
    ersMode,
    engineTemp,
    overheating,
    currentLap,
    lapProgress,
    raceFinished,
    pitting,
    currentLapTime,
    lastLapTime,
    bestLapTime,
    leaderboard,
    weather,
    carDamage,
    selectedCar,
    // Qualifying state
    raceMode,
    qualifyingLapsRemaining,
    qualifyingResults,
    qualifyingBestLap,
    qualifyingPosition: computedQualifyingPosition,
    qualifyingInfo,
    // AI rival state (re-exposed from useAiRival)
    aiEnabled: ai.enabled,
    aiDifficulty: ai.difficulty,
    aiCurrentLap: ai.currentLap,
    aiLapProgress: ai.lapProgress,
    aiBestLapTime: ai.bestLapTime,
    aiLeaderboard: ai.leaderboard,
    aiFinished: ai.finished,
    computedQualifyingPosition,
    // Tire temp state
    tireTemp,
    tireTempDisplayStatus,
    // DRS eligibility
    drsEligible,
    // Pit window state
    pitWindowInfo,
    pitWindowStart,
    pitWindowVisible,
    pitWindowUrgent,
    // Weather shift state
    nextWeather,
    weatherChangeLap,
    aiQualifyingBestLap: ai.qualifyingBestLap,
    aiQualifyingFinished: ai.qualifyingFinished,
    // Getters
    tireStatus,
    tempStatus,
    isLowBattery,
    isLowFuel,
    damageStatus,
    paceFactor,
    speedKmh,
    standings,
    playerLoopPos,
    rivalLoopPos,
    // Actions
    startEngine,
    stopEngine,
    activateDrs,
    deactivateDrs,
    activateOvertake,
    setFuelMix,
    setErsMode,
    setTireCompound,
    setWeather,
    setAiDifficulty: ai.setDifficulty,
    disableAi: ai.disable,
    getAiStatus: ai.getStatus,
    checkTireStatus,
    getFuelStatus,
    getBatteryStatus,
    getTempStatus,
    getLapStatus,
    getBestLap,
    getDamageStatus,
    getWeatherStatus,
    getHelp,
    getPosition,
    performPitStop,
    resetRace,
    selectCar,
    startQualifying,
    getQualifyingStatus,
    getQualifyingBestLap,
    getTireTempStatus,
    getPitWindowStatus,
    // Helpers
    formatLapTime,
    // Internals exposed for testing
    runSimulationTick,
  };
}
