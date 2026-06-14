// src/composables/useCar.js

import { ref, computed, watch } from "vue";
import { CAR_SETTINGS, FUEL_MIXES } from "@/config";
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
const fuelLevel = ref(100);
const batteryLevel = ref(100);
const fuelMix = ref(FUEL_MIXES.STANDARD); // 'Lean', 'Standard', 'Rich'
let simulationInterval = null;
let overtakeTimeout = null;

// Warning latches so a low-level radio call is announced once per crossing
// rather than on every simulation tick.
const lowFuelWarned = ref(false);
const lowBatteryWarned = ref(false);

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

  // --- PRIVATE METHODS (LOGIC) ---
  const normalizedRpmRatio = () => {
    const rpmRatio =
      (rpm.value - CAR_SETTINGS.RPM_IDLE) /
      (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    return Math.max(0, rpmRatio);
  };

  const runSimulationTick = () => {
    // Fuel consumption scales with the selected fuel mix and current RPM.
    const baseConsumptionRate =
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE[fuelMix.value.toUpperCase()] ||
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;

    // Multiplier ranges linearly from MIN (idle) to MAX (max RPM).
    const rpmMultiplier =
      CAR_SETTINGS.RPM_MULTIPLIER_MIN +
      normalizedRpmRatio() *
        (CAR_SETTINGS.RPM_MULTIPLIER_MAX - CAR_SETTINGS.RPM_MULTIPLIER_MIN);
    const totalConsumptionRate = baseConsumptionRate * rpmMultiplier;

    if (fuelLevel.value > 0) {
      fuelLevel.value = parseFloat(
        Math.max(0, fuelLevel.value - totalConsumptionRate).toFixed(2),
      );
    }

    // Tires wear faster at higher RPM (1x at idle up to 2x at max RPM).
    if (tireLife.value > 0) {
      const wear = CAR_SETTINGS.TIRE_WEAR_RATE * (1 + normalizedRpmRatio());
      tireLife.value = parseFloat(
        Math.max(0, tireLife.value - wear).toFixed(2),
      );
    }

    // Battery recharges at a constant rate when below 100% (independent of RPM)
    if (batteryLevel.value < 100) {
      batteryLevel.value = parseFloat(
        Math.min(
          100,
          batteryLevel.value + CAR_SETTINGS.BATTERY_RECHARGE_RATE,
        ).toFixed(2),
      );
    }

    checkWarnings();

    // Out of fuel: the engine stalls.
    if (fuelLevel.value <= 0 && engineStatus.value) {
      stallEngine();
    }
  };

  // Announce low fuel / battery once per threshold crossing.
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
  };

  const stallEngine = async () => {
    engineStatus.value = false;
    rpm.value = 0;
    drsStatus.value = false;
    overtakeActive.value = false;
    await ttsService.speak("Out of fuel. Engine stalling.");
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

  const checkTireStatus = async () => {
    const message = `Tires are ${tireStatus.value.toLowerCase()} at ${tireLife.value} percent.`;
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

  const performPitStop = async () => {
    await stopEngine(); // Use existing actions
    await new Promise((resolve) =>
      setTimeout(resolve, CAR_SETTINGS.PIT_STOP_DURATION_MS),
    );

    fuelLevel.value = 100;
    batteryLevel.value = 100;
    tireLife.value = 100;
    lowFuelWarned.value = false;
    lowBatteryWarned.value = false;

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
    fuelLevel.value = 100;
    batteryLevel.value = 100;
    fuelMix.value = FUEL_MIXES.STANDARD;
    lowFuelWarned.value = false;
    lowBatteryWarned.value = false;

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
    fuelLevel,
    batteryLevel,
    fuelMix,
    // Getters
    tireStatus,
    isLowBattery,
    isLowFuel,
    // Actions
    startEngine,
    stopEngine,
    activateDrs,
    deactivateDrs,
    activateOvertake,
    setFuelMix,
    checkTireStatus,
    getFuelStatus,
    getBatteryStatus,
    performPitStop,
    resetRace,
    // Internals exposed for testing
    runSimulationTick,
  };
}
