// src/composables/useCar.js
//
// Orchestrator for the car simulation. Imports shared state from
// useCarState.js and simulation logic from useCarSimulation.js, then
// layers on all public actions (engine, DRS, overtake, pit stop, etc.)
// and the simulation watcher.
//
// Every component that calls useCar() gets the same reactive singleton.

import { ref, computed, watch, onUnmounted, getCurrentInstance } from "vue";
import {
  CAR_SETTINGS,
  CAR_PRESETS,
  FUEL_MIXES,
  TIRE_COMPOUNDS,
  ERS_MODES,
  WEATHER_CONDITIONS,
  WEATHER_SHIFT,
  TIRE_TEMP,
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
  tireTempStatus,
  tireTempWarned,
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
  findSegmentAtProgress,
  compoundConfig,
  ersConfig,
  weatherConfig,
  normalizedRpmRatio,
  statusWord,
  paceFactor,
  simulationInterval,
  clearSimulationInterval,
  setSimulationInterval,
  clearOvertakeTimeout,
  setOvertakeTimeout,
  setLastSegmentIndex,
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

// This function is our composable.
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
    const gr = currentGear.value > 0
      ? (CAR_SETTINGS.GEAR_RATIOS[currentGear.value] || 0.5)
      : 0;
    const seg = findSegmentAtProgress(lapProgress.value);
    const cf = seg.segment.type === "corner" ? effectiveStats.value.cornerSpeedCap : 1.0;
    const drsBoost = drsStatus.value && seg.segment.type === "straight" ? 1.12 : 1.0;
    const base = 50 + ratio * gr * 200;
    const raw = base * cf * drsBoost * selectedCar.value.stats.speedMul * (weatherConfig().gripFactor || 1.0) * paceFactor.value;
    return Math.round(raw);
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
    let message = "";

    if (!engineStatus.value) {
      message = t("msg.drsEngineOff");
    } else if (drsStatus.value) {
      message = t("msg.drsAlreadyActive");
    } else if (ai.enabled.value && !drsEligible.value) {
      message = t("msg.drsNotEligible");
    } else {
      drsStatus.value = true;
      try {
        await audioService.playSound("drsOn");
      } catch (error) {
        console.error("Failed to play DRS activation sound.", error);
      }
      message = t("msg.drsEnabled");
    }

    await ttsService.speak(message);
    return message;
  };

  const deactivateDrs = async () => {
    let message = "";

    if (!drsStatus.value) {
      message = t("msg.drsAlreadyDisabled");
    } else {
      drsStatus.value = false;
      try {
        await audioService.playSound("drsOff");
      } catch (error) {
        console.error("Failed to play DRS deactivation sound.", error);
      }
      message = t("msg.drsDisabled");
    }

    await ttsService.speak(message);
    return message;
  };

  const activateOvertake = async () => {
    let message = "";
    if (overtakeActive.value) message = t("msg.overtakeAlreadyActive");
    else if (!engineStatus.value) message = t("msg.overtakeEngineOff");
    else if (overheating.value) message = t("msg.overtakeOverheating");
    else if (batteryLevel.value < CAR_SETTINGS.OVERTAKE_BATTERY_COST)
      message = t("msg.overtakeLowBattery");

    if (message) {
      await ttsService.speak(message);
      return message;
    }

    overtakeActive.value = true;
    batteryLevel.value -= CAR_SETTINGS.OVERTAKE_BATTERY_COST;
    rpm.value += CAR_SETTINGS.RPM_OVERTAKE_BOOST;
    message = t("msg.overtakeActivated");

    await audioService.playSound("overtakeOn");
    await ttsService.speak(message);

    clearOvertakeTimeout();
    const timeout = setTimeout(async () => {
      overtakeActive.value = false;
      rpm.value = engineStatus.value ? CAR_SETTINGS.RPM_IDLE : 0;
      await ttsService.speak(t("msg.overtakeFinished"));
    }, CAR_SETTINGS.OVERTAKE_DURATION_MS);
    setOvertakeTimeout(timeout);

    return message;
  };

  const setFuelMix = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!FUEL_MIXES[key]) {
      const message = t("msg.unknownFuelMix", { mode });
      await ttsService.speak(message);
      return message;
    }

    fuelMix.value = FUEL_MIXES[key];
    const message = t("msg.fuelMixSet", { label: FUEL_MIXES[key] });
    await ttsService.speak(message);
    return message;
  };

  const setErsMode = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!ERS_MODES[key]) {
      const message = t("msg.unknownErsMode", { mode });
      await ttsService.speak(message);
      return message;
    }

    ersMode.value = ERS_MODES[key].label;
    const message = t("msg.ersModeSet", { label: ERS_MODES[key].label });
    await ttsService.speak(message);
    return message;
  };

  const setTireCompound = async (compound) => {
    const key = String(compound).toUpperCase();
    if (!TIRE_COMPOUNDS[key]) {
      const message = t("msg.unknownCompound", { compound });
      await ttsService.speak(message);
      return message;
    }

    if (engineStatus.value && !pitting.value) {
      const message = t("msg.compoundPitFirst");
      await ttsService.speak(message);
      return message;
    }

    tireCompound.value = TIRE_COMPOUNDS[key].label;
    if (pitting.value) {
      tireLife.value = 100;
    }
    const message = t("msg.compoundFitted", { label: TIRE_COMPOUNDS[key].label });
    await ttsService.speak(message);
    return message;
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

  const getTireTempStatus = async () => {
    const message = t("msg.tireTempStatus", {
      temp: tireTemp.value,
      status: statusWord(tireTempDisplayStatus.value),
    });
    await ttsService.speak(message);
    return message;
  };

  const getPitWindowStatus = async () => {
    if (!pitWindowVisible.value) {
      const message = t("msg.pitWindowOk");
      await ttsService.speak(message);
      return message;
    }
    if (pitWindowUrgent.value) {
      const message = t("msg.pitWindowUrgent", { lap: pitWindowStart.value });
      await ttsService.speak(message);
      return message;
    }
    const message = t("msg.pitWindowRecommend", { lap: pitWindowStart.value });
    await ttsService.speak(message);
    return message;
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
    if (!WEATHER_CONDITIONS[key]) {
      const message = t("msg.unknownWeather", { condition });
      await ttsService.speak(message);
      return message;
    }
    weather.value = WEATHER_CONDITIONS[key].label;
    const message = t("msg.weatherSet", { label: WEATHER_CONDITIONS[key].label });
    await ttsService.speak(message);
    return message;
  };

  const performPitStop = async () => {
    if (raceFinished.value) {
      const message = t("msg.raceComplete");
      await ttsService.speak(message);
      return message;
    }

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
    const message = t("msg.raceReset");
    await ttsService.speak(message);
    return message;
  };

  const selectCar = async (carId) => {
    if (engineStatus.value || pitting.value) {
      const message = t("msg.carSelectEngineRunning");
      await ttsService.speak(message);
      return message;
    }
    const car = CAR_PRESETS.find((c) => c.id === carId);
    if (!car) {
      const message = t("msg.carSelectUnknown", { id: carId });
      await ttsService.speak(message);
      return message;
    }
    selectedCar.value = car;
    const message = t("msg.carSelected", { label: car.label });
    await ttsService.speak(message);
    return message;
  };

  // --- WATCHER FOR SIMULATION ---
  if (!simWatcherRegistered) {
    setSimWatcherRegistered(true);
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
      engineAudioService.stop();
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
    tireTempStatus,
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
    aiConfig: ai.config,
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
