<template>
  <div class="race-control-panel">
    <div class="header-row">
      <h1>{{ t("ui.title") }}</h1>
      <label class="lang-select">
        <span class="visually-hidden">{{ t("ui.language") }}</span>
        <select
          :value="locale"
          @change="onLocaleChange"
          :aria-label="t('ui.language')"
        >
          <option
            v-for="(meta, code) in SUPPORTED_LOCALES"
            :key="code"
            :value="code"
          >
            {{ meta.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="status-panel">
      <div
        :class="['light', { active: isListening }]"
        role="status"
        :aria-label="isListening ? t('ui.radioOpen') : t('ui.radioClosed')"
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
      {{ isListening ? t("ui.stopRadio") : t("ui.openRadio") }}
    </button>

    <button
      @click="showCarModal = true"
      class="car-select-button"
      :disabled="engineStatus"
    >
      {{ selectedCar.label }} ▸ {{ t("ui.selectCar") }}
    </button>

    <CarSelectModal
      :show="showCarModal"
      :selected-id="selectedCar.id"
      @select="onCarSelect"
      @close="showCarModal = false"
    />

    <div class="lap-banner" role="status" aria-live="polite">
      <span v-if="pitting">{{ t("ui.pitting") }}</span>
      <span v-else-if="raceFinished">{{ t("ui.raceComplete") }}</span>
      <span v-else>{{
        t("ui.lap", { lap: currentLap, total: CAR_SETTINGS.TOTAL_LAPS })
      }}</span>
    </div>

    <div class="position-badge" role="status" aria-live="polite">
      <span class="pos-label">{{ t("ui.position") }}</span>
      <span class="pos-value">{{ positionLabel }}</span>
      <span class="pos-gap">{{ gapText }}</span>
    </div>

    <TrackMap
      :player-loop-pos="playerLoopPos"
      :rival-loop-pos="rivalLoopPos"
      :ai-enabled="aiEnabled"
      :aria-label="trackAriaLabel"
    />

    <RpmGauge :rpm="rpm" />

    <div class="dashboard">
      <div class="display-item">
        <h2>{{ t("ui.engine") }}</h2>
        <p :class="['status', engineStatus ? 'on' : 'off']">
          {{ engineStatus ? t("ui.on") : t("ui.off") }}
        </p>
      </div>
      <div class="display-item gear-display">
        <h2>{{ t("ui.gear") }}</h2>
        <div class="gear-indicator" :class="{ shifting: gearFlash }">
          <span class="gear-number" :class="currentGear > 0 ? 'engaged' : 'neutral'">
            {{ currentGear > 0 ? currentGear : 'N' }}
          </span>
        </div>
        <div class="shift-lights">
          <span
            v-for="i in 5"
            :key="i"
            class="shift-led"
            :class="{
              active: rpm > CAR_SETTINGS.GEAR_DROP_RPM - 200 + (i - 1) * 600,
              blink: rpm >= CAR_SETTINGS.GEAR_SHIFT_RPM - 200 && rpm < CAR_SETTINGS.GEAR_SHIFT_RPM,
              shift: rpm >= CAR_SETTINGS.GEAR_SHIFT_RPM,
            }"
          ></span>
        </div>
      </div>
      <div class="display-item segment-display">
        <h2>{{ t("ui.segment") }}</h2>
        <p
          class="segment-badge"
          :class="[
            currentSegmentType,
            currentSegmentSpeed ? `speed-${currentSegmentSpeed}` : '',
          ]"
        >
          {{ currentSegmentLabel }}
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.drs") }}</h2>
        <p :class="['status', drsStatus ? 'on' : 'off']">
          {{ drsStatus ? t("ui.enabled") : t("ui.disabled") }}
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.overtake") }}</h2>
        <p :class="['status', overtakeActive ? 'on' : 'off']">
          {{ overtakeActive ? t("ui.active") : t("ui.ready") }}
        </p>
        <div
          v-if="overtakeActive"
          class="countdown-bar"
          role="progressbar"
          :aria-valuenow="Math.round(overtakeRemaining)"
          aria-valuemin="0"
          :aria-valuemax="100"
          :aria-label="t('ui.overtake')"
        >
          <div
            class="countdown-fill"
            :style="{ width: `${overtakeRemaining}%` }"
          ></div>
        </div>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.tires") }}</h2>
        <p class="status info">
          {{ tireCompound }} - {{ tireStatus }} ({{ tireLife.toFixed(0) }}%)
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.fuelLevel") }}</h2>
        <p :class="['status', isLowFuel ? 'off' : 'info']">
          {{ fuelLevel.toFixed(1) }}%
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.battery") }}</h2>
        <p :class="['status', !isLowBattery ? 'on' : 'off']">
          {{ batteryLevel.toFixed(1) }}%
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.fuelMix") }}</h2>
        <p class="status info">{{ fuelMix }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.ersMode") }}</h2>
        <p class="status info">{{ ersMode }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.speed") }}</h2>
        <p class="status on">{{ speedKmh }} <span class="unit-label">km/h</span></p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.currentLapTime") }}</h2>
        <p class="status info lap-time">{{ formatLapTime(currentLapTime) }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.engineTemp") }}</h2>
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
      <div class="display-item">
        <h2>{{ t("ui.weather") }}</h2>
        <p class="status info">{{ weather }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.damage") }}</h2>
        <p
          :class="[
            'status',
            damageStatus === 'Critical' || damageStatus === 'Major'
              ? 'off'
              : damageStatus === 'Minor'
                ? 'info'
                : 'on',
          ]"
        >
          {{ carDamage.toFixed(0) }}%
        </p>
      </div>
      <div class="display-item car-tile" :style="{ borderColor: selectedCar.markerColor }">
        <h2>{{ t("ui.selectCar") }}</h2>
        <p class="status info">{{ selectedCar.label }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.lastLap") }}</h2>
        <p class="status info">{{ formatLapTime(lastLapTime) }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.bestLap") }}</h2>
        <p class="status info">{{ formatLapTime(bestLapTime) }}</p>
      </div>
      <div class="display-item" :class="{ 'ai-active': aiEnabled }">
        <h2>{{ t("ui.aiRival") }}</h2>
        <p :class="['status', aiEnabled ? 'on' : 'off']">
          <template v-if="aiEnabled">
            {{ aiDifficulty }}
            <span class="ai-sub">
              {{ t("ui.lapShort", { lap: aiCurrentLap }) }} ·
              {{ formatLapTime(aiBestLapTime) }}
            </span>
          </template>
          <template v-else>{{ t("ui.aiOff") }}</template>
        </p>
      </div>
    </div>

    <Leaderboard
      :entries="leaderboard"
      :title="t('ui.leaderboard')"
    />
    <Leaderboard
      v-if="aiEnabled"
      :entries="aiLeaderboard"
      :title="t('ui.aiBoard')"
      ai-board
    />

    <ManualControls
      :active-ai-command="activeAiCommand"
      @command="runCommand"
    />

    <div class="transcript-log">
      <h3>{{ t("ui.lastCommand") }}</h3>
      <p aria-live="polite">{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { useCar, findSegmentAtProgress } from "@/composables/useCar";
import { matchCommand } from "@/composables/commandRouter";
import speechService from "@/services/speechRecognitionService";
import ttsService from "@/services/textToSpeechService";
import { useI18n } from "@/i18n";
import { CAR_SETTINGS } from "@/config";
import { formatPosition } from "@/utils/raceStanding";
import TrackMap from "./TrackMap.vue";
import RpmGauge from "./RpmGauge.vue";
import Leaderboard from "./Leaderboard.vue";
import ManualControls from "./ManualControls.vue";
import CarSelectModal from "./CarSelectModal.vue";

const {
  engineStatus,
  rpm,
  currentGear,
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
  lapProgress,
  raceFinished,
  pitting,
  isLowBattery,
  isLowFuel,
  bestLapTime,
  lastLapTime,
  currentLapTime,
  leaderboard,
  weather,
  carDamage,
  damageStatus,
  aiEnabled,
  aiDifficulty,
  aiCurrentLap,
  aiBestLapTime,
  aiLeaderboard,
  standings,
  playerLoopPos,
  rivalLoopPos,
  speedKmh,
  startEngine,
  stopEngine,
  activateDrs,
  deactivateDrs,
  activateOvertake,
  setFuelMix,
  setErsMode,
  setTireCompound,
  setWeather,
  setAiDifficulty,
  disableAi,
  getAiStatus,
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
  selectedCar,
  formatLapTime,
} = useCar();

const { t, locale, speechLang, setLocale, SUPPORTED_LOCALES } = useI18n();

watch(
  speechLang,
  (lang) => {
    speechService.setLanguage(lang);
    ttsService.setLanguage(lang);
  },
  { immediate: true },
);

const onLocaleChange = (event) => {
  setLocale(event.target.value);
};

const isListening = ref(false);
const statusMessage = ref(t("ui.openRadio"));
const lastTranscript = ref("...");
const showCarModal = ref(false);

const onCarSelect = async (carId) => {
  const message = await selectCar(carId);
  statusMessage.value = message;
  showCarModal.value = false;
};

watch(locale, () => {
  if (!isListening.value) {
    statusMessage.value = t("ui.openRadio");
  }
});

const overtakeRemaining = ref(0);
let overtakeCountdownInterval = null;

const activeAiCommand = ref(null);

const gearFlash = ref(false);
let gearFlashTimeout = null;

watch(currentGear, () => {
  if (currentGear.value > 0) {
    gearFlash.value = true;
    if (gearFlashTimeout) clearTimeout(gearFlashTimeout);
    gearFlashTimeout = setTimeout(() => {
      gearFlash.value = false;
    }, 300);
  }
});

const currentSegmentInfo = computed(() => findSegmentAtProgress(lapProgress.value));
const currentSegmentType = computed(() => currentSegmentInfo.value.segment.type);
const currentSegmentSpeed = computed(() => currentSegmentInfo.value.segment.speed || null);
const currentSegmentLabel = computed(() => {
  if (currentSegmentType.value === "straight") return t("ui.segStraight");
  if (currentSegmentSpeed.value === "slow") return t("ui.segCornerSlow");
  if (currentSegmentSpeed.value === "medium") return t("ui.segCornerMedium");
  if (currentSegmentSpeed.value === "fast") return t("ui.segCornerFast");
  return t("ui.segStraight");
});

const positionLabel = computed(() =>
  formatPosition(standings.value.playerPosition),
);
const gapText = computed(() => {
  const s = standings.value;
  if (s.leader === null) return t("ui.solo");
  const laps = Math.abs(s.gap).toFixed(1);
  return t(s.leader === "player" ? "msg.gapAhead" : "msg.gapBehind", { laps });
});
const trackAriaLabel = computed(() =>
  `${t("ui.trackMap")}: ${positionLabel.value}, ${gapText.value}`,
);

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
  bestLap: getBestLap,
  position: getPosition,
  tempStatus: getTempStatus,
  tireStatus: checkTireStatus,
  fuelStatus: getFuelStatus,
  batteryStatus: getBatteryStatus,
  damageStatus: getDamageStatus,
  weatherStatus: getWeatherStatus,
  weatherDry: () => setWeather("DRY"),
  weatherCloudy: () => setWeather("CLOUDY"),
  weatherWet: () => setWeather("WET"),
  weatherStorm: () => setWeather("STORM"),
  aiEasy: () => setAiDifficulty("EASY"),
  aiMedium: () => setAiDifficulty("MEDIUM"),
  aiHard: () => setAiDifficulty("HARD"),
  aiRandom: () => setAiDifficulty("RANDOM"),
  aiOff: disableAi,
  aiStatus: getAiStatus,
  carSpeedster: () => selectCar("speedster"),
  carBalanced: () => selectCar("balanced"),
  carGripmaster: () => selectCar("gripmaster"),
  carEndurance: () => selectCar("endurance"),
};

const runCommand = async (command) => {
  if (!command || !commandActions[command]) {
    return t("msg.notRecognized", { transcript: "" });
  }
  let message;
  try {
    message = await commandActions[command]();
  } catch (err) {
    console.warn("Command action failed:", command, err);
    message = t("msg.notRecognized", { transcript: "" });
  }
  if (command === "overtake" && overtakeActive.value) {
    startOvertakeCountdown();
  }
  if (command.startsWith("ai") && command !== "aiStatus" && command !== "aiOff") {
    activeAiCommand.value = command;
  }
  if (command === "reset") {
    activeAiCommand.value = null;
  }
  statusMessage.value = message;
  return message;
};

const startOvertakeCountdown = () => {
  if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
  const start = Date.now();
  overtakeRemaining.value = 100;
  overtakeCountdownInterval = setInterval(() => {
    // Stop the countdown if overtake ended early (stall/overheat/finish).
    if (!overtakeActive.value) {
      clearInterval(overtakeCountdownInterval);
      overtakeCountdownInterval = null;
      return;
    }
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

const processCommand = async (transcript) => {
  lastTranscript.value = transcript;

  // Pause recognition — keep isManuallyStopped=true during processing so the
  // async onend handler doesn't fire its own restart. We'll clear it below
  // right before our deliberate restart.
  speechService.stopListening();
  isListening.value = false;

  const command = matchCommand(transcript, locale.value);

  if (command && commandActions[command]) {
    await runCommand(command);
  } else {
    statusMessage.value = t("msg.notRecognized", { transcript });
  }

  setTimeout(() => {
    // Clear the manual-stop flag so toggleListening can restart cleanly.
    speechService.resetManualStop();
    toggleListening(true);
  }, 500);
};

const toggleListening = (forceStart = false) => {
  if (isListening.value && !forceStart) {
    speechService.stopListening();
    isListening.value = false;
    statusMessage.value = t("ui.radioClosed");
  } else {
    const started = speechService.startListening(processCommand, handleError, {
      lang: speechLang.value,
    });
    if (started) {
      isListening.value = true;
      statusMessage.value = t("ui.radioOpen");
    } else {
      isListening.value = false;
    }
  }
};

const handleError = (error) => {
  const errorCode =
    typeof error === "string"
      ? error
      : error?.error || error?.message || "unknown";
  let errorMessage = t("err.unknown");
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      errorMessage = t("err.micDenied");
      break;
    case "audio-capture":
      errorMessage = t("err.audioCapture");
      break;
    case "not-supported":
      errorMessage = t("err.notSupported");
      break;
    case "no-speech":
      errorMessage = t("err.noSpeech");
      break;
    case "network":
      errorMessage = t("err.network");
      break;
  }
  statusMessage.value = errorMessage;
  isListening.value = false;
};

onUnmounted(() => {
  speechService.stopListening();
  if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
  if (gearFlashTimeout) clearTimeout(gearFlashTimeout);
});

if (import.meta.env.DEV) {
  window.__simulateRaceEnd = () => {
    raceFinished.value = true;
    lapProgress.value = 0;
    engineStatus.value = false;
    rpm.value = 0;
    currentGear.value = 0;
    drsStatus.value = false;
    overtakeActive.value = false;
  };
}
</script>

<style scoped>
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

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.header-row h1 {
  margin-bottom: 0;
  flex: 1;
}
.lang-select select {
  font-family: "Orbitron", sans-serif;
  background-color: #2a2a2a;
  color: #00ffff;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 0.8rem;
  cursor: pointer;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

.car-select-button {
  display: block;
  width: 100%;
  padding: 10px;
  font-size: 0.9rem;
  font-family: "Orbitron", sans-serif;
  color: #00ffff;
  background-color: #2a2a2a;
  border: 1px solid #00ffff;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 1.5rem;
  transition: background-color 0.2s, opacity 0.2s;
}
.car-select-button:hover:not(:disabled) {
  background-color: #333;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
}
.car-select-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.unit-label {
  font-size: 0.6rem;
  color: #888;
  font-weight: normal;
  vertical-align: super;
}
.lap-time {
  font-family: monospace;
}

.lap-banner {
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
  color: #00ffff;
  letter-spacing: 1px;
  margin-bottom: 1.5rem;
}

.position-badge {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.position-badge .pos-label {
  color: #aaa;
  font-size: 0.8rem;
  text-transform: uppercase;
}
.position-badge .pos-value {
  color: #00ffff;
  font-size: 1.6rem;
  font-weight: bold;
}
.position-badge .pos-gap {
  color: #ffdc00;
  font-size: 0.9rem;
  font-family: monospace;
}

.segment-display {
  grid-column: span 1;
}
.segment-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.segment-badge.straight {
  color: #111;
  background-color: #2ecc40;
}
.segment-badge.corner.speed-slow {
  color: #fff;
  background-color: #ff4136;
}
.segment-badge.corner.speed-medium {
  color: #111;
  background-color: #ffdc00;
}
.segment-badge.corner.speed-fast {
  color: #111;
  background-color: #ff851b;
}

.gear-display {
  grid-column: span 1;
}
.gear-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 0.25rem;
}
.gear-number {
  font-size: 2.4rem;
  font-weight: bold;
  line-height: 1;
  transition:
    color 0.15s,
    transform 0.15s;
}
.gear-number.engaged {
  color: #00ffff;
}
.gear-number.neutral {
  color: #ff4136;
}
.gear-indicator.shifting .gear-number {
  color: #ffdc00;
  transform: scale(1.3);
}

.shift-lights {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 0.3rem;
}
.shift-led {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #333;
  transition:
    background-color 0.2s,
    box-shadow 0.2s;
}
.shift-led.active {
  background-color: #2ecc40;
  box-shadow: 0 0 6px #2ecc40;
}
.shift-led.active:nth-child(4),
.shift-led.active:nth-child(5) {
  background-color: #ffdc00;
  box-shadow: 0 0 6px #ffdc00;
}
.shift-led.blink {
  animation: led-blink 0.15s ease-in-out 3;
}
.shift-led.shift {
  background-color: #ff4136;
  box-shadow: 0 0 8px #ff4136;
  animation: led-blink 0.1s ease-in-out 4;
}
@keyframes led-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.display-item.ai-active {
  border: 1px solid #ff851b;
  border-radius: 8px;
  padding: 0.3rem;
  background: rgba(255, 133, 27, 0.08);
}

.car-tile {
  border: 1px solid #444;
  border-radius: 8px;
  padding: 0.3rem;
}

.ai-sub {
  display: block;
  font-size: 0.7rem;
  color: #aaa;
  font-weight: normal;
  margin-top: 0.2rem;
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
}

@media (min-width: 1024px) {
  .race-control-panel {
    max-width: 700px;
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
