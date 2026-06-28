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

    <div class="lap-banner" role="status" aria-live="polite">
      <span v-if="raceFinished">{{ t("ui.raceComplete") }}</span>
      <span v-else>{{
        t("ui.lap", { lap: currentLap, total: CAR_SETTINGS.TOTAL_LAPS })
      }}</span>
    </div>

    <div class="position-badge" role="status" aria-live="polite">
      <span class="pos-label">{{ t("ui.position") }}</span>
      <span class="pos-value">{{ positionLabel }}</span>
      <span class="pos-gap">{{ gapText }}</span>
    </div>

    <div class="track-map">
      <h3 class="visually-hidden">{{ t("ui.trackMap") }}</h3>
      <svg
        class="track-svg"
        viewBox="0 0 100 60"
        role="img"
        :aria-label="trackAriaLabel"
      >
        <path
          class="track-path"
          ref="trackPath"
          d="M 20 10 H 80 A 20 20 0 0 1 80 50 H 20 A 20 20 0 0 1 20 10 Z"
        ></path>
        <!-- Segment boundary markers (corner indicators) -->
        <circle
          v-for="(m, i) in segmentMarkers"
          :key="`seg-${i}`"
          :cx="m.x"
          :cy="m.y"
          r="2.5"
          :class="[
            'seg-boundary',
            m.isCorner ? 'corner' : 'straight',
            m.speed ? `speed-${m.speed}` : '',
          ]"
        ></circle>
        <!-- Start/finish line -->
        <line
          class="start-finish"
          :x1="segmentMarkers.length > 0 ? segmentMarkers[0].x : 20"
          :y1="segmentMarkers.length > 0 ? segmentMarkers[0].y - 4 : 10"
          :x2="segmentMarkers.length > 0 ? segmentMarkers[0].x : 20"
          :y2="segmentMarkers.length > 0 ? segmentMarkers[0].y + 4 : 18"
        />
        <circle
          class="track-marker player"
          :cx="playerMarker.x"
          :cy="playerMarker.y"
          r="4"
        ></circle>
        <circle
          v-if="aiEnabled"
          class="track-marker rival"
          :cx="rivalMarker.x"
          :cy="rivalMarker.y"
          r="4"
        ></circle>
        <!-- Segment legend (uses distinct classes to avoid counting in tests) -->
        <g class="map-legend">
          <circle cx="75" cy="7" r="2" class="legend-dot dot-straight" />
          <text x="79" y="10" class="legend-label">{{ t("ui.segStraight") }}</text>
          <circle cx="75" cy="15" r="2" class="legend-dot dot-corner-slow" />
          <text x="79" y="18" class="legend-label">{{ t("ui.segCornerSlow") }}</text>
          <circle cx="75" cy="23" r="2" class="legend-dot dot-corner-medium" />
          <text x="79" y="26" class="legend-label">{{ t("ui.segCornerMedium") }}</text>
          <circle cx="75" cy="31" r="2" class="legend-dot dot-corner-fast" />
          <text x="79" y="34" class="legend-label">{{ t("ui.segCornerFast") }}</text>
        </g>
      </svg>
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
              active: rpm > CAR_SETTINGS.GEAR_SHIFT_RPM - (5 - i) * 600,
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
      <div class="display-item">
        <h2>{{ t("ui.bestLap") }}</h2>
        <p class="status info">{{ formatLapTime(bestLapTime) }}</p>
      </div>
      <div class="display-item">
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

    <div
      v-if="leaderboard.length"
      class="leaderboard"
      role="region"
      :aria-label="t('ui.leaderboard')"
    >
      <h3>{{ t("ui.leaderboard") }}</h3>
      <ol>
        <li v-for="(entry, index) in leaderboard" :key="`${entry.lap}-${index}`">
          <span class="lb-rank">{{ index + 1 }}</span>
          <span class="lb-lap">{{ t("ui.lapShort", { lap: entry.lap }) }}</span>
          <span class="lb-time">{{ formatLapTime(entry.time) }}</span>
        </li>
      </ol>
    </div>

    <div
      v-if="aiEnabled && aiLeaderboard.length"
      class="leaderboard ai-board"
      role="region"
      :aria-label="t('ui.aiBoard')"
    >
      <h3>{{ t("ui.aiBoard") }}</h3>
      <ol>
        <li
          v-for="(entry, index) in aiLeaderboard"
          :key="`ai-${entry.lap}-${index}`"
        >
          <span class="lb-rank">{{ index + 1 }}</span>
          <span class="lb-lap">{{ t("ui.lapShort", { lap: entry.lap }) }}</span>
          <span class="lb-time">{{ formatLapTime(entry.time) }}</span>
        </li>
      </ol>
    </div>

    <div class="manual-controls">
      <h3>{{ t("ui.manualControls") }}</h3>
      <div class="button-grid">
        <button
          v-for="ctrl in manualControls"
          :key="ctrl.command"
          class="ctrl-button"
          @click="runCommand(ctrl.command)"
        >
          {{ t(ctrl.labelKey) }}
        </button>
      </div>
    </div>

    <div class="transcript-log">
      <h3>{{ t("ui.lastCommand") }}</h3>
      <p aria-live="polite">{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useCar } from "@/composables/useCar";
import { matchCommand } from "@/composables/commandRouter";
import speechService from "@/services/speechRecognitionService";
import ttsService from "@/services/textToSpeechService";
import { useI18n } from "@/i18n";
import { CAR_SETTINGS } from "@/config";
import { formatPosition } from "@/utils/raceStanding";
import { findSegmentAtProgress } from "@/composables/useCar";

// --- 1. Get All Car Logic & State from the Composable ---
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
  aiFinished,
  standings,
  playerLoopPos,
  rivalLoopPos,
  currentSegmentIndex,
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
  formatLapTime,
} = useCar();

// --- i18n ---
const { t, locale, speechLang, setLocale, SUPPORTED_LOCALES } = useI18n();

// Keep both speech services in sync with the active locale, and update the
// idle status message so it follows the language too.
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

// --- 2. UI-Only State (Specific to this component) ---
const isListening = ref(false);
const statusMessage = ref(t("ui.openRadio"));
const lastTranscript = ref("...");

// Keep the idle status text localized when the language changes while idle.
watch(locale, () => {
  if (!isListening.value) {
    statusMessage.value = t("ui.openRadio");
  }
});

// Overtake countdown (percent remaining, 100 -> 0).
const overtakeRemaining = ref(0);
let overtakeCountdownInterval = null;

// Gear shift flash animation trigger.
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

// --- 3. DOM-Specific Logic (SVG Gauge Measurement) ---
const gaugeNeedlePath = ref(null);
const gaugeCircumference = ref(0);

// Track map: measured path length lets us place markers via getPointAtLength.
const trackPath = ref(null);
const trackLength = ref(0);

onMounted(() => {
  if (
    gaugeNeedlePath.value &&
    typeof gaugeNeedlePath.value.getTotalLength === "function"
  ) {
    gaugeCircumference.value = gaugeNeedlePath.value.getTotalLength();
  }
  if (
    trackPath.value &&
    typeof trackPath.value.getTotalLength === "function"
  ) {
    trackLength.value = trackPath.value.getTotalLength();
  }
});

const rpmNeedleOffset = computed(() => {
  if (gaugeCircumference.value === 0) return gaugeCircumference.value;
  const rpmPercentage = rpm.value / CAR_SETTINGS.RPM_MAX;
  return gaugeCircumference.value * (1 - rpmPercentage);
});

// Resolve a 0..1 loop fraction to an {x, y} point on the track path. Falls back
// to a fixed point when SVG geometry is unavailable (e.g. jsdom under tests).
const pointAt = (fraction) => {
  const path = trackPath.value;
  if (
    !path ||
    trackLength.value === 0 ||
    typeof path.getPointAtLength !== "function"
  ) {
    return { x: 50, y: 10 };
  }
  const pt = path.getPointAtLength(fraction * trackLength.value);
  return { x: pt.x, y: pt.y };
};

const playerMarker = computed(() => pointAt(playerLoopPos.value));
const rivalMarker = computed(() => pointAt(rivalLoopPos.value));

// Pre-compute segment boundary positions along the track path (0..1).
// Used to render colored markers on the SVG track map.
const segmentBoundaries = computed(() => {
  let accumulated = 0;
  const boundaries = [];
  for (const seg of CAR_SETTINGS.TRACK_LAYOUT) {
    accumulated += seg.length;
    boundaries.push(accumulated / CAR_SETTINGS.LAP_DISTANCE);
  }
  // The last boundary equals 1.0 (start/finish line), which is the same as 0.
  return boundaries;
});

// Derive the current track segment directly from lapProgress so the UI stays
// in sync even when lapProgress is set manually (important for tests).
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

// Compute marker positions for each segment boundary on the SVG path.
const segmentMarkers = computed(() => {
  return segmentBoundaries.value.map((frac, i) => {
    const seg = CAR_SETTINGS.TRACK_LAYOUT[i % CAR_SETTINGS.TRACK_LAYOUT.length];
    const isCorner = seg.type === "corner";
    return {
      frac,
      x: pointAt(frac).x,
      y: pointAt(frac).y,
      isCorner,
      speed: seg.speed || null,
    };
  });
});

// Position badge text derived from the shared standings computed.
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
};

// #8: keyboard/click fallback so the app is usable without a microphone.
const manualControls = [
  { labelKey: "btn.startEngine", command: "startEngine" },
  { labelKey: "btn.stopEngine", command: "stopEngine" },
  { labelKey: "btn.drsOn", command: "activateDrs" },
  { labelKey: "btn.drsOff", command: "deactivateDrs" },
  { labelKey: "btn.overtake", command: "overtake" },
  { labelKey: "btn.pitStop", command: "pitStop" },
  { labelKey: "btn.mixLean", command: "fuelMixLean" },
  { labelKey: "btn.mixStandard", command: "fuelMixStandard" },
  { labelKey: "btn.mixRich", command: "fuelMixRich" },
  { labelKey: "btn.ersHotlap", command: "ersHotlap" },
  { labelKey: "btn.ersBalanced", command: "ersBalanced" },
  { labelKey: "btn.ersCharge", command: "ersCharge" },
  { labelKey: "btn.tireSoft", command: "tireSoft" },
  { labelKey: "btn.tireMedium", command: "tireMedium" },
  { labelKey: "btn.tireHard", command: "tireHard" },
  { labelKey: "btn.lapStatus", command: "lapStatus" },
  { labelKey: "btn.position", command: "position" },
  { labelKey: "btn.tempStatus", command: "tempStatus" },
  { labelKey: "btn.bestLap", command: "bestLap" },
  { labelKey: "btn.damageStatus", command: "damageStatus" },
  { labelKey: "btn.weatherDry", command: "weatherDry" },
  { labelKey: "btn.weatherCloudy", command: "weatherCloudy" },
  { labelKey: "btn.weatherWet", command: "weatherWet" },
  { labelKey: "btn.weatherStorm", command: "weatherStorm" },
  { labelKey: "btn.aiEasy", command: "aiEasy" },
  { labelKey: "btn.aiMedium", command: "aiMedium" },
  { labelKey: "btn.aiHard", command: "aiHard" },
  { labelKey: "btn.aiRandom", command: "aiRandom" },
  { labelKey: "btn.aiOff", command: "aiOff" },
  { labelKey: "btn.reset", command: "reset" },
];

/**
 * Run a resolved command key against the composable and update the UI.
 * Shared by both voice dispatch and the manual control buttons.
 */
const runCommand = async (command) => {
  if (!command || !commandActions[command]) {
    return t("msg.notRecognized", { transcript: "" });
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

  const command = matchCommand(transcript, locale.value);

  if (command && commandActions[command]) {
    await runCommand(command);
  } else {
    // #5: tell the user we heard them but didn't understand the command.
    statusMessage.value = t("msg.notRecognized", { transcript });
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

/**
 * Handles errors from the speech recognition service.
 */
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

/**
 * Clean up when the component is removed from the page.
 */
onUnmounted(() => {
  speechService.stopListening();
  if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
  if (gearFlashTimeout) clearTimeout(gearFlashTimeout);
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

.track-map {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
  position: relative;
}
.track-svg {
  width: 70%;
  max-width: 280px;
}
.track-path {
  fill: none;
  stroke: #333;
  stroke-width: 3;
  stroke-linecap: round;
}
.track-marker {
  transition:
    cx 0.4s linear,
    cy 0.4s linear;
}
.track-marker.player {
  fill: #00ffff;
  filter: drop-shadow(0 0 3px #00ffff);
}
.track-marker.rival {
  fill: #ff851b;
  filter: drop-shadow(0 0 3px #ff851b);
}

/* Segment boundary markers on the track map */
.seg-boundary {
  stroke-width: 0;
}
.seg-boundary.straight {
  fill: #2ecc40;
}
.seg-boundary.corner.speed-slow {
  fill: #ff4136;
}
.seg-boundary.corner.speed-medium {
  fill: #ffdc00;
}
.seg-boundary.corner.speed-fast {
  fill: #ff851b;
}

/* Start/finish line */
.start-finish {
  stroke: #fff;
  stroke-width: 1.2;
  stroke-dasharray: 2 2;
  opacity: 0.7;
}

/* Track map legend */
.map-legend {
  opacity: 0;
  transition: opacity 0.3s;
}
.track-svg:hover .map-legend {
  opacity: 0.8;
}
.legend-label {
  fill: #ccc;
  font-size: 2.5px;
  font-family: "Orbitron", sans-serif;
}
.legend-dot {
  stroke: none;
}
.legend-dot.dot-straight {
  fill: #2ecc40;
}
.legend-dot.dot-corner-slow {
  fill: #ff4136;
}
.legend-dot.dot-corner-medium {
  fill: #ffdc00;
}
.legend-dot.dot-corner-fast {
  fill: #ff851b;
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

.leaderboard {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
}
.leaderboard h3 {
  color: #aaa;
  font-size: 0.9rem;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 1rem;
}
.leaderboard ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.leaderboard li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.6rem;
  background-color: #2a2a2a;
  border-radius: 6px;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}
.leaderboard li:first-child {
  border: 1px solid #00ffff;
}
.lb-rank {
  color: #00ffff;
  font-weight: bold;
  width: 1.5rem;
  text-align: center;
}
.lb-lap {
  color: #aaa;
  flex: 1;
}
.lb-time {
  color: #ffdc00;
  font-family: monospace;
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

/* AI rival board: tinted to distinguish it from the player's own laps. */
.ai-board li:first-child {
  border-color: #ff851b;
}
.ai-board .lb-rank {
  color: #ff851b;
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
