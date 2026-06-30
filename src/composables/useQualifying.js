// src/composables/useQualifying.js
//
// Qualifying mode logic extracted from useCar.js. Manages the 3-lap shootout
// session: starting a session, querying status, and computing grid position
// from player vs AI best lap times.
//
// State lives in useCarState.js; this composable only contains the
// qualifying-specific actions and computeds.

import { computed } from "vue";
import {
  raceMode,
  raceFinished,
  qualifyingLapsRemaining,
  qualifyingResults,
  qualifyingBestLap,
  engineStatus,
  currentGear,
  rpm,
  ai,
  _resetSingletons,
} from "./useCarState";
import { CAR_SETTINGS, QUALIFYING } from "@/config";
import engineAudioService from "@/services/engineAudioService";
import ttsService from "@/services/textToSpeechService";
import { t } from "@/i18n";
import { formatLapTime } from "@/utils/formatLapTime";

export function useQualifying() {
  // Compute qualifying grid position: compare player vs AI best lap times.
  // If AI has no time (disabled), player always starts P1.
  // If player has no time, they start P2.
  const computedQualifyingPosition = computed(() => {
    if (raceMode.value !== "qualifying") return 1;
    if (ai.qualifyingBestLap.value === null) return 1;
    if (qualifyingBestLap.value === null) return 2;
    return qualifyingBestLap.value <= ai.qualifyingBestLap.value ? 1 : 2;
  });

  // Qualifying info for display
  const qualifyingInfo = computed(() => ({
    active: raceMode.value === "qualifying" && !raceFinished.value,
    lapsRemaining: qualifyingLapsRemaining.value,
    bestLap: qualifyingBestLap.value,
    aiBestLap: ai.qualifyingBestLap.value,
    position: computedQualifyingPosition.value,
    sessionEnded: raceFinished.value && raceMode.value === "qualifying",
  }));

  // Start a qualifying session (3-lap shootout).
  const startQualifying = async () => {
    if (engineStatus.value) {
      const message = t("msg.qualiEngineRunning");
      await ttsService.speak(message);
      return message;
    }

    // Reset all state to defaults before setting qualifying mode.
    _resetSingletons();
    ai.resetProgress();

    // Set qualifying mode.
    raceMode.value = "qualifying";
    qualifyingLapsRemaining.value = QUALIFYING.LAPS;
    qualifyingResults.value = [];
    qualifyingBestLap.value = null;
    ai.setQualifyingMode(true);

    // Start engine automatically for qualifying.
    engineStatus.value = true;
    currentGear.value = 1;
    rpm.value = CAR_SETTINGS.GEAR_START_RPM;
    engineAudioService.start(CAR_SETTINGS.GEAR_START_RPM);

    const message = t("msg.qualiStarted", { laps: QUALIFYING.LAPS });
    await ttsService.speak(message);
    return message;
  };

  // Get the current qualifying session status via TTS.
  const getQualifyingStatus = async () => {
    if (raceMode.value !== "qualifying") {
      const message = t("msg.qualiNotActive");
      await ttsService.speak(message);
      return message;
    }
    if (qualifyingBestLap.value === null) {
      const message = t("msg.qualiStatus", { lapsRemaining: qualifyingLapsRemaining.value });
      await ttsService.speak(message);
      return message;
    }
    const message = t("msg.qualiStatusWithTime", {
      lapsRemaining: qualifyingLapsRemaining.value,
      best: formatLapTime(qualifyingBestLap.value),
    });
    await ttsService.speak(message);
    return message;
  };

  // Get the player's best qualifying lap time via TTS.
  const getQualifyingBestLap = async () => {
    if (raceMode.value !== "qualifying") {
      const message = t("msg.qualiNotActive");
      await ttsService.speak(message);
      return message;
    }
    if (qualifyingBestLap.value === null) {
      const msg = t("msg.qualiNoLapYet");
      await ttsService.speak(msg);
      return msg;
    }
    const msg = t("msg.qualiBestLap", {
      time: formatLapTime(qualifyingBestLap.value),
    });
    await ttsService.speak(msg);
    return msg;
  };

  return {
    computedQualifyingPosition,
    qualifyingInfo,
    startQualifying,
    getQualifyingStatus,
    getQualifyingBestLap,
  };
}
