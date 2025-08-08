<template>
  <div class="race-control-panel">
    <h1>Race Car Voice Control</h1>
    <div class="status-panel">
      <div :class="['light', { active: isListening }]"></div>
      <p class="status-text">{{ statusMessage }}</p>
    </div>

    <button
      @click="toggleListening"
      class="control-button"
      :disabled="isSpeaking"
    >
      {{ isListening ? "Stop Listening" : "Start Listening" }}
    </button>

    <div class="gauge-container">
      <svg class="rpm-gauge" viewBox="0 0 100 57">
        <path class="gauge-bg" d="M10 50 A 40 40 0 0 1 90 50"></path>
        <path
          class="gauge-needle"
          d="M10 50 A 40 40 0 0 1 90 50"
          :style="{ strokeDashoffset: rpmNeedleOffset }"
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
        <h2>Tires</h2>
        <p class="status info">{{ tireStatus }}</p>
      </div>
    </div>

    <div class="transcript-log">
      <h3>Last Command Heard:</h3>
      <p>{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from "vue";
import speechService from "@/services/speechRecognitionService";
// NEW: Import the TTS service
import ttsService from "@/services/textToSpeechService";

// --- State Variables ---
const isListening = ref(false);
const statusMessage = ref('Click "Start Listening" to begin');
const lastTranscript = ref("...");

// Dashboard states
const engineStatus = ref(false);
const drsStatus = ref(false);
const tireStatus = ref("Cold");
const isSpeaking = ref(false); // To disable button while TTS is active

// NEW: RPM Gauge State
const rpm = ref(0);
const maxRpm = 8000;
const gaugeCircumference = 125.6; // Circumference of the semi-circle path

// --- Computed Properties ---
// NEW: Computed property for the SVG needle animation
const rpmNeedleOffset = computed(() => {
  const rpmPercentage = rpm.value / maxRpm;
  return gaugeCircumference * (1 - rpmPercentage);
});

// --- Core Logic ---

const speakAndSetStatus = (text) => {
  statusMessage.value = text;
  isSpeaking.value = true;
  ttsService.speak(text);
  // A simple way to re-enable the button after speech
  setTimeout(() => {
    isSpeaking.value = false;
  }, 2000);
};

const processCommand = (transcript) => {
  lastTranscript.value = transcript;
  let response = "Unknown command.";

  if (transcript.includes("start engine")) {
    engineStatus.value = true;
    rpm.value = 750; // Idle RPM
    response = "Engine started.";
  } else if (
    transcript.includes("stop engine") ||
    transcript.includes("shut down")
  ) {
    engineStatus.value = false;
    rpm.value = 0;
    response = "Engine stopped.";
  } else if (
    transcript.includes("activate drs") ||
    transcript.includes("enable drs")
  ) {
    drsStatus.value = true;
    response = "DRS enabled.";
  } else if (
    transcript.includes("deactivate drs") ||
    transcript.includes("disable drs")
  ) {
    drsStatus.value = false;
    response = "DRS disabled.";
  } else if (
    transcript.includes("check tires") ||
    transcript.includes("tire status")
  ) {
    tireStatus.value = "Optimal Temp";
    response = "Tires are at optimal temperature.";
  } else if (transcript.includes("pit stop")) {
    tireStatus.value = "New Set";
    drsStatus.value = false;
    rpm.value = 750; // Engine stays on in pit
    response = "Pit stop confirmed. New tires fitted.";
  }

  speakAndSetStatus(response);
};

// ENHANCED: Error Handling
const handleError = (error) => {
  let errorMessage = "An unknown error occurred.";
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      errorMessage =
        "Error: Microphone access denied. Please enable it in your browser settings and refresh the page.";
      break;
    case "no-speech":
      errorMessage = "I didn't hear anything. Please try again.";
      break;
    case "network":
      errorMessage = "Network error. Please check your connection.";
      break;
  }
  isListening.value = false;
  rpm.value = 0; // Reset visuals on error
  engineStatus.value = false;
  speakAndSetStatus(errorMessage);
};

const toggleListening = () => {
  if (isListening.value) {
    speechService.stopListening();
    isListening.value = false;
    statusMessage.value = "Listening stopped.";
  } else {
    speechService.startListening(processCommand, handleError);
    isListening.value = true;
    statusMessage.value = "Listening... Speak a command!";
  }
};

onUnmounted(() => {
  speechService.stopListening();
  window.speechSynthesis.cancel(); // Stop any speech on exit
});
</script>

<style scoped>
/* Previous styles remain the same... */
.race-control-panel {
  font-family: "Orbitron", sans-serif;
  background-color: #1e1e1e;
  color: #e0e0e0;
  padding: 2rem;
  border-radius: 15px;
  max-width: 600px;
  margin: 2rem auto;
  border: 2px solid #444;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
}
h1 {
  color: #00ffff;
  text-align: center;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
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
  font-size: 1.2rem;
  font-weight: bold;
}
.control-button {
  display: block;
  width: 100%;
  padding: 15px;
  font-size: 1.2rem;
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
.control-button:hover:not(:disabled) {
  background-color: #39cccc;
  box-shadow: 0 0 15px #00ffff;
}
.control-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
  text-align: center;
}
.display-item h2 {
  color: #aaa;
  font-size: 1rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.display-item .status {
  font-size: 1.8rem;
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

/* NEW: SVG Gauge Styles */
.gauge-container {
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
}
.rpm-gauge {
  width: 250px;
  transform: rotateX(180deg); /* Flip SVG for intuitive drawing */
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
  stroke-dasharray: 125.6; /* Circumference of the arc */
  stroke-dashoffset: 125.6; /* Initially empty */
  transition: stroke-dashoffset 0.8s cubic-bezier(0.6, 0, 0.2, 1);
}
.rpm-text,
.rpm-label {
  font-family: "Orbitron", sans-serif;
  text-anchor: middle;
  transform: rotateX(180deg); /* Flip text back */
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
</style>
