// src/composables/useCar.js

import { ref, computed, watch } from "vue";
import {
  CAR_SETTINGS,
  FUEL_MIXES,
  TIRE_COMPOUNDS,
  ERS_MODES,
} from "@/config";
import audioService from "@/services/audioService";
import ttsService from "@/services/textToSpeechService";

if (typeof window !== "undefined" && typeof window.Audio !== "undefined") {
  audioService.loadSounds();
}
// --- SHARED STATE (SINGLETON PATTERN) ---
// By defining state outside the function, every component that calls useCar()
// will share this same reactive state.
const engineStatus = ref(false);
const rpm = ref(0);
const drsStatus = ref(false);
const overtakeActive = ref(false);
const tireLife = ref(100); // 0..100, drives the tireStatus label
const tireCompound = ref(TIRE_COMPOUNDS.MEDIUM.label);
const fuelLevel = ref(100);
const batteryLevel = ref(100);
const fuelMix = ref(FUEL_MIXES.STANDARD); // 'Lean', 'Standard', 'Rich'
const ersMode = ref(ERS_MODES.BALANCED.label);
const engineTemp = ref(CAR_SETTINGS.TEMP_AMBIENT);
const overheating = ref(false);
const currentLap = ref(1);
const lapProgress = ref(0); // 0..LAP_DISTANCE accumulated within the lap
const raceFinished = ref(false);
let simulationInterval = null;
let overtakeTimeout = null;

// Warning latches so a low-level radio call is announced once per crossing
// rather than on every simulation tick.
const lowFuelWarned = ref(false);
const lowBatteryWarned = ref(false);
const overheatWarned = ref(false);

// This function is our composable.
export function useCar() {
  // --- COMPUTED PROPERTIES ---
  const isLowBattery = computed(
    () => batteryLevel.value < CAR_SETTINGS.LOW_BATTERY_THRESHOLD,
  );
  const isLowFuel = computed(
    () => fuelLevel.value < CAR_SETTINGS.LOW_FUEL_THRESHOLD,
  );

  // Tire condition label derived from remaining tire life.
  const tireStatus = computed(() => {
    if (!engineStatus.value && tireLife.value >= 100) return "Cold";
    if (tireLife.value >= CAR_SETTINGS.TIRE_OPTIMAL_THRESHOLD) return "Optimal";
    if (tireLife.value >= CAR_SETTINGS.TIRE_WORN_THRESHOLD) return "Used";
    return "Worn";
  });

  // Engine temperature condition label.
  const tempStatus = computed(() => {
    if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL) return "Critical";
    if (engineTemp.value > CAR_SETTINGS.TEMP_OPTIMAL_MAX) return "Hot";
    return "Optimal";
  });

  // --- PRIVATE METHODS (LOGIC) ---
  const normalizedRpmRatio = () => {
    const rpmRatio =
      (rpm.value - CAR_SETTINGS.RPM_IDLE) /
      (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    return Math.max(0, rpmRatio);
  };

  const compoundConfig = () =>
    Object.values(TIRE_COMPOUNDS).find(
      (c) => c.label === tireCompound.value,
    ) || TIRE_COMPOUNDS.MEDIUM;

  const ersConfig = () =>
    Object.values(ERS_MODES).find((m) => m.label === ersMode.value) ||
    ERS_MODES.BALANCED;

  const updateLapProgress = (ratio) => {
    if (raceFinished.value) return;
    // Distance accrues with RPM: idle still creeps, max RPM is fastest.
    lapProgress.value += CAR_SETTINGS.LAP_DISTANCE * 0.1 * (0.5 + ratio);

    while (lapProgress.value >= CAR_SETTINGS.LAP_DISTANCE) {
      lapProgress.value -= CAR_SETTINGS.LAP_DISTANCE;
      if (currentLap.value >= CAR_SETTINGS.TOTAL_LAPS) {
        raceFinished.value = true;
        lapProgress.value = 0;
        ttsService.speak("Checkered flag. Race complete.");
        return;
      }
      currentLap.value += 1;
      ttsService.speak(`Lap ${currentLap.value}.`);
    }
  };

  const updateTemperature = (ratio) => {
    let next = engineTemp.value;
    // Heat generated scales with RPM; cooling pulls back toward ambient.
    const heat = CAR_SETTINGS.TEMP_RISE_RATE * ratio;
    const cool = CAR_SETTINGS.TEMP_COOL_RATE * (1 - ratio);
    next += heat - cool;
    if (overtakeActive.value) next += CAR_SETTINGS.TEMP_OVERTAKE_PENALTY;
    // Never drop below ambient.
    engineTemp.value = parseFloat(
      Math.max(CAR_SETTINGS.TEMP_AMBIENT, next).toFixed(1),
    );
  };

  const runSimulationTick = () => {
    const ratio = normalizedRpmRatio();

    // Fuel consumption scales with the selected fuel mix and current RPM.
    const baseConsumptionRate =
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE[fuelMix.value.toUpperCase()] ||
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;

    // Multiplier ranges linearly from MIN (idle) to MAX (max RPM).
    const rpmMultiplier =
      CAR_SETTINGS.RPM_MULTIPLIER_MIN +
      ratio * (CAR_SETTINGS.RPM_MULTIPLIER_MAX - CAR_SETTINGS.RPM_MULTIPLIER_MIN);
    const totalConsumptionRate = baseConsumptionRate * rpmMultiplier;

    if (fuelLevel.value > 0) {
      fuelLevel.value = parseFloat(
        Math.max(0, fuelLevel.value - totalConsumptionRate).toFixed(2),
      );
    }

    // Tires wear faster at higher RPM (1x at idle up to 2x at max RPM) and
    // scaled by the fitted compound's wear factor.
    if (tireLife.value > 0) {
      const wear =
        CAR_SETTINGS.TIRE_WEAR_RATE *
        (1 + ratio) *
        compoundConfig().wearFactor;
      tireLife.value = parseFloat(
        Math.max(0, tireLife.value - wear).toFixed(2),
      );
    }

    // Battery recharges at a rate scaled by the selected ERS mode.
    if (batteryLevel.value < 100) {
      const recharge =
        CAR_SETTINGS.BATTERY_RECHARGE_RATE * ersConfig().rechargeFactor;
      batteryLevel.value = parseFloat(
        Math.min(100, batteryLevel.value + recharge).toFixed(2),
      );
    }

    updateTemperature(ratio);
    updateLapProgress(ratio);
    checkWarnings();

    // Out of fuel: the engine stalls.
    if (fuelLevel.value <= 0 && engineStatus.value) {
      stallEngine();
      return;
    }

    // Overheating: the engine cuts power until it cools below critical.
    if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL && engineStatus.value) {
      overheatEngine();
    }
  };

  // Announce low fuel / battery / overheat once per threshold crossing.
  const checkWarnings = () => {
    if (isLowFuel.value && !lowFuelWarned.value) {
      lowFuelWarned.value = true;
      ttsService.speak("Warning. Fuel level critical.");
    } else if (!isLowFuel.value) {
      lowFuelWarned.value = false;
    }

    if (isLowBattery.value && !lowBatteryWarned.value) {
      lowBatteryWarned.value = true;
      ttsService.speak("Warning. Battery level critical.");
    } else if (!isLowBattery.value) {
      lowBatteryWarned.value = false;
    }

    if (engineTemp.value > CAR_SETTINGS.TEMP_OPTIMAL_MAX && !overheatWarned.value) {
      overheatWarned.value = true;
      ttsService.speak("Warning. Engine temperature high.");
    } else if (engineTemp.value <= CAR_SETTINGS.TEMP_OPTIMAL_MAX) {
      overheatWarned.value = false;
    }
  };

  const stallEngine = async () => {
    engineStatus.value = false;
    rpm.value = 0;
    drsStatus.value = false;
    overtakeActive.value = false;
    await ttsService.speak("Out of fuel. Engine stalling.");
  };

  const overheatEngine = async () => {
    // Power cut: drop revs to idle and disable boosting systems.
    overheating.value = true;
    drsStatus.value = false;
    overtakeActive.value = false;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    await ttsService.speak("Engine overheating. Cutting power.");
  };

  // --- ACTIONS (PUBLIC METHODS) ---
  const startEngine = async () => {
    if (engineStatus.value) {
      const message = "The engine is already running.";
      await ttsService.speak(message);
      return message;
    }

    if (fuelLevel.value <= 0) {
      const message = "Cannot start engine. The fuel tank is empty.";
      await ttsService.speak(message);
      return message;
    }

    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    overheating.value = false;

    const message = "Engine started.";
    await audioService.playSound("engineStart");
    await ttsService.speak(message); // Speak AFTER sound
    return message;
  };

  const stopEngine = async () => {
    if (!engineStatus.value) {
      const message = "The engine is already off.";
      await ttsService.speak(message);
      return message;
    }

    engineStatus.value = false;
    rpm.value = 0;
    drsStatus.value = false;

    const message = "Engine stopped.";
    await audioService.playSound("engineStop");
    await ttsService.speak(message);
    return message;
  };

  const activateDrs = async () => {
    let message = "";

    if (!engineStatus.value) {
      message = "Cannot activate DRS. The engine is off.";
    } else if (drsStatus.value) {
      message = "DRS is already active.";
    } else {
      drsStatus.value = true;
      try {
        await audioService.playSound("drsOn");
      } catch (error) {
        console.error("Failed to play DRS activation sound.", error);
      }
      message = "DRS enabled.";
    }

    await ttsService.speak(message);
    return message;
  };

  const deactivateDrs = async () => {
    let message = "";

    if (!drsStatus.value) {
      message = "DRS is already disabled.";
    } else {
      drsStatus.value = false;
      try {
        await audioService.playSound("drsOff");
      } catch (error) {
        console.error("Failed to play DRS deactivation sound.", error);
      }
      message = "DRS disabled.";
    }

    await ttsService.speak(message);
    return message;
  };

  const activateOvertake = async () => {
    let message = "";
    if (overtakeActive.value) message = "Overtake is already active.";
    else if (!engineStatus.value)
      message = "Cannot activate overtake, engine is off.";
    else if (overheating.value)
      message = "Cannot activate overtake, engine is overheating.";
    else if (batteryLevel.value < CAR_SETTINGS.OVERTAKE_BATTERY_COST)
      message = "Not enough battery for overtake.";

    if (message) {
      await ttsService.speak(message);
      return message;
    }

    overtakeActive.value = true;
    batteryLevel.value -= CAR_SETTINGS.OVERTAKE_BATTERY_COST;
    rpm.value += CAR_SETTINGS.RPM_OVERTAKE_BOOST;
    message = "Overtake mode activated.";

    await audioService.playSound("overtakeOn");
    await ttsService.speak(message);

    if (overtakeTimeout) clearTimeout(overtakeTimeout);
    overtakeTimeout = setTimeout(async () => {
      overtakeActive.value = false;
      rpm.value = engineStatus.value ? CAR_SETTINGS.RPM_IDLE : 0;
      await ttsService.speak("Overtake finished.");
    }, CAR_SETTINGS.OVERTAKE_DURATION_MS);

    return message;
  };

  const setFuelMix = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!FUEL_MIXES[key]) {
      const message = `Unknown fuel mix: ${mode}.`;
      await ttsService.speak(message);
      return message;
    }

    fuelMix.value = FUEL_MIXES[key];
    const message = `Fuel mix set to ${FUEL_MIXES[key]}.`;
    await ttsService.speak(message);
    return message;
  };

  const setErsMode = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!ERS_MODES[key]) {
      const message = `Unknown ERS mode: ${mode}.`;
      await ttsService.speak(message);
      return message;
    }

    ersMode.value = ERS_MODES[key].label;
    const message = `ERS mode set to ${ERS_MODES[key].label}.`;
    await ttsService.speak(message);
    return message;
  };

  const setTireCompound = async (compound) => {
    const key = String(compound).toUpperCase();
    if (!TIRE_COMPOUNDS[key]) {
      const message = `Unknown tire compound: ${compound}.`;
      await ttsService.speak(message);
      return message;
    }

    if (engineStatus.value) {
      const message = "Pit the car before changing tire compound.";
      await ttsService.speak(message);
      return message;
    }

    tireCompound.value = TIRE_COMPOUNDS[key].label;
    tireLife.value = 100;
    const message = `${TIRE_COMPOUNDS[key].label} tires fitted.`;
    await ttsService.speak(message);
    return message;
  };

  const checkTireStatus = async () => {
    const message = `${tireCompound.value} tires are ${tireStatus.value.toLowerCase()} at ${tireLife.value} percent.`;
    await ttsService.speak(message);
    return message;
  };

  const getFuelStatus = async () => {
    const message = `Fuel level is at ${fuelLevel.value} percent.`;
    await ttsService.speak(message);
    return message;
  };

  const getBatteryStatus = async () => {
    const message = isLowBattery.value
      ? `Battery level critical at ${batteryLevel.value} percent.`
      : `Battery is at ${batteryLevel.value} percent.`;
    await ttsService.speak(message);
    return message;
  };

  const getTempStatus = async () => {
    const message = `Engine temperature is ${engineTemp.value} degrees, ${tempStatus.value.toLowerCase()}.`;
    await ttsService.speak(message);
    return message;
  };

  const getLapStatus = async () => {
    const message = raceFinished.value
      ? "Race complete."
      : `On lap ${currentLap.value} of ${CAR_SETTINGS.TOTAL_LAPS}.`;
    await ttsService.speak(message);
    return message;
  };

  const getHelp = async () => {
    const message =
      "Available commands: start engine, stop engine, D R S, overtake, " +
      "fuel mix, E R S mode, tire compound, pit stop, lap status, " +
      "temperature, fuel, battery, and reset.";
    await ttsService.speak(message);
    return message;
  };

  const performPitStop = async () => {
    await stopEngine(); // Use existing actions
    await new Promise((resolve) =>
      setTimeout(resolve, CAR_SETTINGS.PIT_STOP_DURATION_MS),
    );

    fuelLevel.value = 100;
    batteryLevel.value = 100;
    tireLife.value = 100;
    engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
    overheating.value = false;
    lowFuelWarned.value = false;
    lowBatteryWarned.value = false;
    overheatWarned.value = false;

    await startEngine();
    return "Pit stop complete. Car serviced.";
  };

  const resetRace = async () => {
    if (overtakeTimeout) clearTimeout(overtakeTimeout);
    overtakeTimeout = null;

    engineStatus.value = false;
    rpm.value = 0;
    drsStatus.value = false;
    overtakeActive.value = false;
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
    lowFuelWarned.value = false;
    lowBatteryWarned.value = false;
    overheatWarned.value = false;

    const message = "Race reset. All systems nominal.";
    await ttsService.speak(message);
    return message;
  };

  // --- WATCHER FOR SIMULATION ---
  watch(
    engineStatus,
    (isEngineOn) => {
      if (isEngineOn) {
        if (simulationInterval) clearInterval(simulationInterval);
        simulationInterval = setInterval(
          runSimulationTick,
          CAR_SETTINGS.SIMULATION_TICK_MS,
        );
      } else {
        if (simulationInterval) clearInterval(simulationInterval);
        simulationInterval = null;
      }
    },
    { immediate: true },
  );

  // --- EXPOSE PUBLIC API ---
  return {
    // State
    engineStatus,
    rpm,
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
    // Getters
    tireStatus,
    tempStatus,
    isLowBattery,
    isLowFuel,
    // Actions
    startEngine,
    stopEngine,
    activateDrs,
    deactivateDrs,
    activateOvertake,
    setFuelMix,
    setErsMode,
    setTireCompound,
    checkTireStatus,
    getFuelStatus,
    getBatteryStatus,
    getTempStatus,
    getLapStatus,
    getHelp,
    performPitStop,
    resetRace,
    // Internals exposed for testing
    runSimulationTick,
  };
}
