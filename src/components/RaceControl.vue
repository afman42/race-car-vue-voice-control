<template>
  <div class="race-control-panel">
    <h1>Race Car Voice Control</h1>

    <div class="status-panel">
      <div :class="['light', { active: isListening }]"></div>
      <p class="status-text">{{ statusMessage }}</p>
    </div>

    <button @click="toggleListening" class="control-button">
      {{ isListening ? "Stop Radio" : "Open Radio Channel" }}
    </button>

    <div class="gauge-container">
      <svg class="rpm-gauge" viewBox="0 0 100 57">
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
      </div>
      <div class="display-item">
        <h2>Tires</h2>
        <p class="status info">{{ tireStatus }}</p>
      </div>
      <div class="display-item">
        <h2>Fuel Level</h2>
        <p class="status info">{{ fuelLevel.toFixed(1) }}%</p>
      </div>
      <div class="display-item">
        <h2>Battery</h2>
        <p :class="['status', !isLowBattery ? 'on' : 'off']">
          {{ batteryLevel.toFixed(1) }}%
        </p>
      </div>
    </div>

    <div class="transcript-log">
      <h3>Last Command Heard:</h3>
      <p>{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useCar } from "@/composables/useCar";
import speechService from "@/services/speechRecognitionService";
import { CAR_SETTINGS } from "@/config";

// --- 1. Get All Car Logic & State from the Composable ---
const {
  engineStatus,
  rpm,
  drsStatus,
  overtakeActive,
  tireStatus,
  fuelLevel,
  batteryLevel,
  isLowBattery,
  startEngine,
  stopEngine,
  activateDrs,
  activateOvertake,
  checkTireStatus,
  getFuelStatus,
  getBatteryStatus,
  performPitStop,
} = useCar();

// --- 2. UI-Only State (Specific to this component) ---
const isListening = ref(false);
const statusMessage = ref("Open Radio Channel");
const lastTranscript = ref("...");
const isManuallyStopped = ref(true);

// --- 3. DOM-Specific Logic (SVG Gauge Measurement) ---
const gaugeNeedlePath = ref(null);
const gaugeCircumference = ref(0);

onMounted(() => {
  if (gaugeNeedlePath.value) {
    gaugeCircumference.value = gaugeNeedlePath.value.getTotalLength();
  }
});

const rpmNeedleOffset = computed(() => {
  if (gaugeCircumference.value === 0) return gaugeCircumference.value;
  const rpmPercentage = rpm.value / CAR_SETTINGS.RPM_MAX;
  return gaugeCircumference.value * (1 - rpmPercentage);
});

// --- 4. Methods to Connect UI to Services and Composables ---

/**
 * Main command processor. Maps a voice transcript to a composable action.
 */
const processCommand = async (transcript) => {
  lastTranscript.value = transcript;
  let message = "Copy that. Standing by."; // Default message for unknown commands

  // Stop listening immediately to prevent feedback loops
  speechService.stopListening();
  isListening.value = false;

  // Map transcript to the appropriate async action from our composable
  if (transcript.includes("start engine")) {
    message = await startEngine();
  } else if (
    transcript.includes("stop engine") ||
    transcript.includes("shut down")
  ) {
    message = await stopEngine();
  } else if (
    transcript.includes("activate drs") ||
    transcript.includes("enable drs") ||
    transcript.includes("drs") ||
    transcript.includes("dr")
  ) {
    message = await activateDrs();
  } else if (
    transcript.includes("activate overtake") ||
    transcript.includes("enable overtake") ||
    transcript.includes("overtake") ||
    transcript.includes("take")
  ) {
    message = await activateOvertake();
  } else if (
    transcript.includes("tire status") ||
    transcript.includes("check tire") ||
    transcript.includes("tire") ||
    transcript.includes("t")
  ) {
    message = await checkTireStatus();
  } else if (
    transcript.includes("fuel status") ||
    transcript.includes("tank status") ||
    transcript.includes("tank")
  ) {
    message = await getFuelStatus();
  } else if (
    transcript.includes("battery status") ||
    transcript.includes("battery")
  ) {
    message = await getBatteryStatus();
  } else if (transcript.includes("pit stop")) {
    message = await performPitStop();
  }

  // Update the UI with the final message from the action
  statusMessage.value = message;

  // Restart the listening loop if not manually stopped
  setTimeout(() => {
    if (!isManuallyStopped.value) {
      toggleListening(true);
    }
  }, 500);
};

/**
 * Toggles the master listening state.
 */
const toggleListening = (forceStart = false) => {
  if (isListening.value && !forceStart) {
    isManuallyStopped.value = true;
    speechService.stopListening();
    isListening.value = false;
    statusMessage.value = "Radio Channel Closed";
  } else {
    isManuallyStopped.value = false;
    speechService.startListening(processCommand, handleError);
    isListening.value = true;
    statusMessage.value = "Radio Open: Listening...";
  }
};

/**
 * Handles errors from the speech recognition service.
 */
const handleError = (error) => {
  let errorMessage = "An unknown error occurred.";
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      errorMessage = "Error: Microphone access denied.";
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
