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
import { voiceSay } from "@/services/voiceAction";
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
      return voiceSay("msg.qualiEngineRunning");
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

    return voiceSay("msg.qualiStarted", { laps: QUALIFYING.LAPS });
  };

  // Get the current qualifying session status via TTS.
  const getQualifyingStatus = async () => {
    if (raceMode.value !== "qualifying") {
      return voiceSay("msg.qualiNotActive");
    }
    if (qualifyingBestLap.value === null) {
      return voiceSay("msg.qualiStatus", { lapsRemaining: qualifyingLapsRemaining.value });
    }
    return voiceSay("msg.qualiStatusWithTime", {
      lapsRemaining: qualifyingLapsRemaining.value,
      best: formatLapTime(qualifyingBestLap.value),
    });
  };

  // Get the player's best qualifying lap time via TTS.
  const getQualifyingBestLap = async () => {
    if (raceMode.value !== "qualifying") {
      return voiceSay("msg.qualiNotActive");
    }
    if (qualifyingBestLap.value === null) {
      return voiceSay("msg.qualiNoLapYet");
    }
    return voiceSay("msg.qualiBestLap", {
      time: formatLapTime(qualifyingBestLap.value),
    });
  };

  return {
    computedQualifyingPosition,
    qualifyingInfo,
    startQualifying,
    getQualifyingStatus,
    getQualifyingBestLap,
  };
}
