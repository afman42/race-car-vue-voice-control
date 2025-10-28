// src/composables/useCar.js

import { ref, computed, watch } from "vue";
import { CAR_SETTINGS } from "@/config";
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
const tireStatus = ref("Cold");
const fuelLevel = ref(100);
const batteryLevel = ref(100);
const fuelMix = ref("Standard"); // 'Lean', 'Standard', 'Rich'
let simulationInterval = null;

// This function is our composable.
export function useCar() {
  // --- COMPUTED PROPERTIES ---
  const isLowFuel = computed(() => fuelLevel.value < 15);
  const isLowBattery = computed(() => batteryLevel.value < 10);

  // --- PRIVATE METHODS (LOGIC) ---
  const runSimulationTick = () => {
    // Calculate fuel consumption based on fuel mix and RPM
    let baseConsumptionRate =
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE[fuelMix.value.toUpperCase()] ||
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;

    // Calculate RPM-based multiplier (0 at idle, higher at higher RPM)
    // RPM ranges from idle to max, so we normalize it from 0 to 1
    const rpmRatio = (rpm.value - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    // Ensure the ratio is at least 0 (in case rpm is somehow below idle)
    const normalizedRpmRatio = Math.max(0, rpmRatio);
    
    // Apply RPM-based multiplier to consumption rate
    // Using a power function to make the consumption increase non-linearly with RPM
    // This simulates how engines typically consume much more fuel at high RPM
    const rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7); // Ranges from 0.3 (idle) to 2.0 (max RPM)
    const totalConsumptionRate = baseConsumptionRate * rpmMultiplier;

    if (fuelLevel.value > 0) {
      fuelLevel.value = parseFloat(
        Math.max(0, fuelLevel.value - totalConsumptionRate).toFixed(2),
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
  };

  // --- ACTIONS (PUBLIC METHODS) ---
  const startEngine = async () => {
    if (engineStatus.value) {
      const message = "The engine is already running.";
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

    setTimeout(async () => {
      overtakeActive.value = false;
      rpm.value = engineStatus.value ? CAR_SETTINGS.RPM_IDLE : 0;
      await ttsService.speak("Overtake finished.");
    }, CAR_SETTINGS.OVERTAKE_DURATION_MS);

    return message;
  };

  const checkTireStatus = async () => {
    let message = "";
    if (!engineStatus.value) {
      tireStatus.value = "Cold";
      message = "Tires are cold.";
    } else {
      tireStatus.value = "Optimal";
      message = "Tires are in the optimal window.";
    }
    await ttsService.speak(message);
    return message;
  };

  const getFuelStatus = async () => {
    const message = `Fuel level is at ${fuelLevel.value} percent.`;
    await ttsService.speak(message);
    return message;
  };

  const getBatteryStatus = () => {
    if (isLowBattery.value)
      return `Battery level critical at ${batteryLevel.value} percent.`;
    return `Battery is at ${batteryLevel.value} percent.`;
  };

  const performPitStop = async () => {
    await stopEngine(); // Use existing actions
    await new Promise((resolve) =>
      setTimeout(resolve, CAR_SETTINGS.PIT_STOP_DURATION_MS),
    );

    fuelLevel.value = 100;
    batteryLevel.value = 100;
    tireStatus.value = "New";

    await startEngine();
    return "Pit stop complete. Car serviced.";
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
    tireStatus,
    fuelLevel,
    batteryLevel,
    fuelMix,
    // Getters
    isLowFuel,
    isLowBattery,
    // Actions
    startEngine,
    stopEngine,
    activateDrs,
    activateOvertake,
    checkTireStatus,
    getFuelStatus,
    getBatteryStatus,
    performPitStop,
  };
}
