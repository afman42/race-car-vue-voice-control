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
          ref="gaugeNeedlePath"
          :style="{
            strokeDasharray: gaugeCircumference,
            strokeDashoffset: rpmNeedleOffset,
          }"
        ></path>
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
import { ref, computed, onMounted, onUnmounted } from "vue"; // Make sure onMounted is imported
import speechService from "@/services/speechRecognitionService";
import ttsService from "@/services/textToSpeechService";
// NEW: Import the audio service
import audioService from "@/services/audioService";

// --- State Variables (remain the same) ---
const isListening = ref(false);
const statusMessage = ref('Click "Start Listening" to begin');
const lastTranscript = ref("...");
const engineStatus = ref(false);
const drsStatus = ref(false);
const tireStatus = ref("Cold");
const isSpeaking = ref(false);
const rpm = ref(0);
const maxRpm = 8000;
const gaugeCircumference = 125.6;

// -- NEW DYNAMIC GAUGE LOGIC --
// Create a ref to hold our SVG path element
const gaugeNeedlePath = ref(null);
// Create a ref for the circumference, default to 0
const gaugeCircumference = ref(0);

// --- Computed Properties ---
const rpmNeedleOffset = computed(() => {
  if (gaugeCircumference.value === 0) return 0; // Avoid division by zero before mounted
  const rpmPercentage = rpm.value / maxRpm;
  // The calculation remains the same, but now uses the dynamic circumference
  return gaugeCircumference.value * (1 - rpmPercentage);
});

// --- Lifecycle Hooks ---
// NEW: Load sounds when the component is mounted
onMounted(() => {
  audioService.loadSounds();
  if (gaugeNeedlePath.value) {
    const length = gaugeNeedlePath.value.getTotalLength();
    console.log("Measured Gauge Path Length:", length); // You'll see the exact value!
    gaugeCircumference.value = length;
  }
});

onUnmounted(() => {
  speechService.stopListening();
  window.speechSynthesis.cancel();
});

// --- Core Logic ---
const speakAndSetStatus = (text) => {
  // This function remains the same
  statusMessage.value = text;
  isSpeaking.value = true;
  ttsService.speak(text);
  setTimeout(() => {
    isSpeaking.value = false;
  }, 2000);
};

// *** MAKE THIS FUNCTION ASYNC ***
const processCommand = async (transcript) => {
  lastTranscript.value = transcript;
  let response = 'Unknown command.';
  let soundToPlay = null;

  // --- Determine command and sound ---
  if (transcript.includes('start engine')) {
    engineStatus.value = true;
    rpm.value = 750;
    response = 'Engine started.';
    soundToPlay = 'engineStart';
  } else if (transcript.includes('stop engine') || transcript.includes("shut down")
) {
    engineStatus.value = false;
    rpm.value = 0;
    response = 'Engine stopped.';
    soundToPlay = 'engineStop';
  } else if (transcript.includes('activate drs')  || transcript.includes("enable drs")) {
    drsStatus.value = true;
    response = 'DRS enabled.';
    soundToPlay = 'drsOn';
  }else if (
    transcript.includes("deactivate drs") ||
    transcript.includes("disable drs")
  ) {
    drsStatus.value = false;
    response = "DRS disabled.";
    soundToPlay = 'drsOff';
  } else if (
    transcript.includes("check tires") ||
    transcript.includes("tire status")
  ) {
    tireStatus.value = "Optimal Temp";
    response = "Tires are at optimal temperature.";
    // No sound needed for this one, but you could add a "computer beep"
  } else if (transcript.includes("pit stop")) {
    tireStatus.value = "New Set";
    drsStatus.value = false;
    rpm.value = 750;
    response = "Pit stop confirmed. New tires fitted.";
    // Could add a sound of an impact wrench here!
  }

  speakAndSetStatus(response);
};
  }

  // --- Execute the sequence ---
  // 1. Immediately stop listening to free up the audio hardware
  speechService.stopListening();
  isListening.value = false; // Manually update UI state

  // 2. Play the sound effect and WAIT for it to finish
  if (soundToPlay) {
    try {
      await audioService.playSound(soundToPlay);
    } catch (error) {
      console.error("Error playing sound, proceeding anyway.", error);
    }
  }

  // 3. Give text-to-speech feedback
  speakAndSetStatus(response);

  // 4. Restart listening AFTER everything else is done
  // We add a small delay to ensure TTS doesn't conflict
  setTimeout(() => {
    // Only restart if the user hasn't manually stopped it in the meantime
    if (!isManuallyStopped.value) { // We'll need a new ref for this
        toggleListening(true); // Restart listening
    }
  }, 1500); // Adjust delay as needed
};

// We need a ref to track the user's intent
const isManuallyStopped = ref(false);

const toggleListening = (forceStart = false) => {
  if (isListening.value && !forceStart) {
    isManuallyStopped.value = true;
    speechService.stopListening();
    isListening.value = false;
    statusMessage.value = 'Listening stopped.';
  } else {
    isManuallyStopped.value = false;
    speechService.startListening(processCommand, handleError);
    isListening.value = true;
    statusMessage.value = 'Listening... Speak a command!';
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
