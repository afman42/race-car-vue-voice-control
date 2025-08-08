<template>
  <div class="race-control-panel">
    <h1>Race Car Voice Control</h1>

    <div class="status-panel">
      <div :class="['light', { 'active': isListening }]"></div>
      <p class="status-text">{{ statusMessage }}</p>
    </div>

    <button @click="toggleListening" class="control-button" :disabled="isSpeaking">
      {{ isListening ? 'Stop Radio' : 'Open Radio Channel' }}
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
            strokeDashoffset: rpmNeedleOffset
          }"
        ></path>
        <text x="50" y="45" class="rpm-text">{{ rpm.toFixed(0) }}</text>
        <text x="50" y="55" class="rpm-label">RPM</text>
      </svg>
    </div>

    <div class="dashboard">
      <div class="display-item"><h2>Engine</h2><p :class="['status', engineStatus ? 'on' : 'off']">{{ engineStatus ? 'ON' : 'OFF' }}</p></div>
      <div class="display-item"><h2>DRS</h2><p :class="['status', drsStatus ? 'on' : 'off']">{{ drsStatus ? 'ENABLED' : 'DISABLED' }}</p></div>
      <div class="display-item"><h2>Overtake</h2><p :class="['status', overtakeActive ? 'on' : 'off']">{{ overtakeActive ? 'ACTIVE' : 'READY' }}</p></div>
      <div class="display-item"><h2>Tires</h2><p class="status info">{{ tireStatus }}</p></div>
      <div class="display-item"><h2>Fuel Level</h2><p class="status info">{{ fuelLevel }}%</p></div>
      <div class="display-item"><h2>Battery</h2><p :class="['status', !isLowBattery ? 'on' : 'off']">{{ batteryLevel }}%</p></div>
    </div>

    <div class="transcript-log">
        <h3>Last Command Heard:</h3>
        <p>{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCar } from '@/composables/useCar';
import speechService from '@/services/speechRecognitionService';
import ttsService from '@/services/textToSpeechService';
import { CAR_SETTINGS } from '@/config';

// --- GET ALL CAR LOGIC AND STATE FROM THE COMPOSABLE ---
const {
  engineStatus, rpm, drsStatus, overtakeActive, tireStatus, fuelLevel, batteryLevel, isLowBattery,
  startEngine, stopEngine, activateDrs, activateOvertake, checkTireStatus, getFuelStatus, getBatteryStatus, performPitStop
} = useCar();


// --- UI-ONLY STATE ---
const isListening = ref(false);
const isSpeaking = ref(false);
const statusMessage = ref('Open Radio Channel');
const lastTranscript = ref('...');
const isManuallyStopped = ref(true);


// --- SVG GAUGE LOGIC (Remains in component as it's tied to a DOM element) ---
const gaugeNeedlePath = ref(null);
const gaugeCircumference = ref(0);
onMounted(() => {
  if (gaugeNeedlePath.value) {
    gaugeCircumference.value = gaugeNeedlePath.value.getTotalLength();
  }
});
const rpmNeedleOffset = computed(() => {
  if (gaugeCircumference.value === 0) return 0;
  const rpmPercentage = rpm.value / CAR_SETTINGS.RPM_MAX;
  return gaugeCircumference.value * (1 - rpmPercentage);
});


// --- METHODS THAT INTERACT WITH SERVICES AND THE COMPOSABLE ---
const speakAndSetStatus = (text) => {
  statusMessage.value = text;
  isSpeaking.value = true;
  ttsService.speak(text);
  setTimeout(() => { isSpeaking.value = false; }, 2000);
};

// This function is now much simpler! It just maps transcripts to actions.
const processCommand = async (transcript) => {
  lastTranscript.value = transcript;
  let response = { message: 'Copy that. Standing by.' }; // Default response

  if (transcript.includes('start engine')) { response = startEngine(); }
  else if (transcript.includes('stop engine')) { response = stopEngine(); }
  else if (transcript.includes('activate drs')) { response = activateDrs(); }
  else if (transcript.includes('activate overtake')) { response = activateOvertake(); }
  else if (transcript.includes('tire status')) { response = { message: checkTireStatus() }; }
  else if (transcript.includes('fuel status')) { response = { message: getFuelStatus() }; }
  else if (transcript.includes('battery status')) { response = { message: getBatteryStatus() }; }
  else if (transcript.includes('pit stop')) { response = { message: await performPitStop() }; }
  
  // No need for complex audio sequencing here, it's handled in the composable's actions.
  speakAndSetStatus(response.message);

  setTimeout(() => {
    if (!isManuallyStopped.value) { toggleListening(true); }
  }, 1500);
};

const toggleListening = (forceStart = false) => {
  if (isListening.value && !forceStart) {
    isManuallyStopped.value = true;
    speechService.stopListening();
    isListening.value = false;
    statusMessage.value = 'Radio Channel Closed';
  } else {
    isManuallyStopped.value = false;
    speechService.startListening(processCommand, handleError);
    isListening.value = true;
    statusMessage.value = 'Radio Open: Listening...';
  }
};


// The rest of the functions (handleError, toggleListening) remain the same.
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
  rpm.value = 0;
  engineStatus.value = false;
  speakAndSetStatus(errorMessage);
};
onUnmounted(() => {
  speechService.stopListening();
  // The simulation interval will be cleared automatically by the watcher in the composable
});
</script>

<style scoped>
/* =============================================== */
/* 1. Base Styles (Mobile-First) 📱              */
/* =============================================== */
.race-control-panel {
  font-family: "Orbitron", sans-serif;
  background-color: #1e1e1e;
  color: #e0e0e0;
  margin: 1rem auto; /* Use margin for spacing */
  padding: 1.5rem; /* Reduced padding for small screens */
  border-radius: 15px;
  border: 2px solid #444;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
  width: 90%; /* Fluid width */
  max-width: 500px; /* Max width for larger phones */
  box-sizing: border-box; /* Ensures padding is included in width */
}

h1 {
  color: #00ffff;
  text-align: center;
  text-transform: uppercase;
  font-size: 1.5rem; /* Smaller font size for mobile */
  margin-bottom: 1.5rem;
}

.status-text {
  font-size: 1rem;
  font-weight: bold;
}

.control-button {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  /* ... other button styles remain the same */
  display: block;
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

/* The dashboard grid is already nicely responsive! */
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  text-align: center;
}

.display-item h2 {
  font-size: 0.9rem;
}

.display-item .status {
  font-size: 1.5rem;
}

/* SVG Gauge sizing for mobile */
.rpm-gauge {
  width: 220px;
}

/* =============================================== */
/* 2. Tablet Styles                              */
/* =============================================== */
@media (min-width: 768px) {
  .race-control-panel {
    padding: 2rem;
    max-width: 600px;
  }

  h1 {
    font-size: 2rem; /* Increase font size */
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
    width: 250px; /* Slightly larger gauge */
  }
}

/* =============================================== */
/* 3. Desktop Styles                             */
/* =============================================== */
@media (min-width: 1024px) {
  .race-control-panel {
    max-width: 700px;
  }

  .rpm-gauge {
    width: 300px; /* Even larger gauge for desktop */
  }

  .display-item .status {
    font-size: 1.8rem; /* Larger status text */
  }
}

/* --- Unchanged Styles Below --- */

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
.control-button:hover:not(:disabled) {
  background-color: #39cccc;
  box-shadow: 0 0 15px #00ffff;
}
.control-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}
.display-item h2 {
  color: #aaa;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
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
.gauge-container {
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
}
.rpm-gauge {
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
  /* REMOVE these two lines from the CSS */
  /* stroke-dasharray: 125.6; */
  /* stroke-dashoffset: 125.6; */
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
</style>


// The rest of the functions (handleError, toggleListening) remain the same.
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
  rpm.value = 0;
  engineStatus.value = false;
  speakAndSetStatus(errorMessage);
};
</script>

<style scoped>
/* =============================================== */
/* 1. Base Styles (Mobile-First) 📱              */
/* =============================================== */
.race-control-panel {
  font-family: "Orbitron", sans-serif;
  background-color: #1e1e1e;
  color: #e0e0e0;
  margin: 1rem auto; /* Use margin for spacing */
  padding: 1.5rem; /* Reduced padding for small screens */
  border-radius: 15px;
  border: 2px solid #444;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
  width: 90%; /* Fluid width */
  max-width: 500px; /* Max width for larger phones */
  box-sizing: border-box; /* Ensures padding is included in width */
}

h1 {
  color: #00ffff;
  text-align: center;
  text-transform: uppercase;
  font-size: 1.5rem; /* Smaller font size for mobile */
  margin-bottom: 1.5rem;
}

.status-text {
  font-size: 1rem;
  font-weight: bold;
}

.control-button {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  /* ... other button styles remain the same */
  display: block;
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

/* The dashboard grid is already nicely responsive! */
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  text-align: center;
}

.display-item h2 {
  font-size: 0.9rem;
}

.display-item .status {
  font-size: 1.5rem;
}

/* SVG Gauge sizing for mobile */
.rpm-gauge {
  width: 220px;
}

/* =============================================== */
/* 2. Tablet Styles                              */
/* =============================================== */
@media (min-width: 768px) {
  .race-control-panel {
    padding: 2rem;
    max-width: 600px;
  }

  h1 {
    font-size: 2rem; /* Increase font size */
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
    width: 250px; /* Slightly larger gauge */
  }
}

/* =============================================== */
/* 3. Desktop Styles                             */
/* =============================================== */
@media (min-width: 1024px) {
  .race-control-panel {
    max-width: 700px;
  }

  .rpm-gauge {
    width: 300px; /* Even larger gauge for desktop */
  }

  .display-item .status {
    font-size: 1.8rem; /* Larger status text */
  }
}

/* --- Unchanged Styles Below --- */

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
.control-button:hover:not(:disabled) {
  background-color: #39cccc;
  box-shadow: 0 0 15px #00ffff;
}
.control-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}
.display-item h2 {
  color: #aaa;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
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
.gauge-container {
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
}
.rpm-gauge {
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
  /* REMOVE these two lines from the CSS */
  /* stroke-dasharray: 125.6; */
  /* stroke-dashoffset: 125.6; */
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
</style>
