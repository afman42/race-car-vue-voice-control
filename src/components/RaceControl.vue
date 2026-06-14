<template>
  <div class="race-control-panel">
    <h1>Race Car Voice Control</h1>

    <div class="status-panel">
      <div
        :class="['light', { active: isListening }]"
        role="status"
        :aria-label="isListening ? 'Radio channel open' : 'Radio channel closed'"
      ></div>
      <p class="status-text" role="status" aria-live="polite">
        {{ statusMessage }}
      </p>
    </div>

    <button
      @click="toggleListening"
      class="control-button"
      :aria-pressed="isListening"
    >
      {{ isListening ? "Stop Radio" : "Open Radio Channel" }}
    </button>

    <div class="lap-banner" role="status" aria-live="polite">
      <span v-if="raceFinished">Race Complete</span>
      <span v-else>Lap {{ currentLap }} / {{ CAR_SETTINGS.TOTAL_LAPS }}</span>
    </div>

    <div class="gauge-container">
      <svg
        class="rpm-gauge"
        viewBox="0 0 100 57"
        role="img"
        :aria-label="`Engine RPM ${rpm.toFixed(0)}`"
      >
        <path class="gauge-bg" d="M10 50 A 40 40 0 0 1 90 50"></path>
        <path
          class="gauge-needle"
          d="M10 50 A 40 40 0 0 1 90 50"
          ref="gaugeNeedlePath"
          :style="{
            strokeDasharray: gaugeCircumference,
            strokeDashoffset: rpmNeedleOffset,
          }"
        ></path>
        <text x="50" y="45" class="rpm-text">{{ rpm.toFixed(0) }}</text>
        <text x="50" y="55" class="rpm-label">RPM</text>
      </svg>
    </div>

    <div class="dashboard">
      <div class="display-item">
        <h2>Engine</h2>
        <p :class="['status', engineStatus ? 'on' : 'off']">
          {{ engineStatus ? "ON" : "OFF" }}
        </p>
      </div>
      <div class="display-item">
        <h2>DRS</h2>
        <p :class="['status', drsStatus ? 'on' : 'off']">
          {{ drsStatus ? "ENABLED" : "DISABLED" }}
        </p>
      </div>
      <div class="display-item">
        <h2>Overtake</h2>
        <p :class="['status', overtakeActive ? 'on' : 'off']">
          {{ overtakeActive ? "ACTIVE" : "READY" }}
        </p>
        <div
          v-if="overtakeActive"
          class="countdown-bar"
          role="progressbar"
          :aria-valuenow="Math.round(overtakeRemaining)"
          aria-valuemin="0"
          :aria-valuemax="100"
          aria-label="Overtake time remaining"
        >
          <div
            class="countdown-fill"
            :style="{ width: `${overtakeRemaining}%` }"
          ></div>
        </div>
      </div>
      <div class="display-item">
        <h2>Tires</h2>
        <p class="status info">
          {{ tireCompound }} - {{ tireStatus }} ({{ tireLife.toFixed(0) }}%)
        </p>
      </div>
      <div class="display-item">
        <h2>Fuel Level</h2>
        <p :class="['status', isLowFuel ? 'off' : 'info']">
          {{ fuelLevel.toFixed(1) }}%
        </p>
      </div>
      <div class="display-item">
        <h2>Battery</h2>
        <p :class="['status', !isLowBattery ? 'on' : 'off']">
          {{ batteryLevel.toFixed(1) }}%
        </p>
      </div>
      <div class="display-item">
        <h2>Fuel Mix</h2>
        <p class="status info">{{ fuelMix }}</p>
      </div>
      <div class="display-item">
        <h2>ERS Mode</h2>
        <p class="status info">{{ ersMode }}</p>
      </div>
      <div class="display-item">
        <h2>Engine Temp</h2>
        <p
          :class="[
            'status',
            tempStatus === 'Critical'
              ? 'off'
              : tempStatus === 'Hot'
                ? 'info'
                : 'on',
          ]"
        >
          {{ engineTemp.toFixed(0) }}&deg;C
        </p>
      </div>
    </div>

    <div class="manual-controls">
      <h3>Manual Controls</h3>
      <div class="button-grid">
        <button
          v-for="ctrl in manualControls"
          :key="ctrl.label"
          class="ctrl-button"
          @click="runCommand(ctrl.command)"
        >
          {{ ctrl.label }}
        </button>
      </div>
    </div>

    <div class="transcript-log">
      <h3>Last Command Heard:</h3>
      <p aria-live="polite">{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useCar } from "@/composables/useCar";
import { matchCommand } from "@/composables/commandRouter";
import speechService from "@/services/speechRecognitionService";
import { CAR_SETTINGS } from "@/config";

// --- 1. Get All Car Logic & State from the Composable ---
const {
  engineStatus,
  rpm,
  drsStatus,
  overtakeActive,
  tireStatus,
  tireLife,
  tireCompound,
  fuelLevel,
  batteryLevel,
  fuelMix,
  ersMode,
  engineTemp,
  tempStatus,
  currentLap,
  raceFinished,
  isLowBattery,
  isLowFuel,
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
} = useCar();

// --- 2. UI-Only State (Specific to this component) ---
const isListening = ref(false);
const statusMessage = ref("Open Radio Channel");
const lastTranscript = ref("...");

// Overtake countdown (percent remaining, 100 -> 0).
const overtakeRemaining = ref(0);
let overtakeCountdownInterval = null;

// --- 3. DOM-Specific Logic (SVG Gauge Measurement) ---
const gaugeNeedlePath = ref(null);
const gaugeCircumference = ref(0);

onMounted(() => {
  if (
    gaugeNeedlePath.value &&
    typeof gaugeNeedlePath.value.getTotalLength === "function"
  ) {
    gaugeCircumference.value = gaugeNeedlePath.value.getTotalLength();
  }
});

const rpmNeedleOffset = computed(() => {
  if (gaugeCircumference.value === 0) return gaugeCircumference.value;
  const rpmPercentage = rpm.value / CAR_SETTINGS.RPM_MAX;
  return gaugeCircumference.value * (1 - rpmPercentage);
});

// --- 4. Command Dispatch ---

// Maps command keys (from the router) to the composable action that runs them.
const commandActions = {
  help: getHelp,
  pitStop: performPitStop,
  reset: resetRace,
  startEngine,
  stopEngine,
  tireSoft: () => setTireCompound("SOFT"),
  tireMedium: () => setTireCompound("MEDIUM"),
  tireHard: () => setTireCompound("HARD"),
  fuelMixLean: () => setFuelMix("LEAN"),
  fuelMixRich: () => setFuelMix("RICH"),
  fuelMixStandard: () => setFuelMix("STANDARD"),
  ersHotlap: () => setErsMode("HOTLAP"),
  ersCharge: () => setErsMode("CHARGE"),
  ersBalanced: () => setErsMode("BALANCED"),
  overtake: activateOvertake,
  deactivateDrs,
  activateDrs,
  lapStatus: getLapStatus,
  tempStatus: getTempStatus,
  tireStatus: checkTireStatus,
  fuelStatus: getFuelStatus,
  batteryStatus: getBatteryStatus,
};

// #8: keyboard/click fallback so the app is usable without a microphone.
const manualControls = [
  { label: "Start Engine", command: "startEngine" },
  { label: "Stop Engine", command: "stopEngine" },
  { label: "DRS On", command: "activateDrs" },
  { label: "DRS Off", command: "deactivateDrs" },
  { label: "Overtake", command: "overtake" },
  { label: "Pit Stop", command: "pitStop" },
  { label: "Mix Lean", command: "fuelMixLean" },
  { label: "Mix Standard", command: "fuelMixStandard" },
  { label: "Mix Rich", command: "fuelMixRich" },
  { label: "ERS Hotlap", command: "ersHotlap" },
  { label: "ERS Balanced", command: "ersBalanced" },
  { label: "ERS Charge", command: "ersCharge" },
  { label: "Soft Tires", command: "tireSoft" },
  { label: "Medium Tires", command: "tireMedium" },
  { label: "Hard Tires", command: "tireHard" },
  { label: "Lap Status", command: "lapStatus" },
  { label: "Temp Status", command: "tempStatus" },
  { label: "Reset", command: "reset" },
];

/**
 * Run a resolved command key against the composable and update the UI.
 * Shared by both voice dispatch and the manual control buttons.
 */
const runCommand = async (command) => {
  if (!command || !commandActions[command]) {
    return `Command not recognized.`;
  }
  const message = await commandActions[command]();
  if (command === "overtake" && overtakeActive.value) {
    startOvertakeCountdown();
  }
  statusMessage.value = message;
  return message;
};

/**
 * Start the visual countdown bar for the overtake boost.
 */
const startOvertakeCountdown = () => {
  if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
  const start = Date.now();
  overtakeRemaining.value = 100;
  overtakeCountdownInterval = setInterval(() => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(
      0,
      100 - (elapsed / CAR_SETTINGS.OVERTAKE_DURATION_MS) * 100,
    );
    overtakeRemaining.value = remaining;
    if (remaining <= 0) {
      clearInterval(overtakeCountdownInterval);
      overtakeCountdownInterval = null;
    }
  }, 100);
};

/**
 * Main command processor. Maps a voice transcript to a composable action.
 */
const processCommand = async (transcript) => {
  lastTranscript.value = transcript;

  // Stop listening immediately to prevent feedback loops
  speechService.stopListening();
  isListening.value = false;

  const command = matchCommand(transcript);

  if (command && commandActions[command]) {
    await runCommand(command);
  } else {
    // #5: tell the user we heard them but didn't understand the command.
    statusMessage.value = `Command not recognized: "${transcript}". Please repeat.`;
  }

  // Restart the listening loop if not manually stopped
  setTimeout(() => {
    if (!speechService.isManuallyStopped()) {
      toggleListening(true);
    }
  }, 500);
};

/**
 * Toggles the master listening state.
 */
const toggleListening = (forceStart = false) => {
  if (isListening.value && !forceStart) {
    speechService.stopListening();
    isListening.value = false;
    statusMessage.value = "Radio Channel Closed";
  } else {
    const started = speechService.startListening(processCommand, handleError);
    if (started) {
      isListening.value = true;
      statusMessage.value = "Radio Open: Listening...";
    } else {
      isListening.value = false;
    }
  }
};

/**
 * Handles errors from the speech recognition service.
 */
const handleError = (error) => {
  const errorCode =
    typeof error === "string"
      ? error
      : error?.error || error?.message || "unknown";
  let errorMessage = "An unknown error occurred.";
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      errorMessage = "Error: Microphone access denied.";
      break;
    case "not-supported":
      errorMessage = "Error: Speech recognition not supported.";
      break;
    case "no-speech":
      errorMessage = "Copy that, standing by.";
      break;
    case "network":
      errorMessage = "Network error with radio signal.";
      break;
  }
  statusMessage.value = errorMessage;
  isListening.value = false;
};

/**
 * Clean up when the component is removed from the page.
 */
onUnmounted(() => {
  speechService.stopListening();
  if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
});
</script>

<style scoped>
/* =============================================== */
/* 1. Base Styles (Mobile-First)                   */
/* =============================================== */
.race-control-panel {
  font-family: "Orbitron", sans-serif;
  background-color: #1e1e1e;
  color: #e0e0e0;
  margin: 1rem auto;
  padding: 1.5rem;
  border-radius: 15px;
  border: 2px solid #444;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
  width: 90%;
  max-width: 500px;
  box-sizing: border-box;
}

h1 {
  color: #00ffff;
  text-align: center;
  text-transform: uppercase;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

.status-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 1.5rem;
}
.light {
  width: 20px;
  height: 20px;
  background-color: #ff4136;
  border-radius: 50%;
  transition: background-color 0.3s;
}
.light.active {
  background-color: #2ecc40;
  box-shadow: 0 0 10px #2ecc40;
}
.status-text {
  font-size: 1rem;
  font-weight: bold;
}

.control-button {
  display: block;
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  color: #1e1e1e;
  background-color: #00ffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2rem;
  transition:
    background-color 0.3s,
    box-shadow 0.3s;
}

.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  text-align: center;
}

.display-item h2 {
  color: #aaa;
  font-size: 0.9rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.display-item .status {
  font-size: 1.5rem;
  font-weight: bold;
}
.status.on {
  color: #2ecc40;
}
.status.off {
  color: #ff4136;
}
.status.info {
  color: #ffdc00;
}

.countdown-bar {
  margin-top: 0.5rem;
  width: 100%;
  height: 6px;
  background-color: #333;
  border-radius: 3px;
  overflow: hidden;
}
.countdown-fill {
  height: 100%;
  background-color: #00ffff;
  border-radius: 3px;
  transition: width 0.1s linear;
}

.lap-banner {
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
  color: #00ffff;
  letter-spacing: 1px;
  margin-bottom: 1.5rem;
}

.manual-controls {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
}
.manual-controls h3 {
  color: #aaa;
  font-size: 0.9rem;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 1rem;
}
.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.5rem;
}
.ctrl-button {
  padding: 8px;
  font-size: 0.8rem;
  font-family: "Orbitron", sans-serif;
  color: #e0e0e0;
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}
.ctrl-button:hover {
  background-color: #333;
  border-color: #00ffff;
  color: #00ffff;
}

.gauge-container {
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
}
.rpm-gauge {
  width: 220px;
  transform: rotateX(180deg);
}
.gauge-bg,
.gauge-needle {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}
.gauge-bg {
  stroke: #333;
}
.gauge-needle {
  stroke: #00ffff;
  transition: stroke-dashoffset 0.8s cubic-bezier(0.6, 0, 0.2, 1);
}
.rpm-text,
.rpm-label {
  font-family: "Orbitron", sans-serif;
  text-anchor: middle;
  transform: rotateX(180deg);
}
.rpm-text {
  fill: #fff;
  font-size: 20px;
  font-weight: bold;
}
.rpm-label {
  fill: #888;
  font-size: 8px;
}

.transcript-log {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
  color: #888;
}
.transcript-log p {
  font-family: monospace;
  font-style: italic;
  background-color: #2a2a2a;
  padding: 0.5rem;
  border-radius: 4px;
}

/* =============================================== */
/* 2. Tablet Styles                                */
/* =============================================== */
@media (min-width: 768px) {
  .race-control-panel {
    padding: 2rem;
    max-width: 600px;
  }
  h1 {
    font-size: 2rem;
  }
  .status-text {
    font-size: 1.2rem;
  }
  .control-button {
    padding: 15px;
    font-size: 1.2rem;
  }
  .dashboard {
    gap: 1.5rem;
  }
  .rpm-gauge {
    width: 250px;
  }
}

/* =============================================== */
/* 3. Desktop Styles                               */
/* =============================================== */
@media (min-width: 1024px) {
  .race-control-panel {
    max-width: 700px;
  }
  .rpm-gauge {
    width: 300px;
  }
  .display-item .status {
    font-size: 1.8rem;
  }
}

.control-button:hover:not(:disabled) {
  background-color: #39cccc;
  box-shadow: 0 0 15px #00ffff;
}
.control-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}
</style>
