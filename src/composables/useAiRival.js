// src/composables/useAiRival.js

import { ref, computed } from "vue";
import { CAR_SETTINGS, AI_DIFFICULTY } from "@/config";
import ttsService from "@/services/textToSpeechService";
import { t } from "@/i18n";
import { formatLapTime } from "@/utils/formatLapTime";

// The AI rival is modeled as a lap-time generator, not a full physics car: it
// has no engine/fuel/tire sim. Each tick it accrues progress toward its next
// lap target (set by difficulty) and, on completion, posts a time to its own
// board. This keeps the human car's state completely independent.
//
// State lives at module scope so useCar() and any other caller share one rival,
// matching the singleton pattern used by useCar.

const enabled = ref(false);
const difficulty = ref(AI_DIFFICULTY.MEDIUM.label);
const currentLap = ref(1);
const lapProgress = ref(0); // 0..1 fraction of the current lap completed
const lapTarget = ref(0); // ms the current lap is expected to take
const currentLapTime = ref(0); // ms accrued into the current lap
const bestLapTime = ref(null);
const leaderboard = ref([]); // { lap, time } sorted fastest-first
const finished = ref(false);

// Resolve the active difficulty config from its display label.
const config = computed(
  () =>
    Object.values(AI_DIFFICULTY).find((d) => d.label === difficulty.value) ||
    AI_DIFFICULTY.MEDIUM,
);

// Compute the next target lap time from difficulty: a faster base for higher
// paceFactor, plus a random swing bounded by variance.
const nextLapTarget = () => {
  const { paceFactor, variance } = config.value;
  const base = CAR_SETTINGS.AI_BASE_LAP_MS / paceFactor;
  const swing = 1 + (Math.random() * 2 - 1) * variance;
  return base * swing;
};

// Record a completed lap onto the board and track the best.
const recordLap = (lapNumber, timeMs) => {
  const time = Math.round(timeMs);
  if (bestLapTime.value === null || time < bestLapTime.value) {
    bestLapTime.value = time;
  }
  const next = [...leaderboard.value, { lap: lapNumber, time }];
  next.sort((a, b) => a.time - b.time);
  leaderboard.value = next.slice(0, CAR_SETTINGS.LEADERBOARD_SIZE);
};

// Reset race progress while keeping the selected difficulty.
const resetProgress = () => {
  currentLap.value = 1;
  lapProgress.value = 0;
  lapTarget.value = 0;
  currentLapTime.value = 0;
  bestLapTime.value = null;
  leaderboard.value = [];
  finished.value = false;
};

// Advance the rival one simulation tick. It accrues ms toward the current lap
// target; on reaching the target it banks the lap and rolls a new target.
const tick = () => {
  if (!enabled.value || finished.value) return;
  if (lapTarget.value <= 0) lapTarget.value = nextLapTarget();

  currentLapTime.value += CAR_SETTINGS.LAP_TIME_PER_TICK_MS;
  lapProgress.value = Math.min(1, currentLapTime.value / lapTarget.value);

  while (currentLapTime.value >= lapTarget.value && !finished.value) {
    recordLap(currentLap.value, lapTarget.value);
    currentLapTime.value -= lapTarget.value;
    if (currentLap.value >= CAR_SETTINGS.TOTAL_LAPS) {
      finished.value = true;
      lapProgress.value = 1;
      ttsService.speak(t("msg.aiFinished"));
      return;
    }
    currentLap.value += 1;
    lapTarget.value = nextLapTarget();
    lapProgress.value = Math.min(1, currentLapTime.value / lapTarget.value);
  }
};

// Enable the rival at a given difficulty (EASY/MEDIUM/HARD or RANDOM).
// RANDOM resolves to one of the concrete levels immediately.
const setDifficulty = async (level) => {
  const key = String(level).toUpperCase();

  let resolvedKey = key;
  if (key === "RANDOM") {
    const keys = Object.keys(AI_DIFFICULTY);
    resolvedKey = keys[Math.floor(Math.random() * keys.length)];
  }

  if (!AI_DIFFICULTY[resolvedKey]) {
    const message = t("msg.unknownDifficulty", { level });
    await ttsService.speak(message);
    return message;
  }

  // Reset progress BEFORE enabling so the simulation watcher sees
  // finished=false before enabled=true, avoiding a race where the
  // watcher runs mid-transition and skips starting the sim.
  resetProgress();
  difficulty.value = AI_DIFFICULTY[resolvedKey].label;
  enabled.value = true;

  const message = t("msg.aiEnabled", { label: AI_DIFFICULTY[resolvedKey].label });
  await ttsService.speak(message);
  return message;
};

// Turn the rival off and clear its progress.
const disable = async () => {
  if (!enabled.value) {
    const message = t("msg.aiAlreadyOff");
    await ttsService.speak(message);
    return message;
  }
  enabled.value = false;
  resetProgress();
  const message = t("msg.aiDisabled");
  await ttsService.speak(message);
  return message;
};

// Speak and return the rival's current status.
const getStatus = async () => {
  let message;
  if (!enabled.value) {
    message = t("msg.aiOff");
  } else if (bestLapTime.value === null) {
    message = t("msg.aiStatusNoLap", {
      difficulty: difficulty.value,
      lap: currentLap.value,
      total: CAR_SETTINGS.TOTAL_LAPS,
    });
  } else {
    message = t("msg.aiStatus", {
      difficulty: difficulty.value,
      lap: currentLap.value,
      total: CAR_SETTINGS.TOTAL_LAPS,
      best: formatLapTime(bestLapTime.value),
    });
  }
  await ttsService.speak(message);
  return message;
};

/**
 * AI rival composable. Returns the shared singleton rival state and actions.
 */
export function useAiRival() {
  return {
    // State
    enabled,
    difficulty,
    currentLap,
    lapProgress,
    bestLapTime,
    leaderboard,
    finished,
    // Getters
    config,
    // Actions
    tick,
    setDifficulty,
    disable,
    resetProgress,
    getStatus,
  };
}
