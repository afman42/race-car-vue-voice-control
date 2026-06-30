// src/composables/useRaceControl.js
//
// UI orchestration composable extracted from RaceControl.vue. Handles
// command routing, speech recognition, overtake countdown, gear flash,
// car selection modal, and all the reactive UI wiring.
//
// Using the same singleton pattern so the state is shared.

import { ref, computed, watch, onUnmounted } from "vue";
import { useCar, findSegmentAtProgress } from "@/composables/useCar";
import { matchCommand } from "@/composables/commandRouter";
import speechService from "@/services/speechRecognitionService";
import ttsService from "@/services/textToSpeechService";
import { useI18n } from "@/i18n";
import { CAR_SETTINGS } from "@/config";
import { formatPosition } from "@/utils/raceStanding";

export function useRaceControl() {
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
    getTireTempStatus,
    getPitWindowStatus,
    getHelp,
    getPosition,
    performPitStop,
    resetRace,
    selectCar,
    selectedCar,
    raceMode,
    qualifyingLapsRemaining,
    qualifyingResults,
    qualifyingBestLap,
    qualifyingPosition,
    qualifyingInfo,
    aiQualifyingBestLap,
    aiQualifyingFinished,
    tireTemp,
    tireTempDisplayStatus,
    drsEligible,
    pitWindowInfo,
    pitWindowVisible,
    pitWindowUrgent,
    startQualifying,
    getQualifyingStatus,
    getQualifyingBestLap,
    formatLapTime,
  } = useCar();

  const { t, locale, speechLang, setLocale, SUPPORTED_LOCALES } = useI18n();

  // --- LANGUAGE ---
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

  // --- UI STATE ---
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

  // --- OVERTAKE COUNTDOWN ---
  const overtakeRemaining = ref(0);
  let overtakeCountdownInterval = null;

  const startOvertakeCountdown = () => {
    if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
    const start = Date.now();
    overtakeRemaining.value = 100;
    overtakeCountdownInterval = setInterval(() => {
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

  // --- ACTIVE AI COMMAND HIGHLIGHT ---
  const activeAiCommand = ref(null);

  // --- GEAR FLASH ---
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

  // --- SEGMENT DISPLAY ---
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

  // --- POSITION BADGE ---
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

  // --- COMMAND ACTIONS ---
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
    // Qualifying
    startQualifying,
    qualifyingStatus: getQualifyingStatus,
    qualifyingBest: getQualifyingBestLap,
    // Tire temp + pit window
    tireTempStatus: getTireTempStatus,
    pitWindowStatus: getPitWindowStatus,
  };

  // --- RUN COMMAND ---
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

  // --- SPEECH RECOGNITION ---
  const processCommand = async (transcript) => {
    lastTranscript.value = transcript;

    speechService.stopListening();
    isListening.value = false;

    const command = matchCommand(transcript, locale.value);

    if (command && commandActions[command]) {
      await runCommand(command);
    } else {
      statusMessage.value = t("msg.notRecognized", { transcript });
    }

    setTimeout(() => {
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

  // --- CLEANUP ---
  onUnmounted(() => {
    speechService.stopListening();
    if (overtakeCountdownInterval) clearInterval(overtakeCountdownInterval);
    if (gearFlashTimeout) clearTimeout(gearFlashTimeout);
  });

  // --- DEV HELPERS ---
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

  return {
    // Re-exposed from useCar for the template
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
    selectedCar,
    formatLapTime,
    // Qualifying
    raceMode,
    qualifyingLapsRemaining,
    qualifyingInfo,
    aiQualifyingBestLap,
    aiQualifyingFinished,
    // Tire temp, DRS, pit window
    tireTemp: tireTemp,
    tireTempDisplayStatus: tireTempDisplayStatus,
    drsEligible: drsEligible,
    pitWindowInfo: pitWindowInfo,
    pitWindowVisible: pitWindowVisible,
    pitWindowUrgent: pitWindowUrgent,
    // i18n
    t,
    locale,
    SUPPORTED_LOCALES,
    onLocaleChange,
    // UI state
    isListening,
    statusMessage,
    lastTranscript,
    showCarModal,
    onCarSelect,
    overtakeRemaining,
    activeAiCommand,
    gearFlash,
    // Segment display
    currentSegmentType,
    currentSegmentSpeed,
    currentSegmentLabel,
    // Position badge
    positionLabel,
    gapText,
    trackAriaLabel,
    // Actions
    runCommand,
    toggleListening,
  };
}
