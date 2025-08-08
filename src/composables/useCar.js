// src/composables/useCar.js

import { ref, computed, watch } from "vue";
import { CAR_SETTINGS } from "@/config";
import audioService from "@/services/audioService";

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
    let consumptionRate =
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE[fuelMix.value.toUpperCase()] ||
      CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;

    if (fuelLevel.value > 0) {
      fuelLevel.value = parseFloat(
        Math.max(0, fuelLevel.value - consumptionRate).toFixed(2),
      );
    }

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
  const startEngine = () => {
    if (engineStatus.value)
      return { success: false, message: "The engine is already running." };

    engineStatus.value = true;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    audioService.playSound("engineStart");
    return { success: true, message: "Engine started." };
  };

  const stopEngine = () => {
    if (!engineStatus.value)
      return { success: false, message: "The engine is already off." };

    engineStatus.value = false;
    rpm.value = 0;
    drsStatus.value = false;
    audioService.playSound("engineStop");
    return { success: true, message: "Engine stopped." };
  };

  const activateDrs = () => {
    if (!engineStatus.value)
      return {
        success: false,
        message: "Cannot activate DRS. The engine is off.",
      };
    if (drsStatus.value)
      return { success: false, message: "DRS is already active." };

    drsStatus.value = true;
    audioService.playSound("drsOn");
    return { success: true, message: "DRS enabled." };
  };

  const activateOvertake = () => {
    if (overtakeActive.value)
      return { success: false, message: "Overtake is already active." };
    if (!engineStatus.value)
      return {
        success: false,
        message: "Cannot activate overtake, engine is off.",
      };
    if (batteryLevel.value < CAR_SETTINGS.OVERTAKE_BATTERY_COST)
      return { success: false, message: "Not enough battery for overtake." };

    overtakeActive.value = true;
    batteryLevel.value -= CAR_SETTINGS.OVERTAKE_BATTERY_COST;
    rpm.value += CAR_SETTINGS.RPM_OVERTAKE_BOOST;
    audioService.playSound("overtakeOn");

    setTimeout(() => {
      overtakeActive.value = false;
      rpm.value = engineStatus.value ? CAR_SETTINGS.RPM_IDLE : 0;
    }, CAR_SETTINGS.OVERTAKE_DURATION_MS);

    return { success: true, message: "Overtake mode activated." };
  };

  const checkTireStatus = () => {
    if (!engineStatus.value) {
      tireStatus.value = "Cold";
      return "Tires are cold.";
    }
    tireStatus.value = "Optimal";
    return "Tires are in the optimal window.";
  };

  const getFuelStatus = () => {
    if (isLowFuel.value)
      return `Fuel is critical, only ${fuelLevel.value} percent remaining!`;
    return `Fuel level is at ${fuelLevel.value} percent.`;
  };

  const getBatteryStatus = () => {
    if (isLowBattery.value)
      return `Battery level critical at ${batteryLevel.value} percent.`;
    return `Battery is at ${batteryLevel.value} percent.`;
  };

  const performPitStop = async () => {
    stopEngine(); // Use existing actions
    await new Promise((resolve) =>
      setTimeout(resolve, CAR_SETTINGS.PIT_STOP_DURATION_MS),
    );

    fuelLevel.value = 100;
    batteryLevel.value = 100;
    tireStatus.value = "New";

    startEngine();
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
