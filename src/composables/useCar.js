// src/composables/useCar.js

import { ref, computed, watch, onUnmounted, getCurrentInstance } from "vue";
import {
  CAR_SETTINGS,
  CAR_PRESETS,
  FUEL_MIXES,
  TIRE_COMPOUNDS,
  ERS_MODES,
  WEATHER_CONDITIONS,
} from "@/config";
import audioService from "@/services/audioService";
import engineAudioService from "@/services/engineAudioService";
import ttsService from "@/services/textToSpeechService";
import { t } from "@/i18n";
import { formatLapTime } from "@/utils/formatLapTime";
import {
  totalProgress,
  loopPosition,
  computeStandings,
  formatPosition,
} from "@/utils/raceStanding";
import { useAiRival } from "@/composables/useAiRival";

// Maps a canonical status label to its i18n key for spoken output.
const STATUS_KEYS = {
  Cold: "status.cold",
  Optimal: "status.optimal",
  Used: "status.used",
  Worn: "status.worn",
  Hot: "status.hot",
  Critical: "status.critical",
  None: "status.none",
  Minor: "status.minor",
  Major: "status.major",
};
const statusWord = (label) => t(STATUS_KEYS[label] || "status.optimal");

if (typeof window !== "undefined" && typeof window.Audio !== "undefined") {
  audioService.loadSounds();
}
// --- SHARED STATE (SINGLETON PATTERN) ---
// By defining state outside the function, every component that calls useCar()
// will share this same reactive state.
const engineStatus = ref(false);
const rpm = ref(0);
const currentGear = ref(0); // 0 = neutral, 1-7 = in gear
const currentSegmentIndex = ref(0); // which track segment the car is in
const drsStatus = ref(false);
const overtakeActive = ref(false);
const tireLife = ref(100); // 0..100, drives the tireStatus label
const tireCompound = ref(TIRE_COMPOUNDS.MEDIUM.label);
const fuelLevel = ref(100);
const batteryLevel = ref(100);
const fuelMix = ref(FUEL_MIXES.STANDARD); // 'Lean', 'Standard', 'Rich'
const ersMode = ref(ERS_MODES.BALANCED.label);
const engineTemp = ref(CAR_SETTINGS.TEMP_AMBIENT);
const overheating = ref(false);
const currentLap = ref(1);
const lapProgress = ref(0); // 0..LAP_DISTANCE accumulated within the lap
const raceFinished = ref(false);
const pitting = ref(false);

// --- LAP TIMING + LEADERBOARD ---
// currentLapTime accrues simulated milliseconds each tick; on lap completion it
// is recorded, compared against the best, and pushed onto the leaderboard.
const currentLapTime = ref(0);
const lastLapTime = ref(null);
const bestLapTime = ref(null);
// leaderboard: array of { lap, time } sorted fastest-first, capped at LEADERBOARD_SIZE.
const leaderboard = ref([]);

// --- WEATHER + DAMAGE ---
const weather = ref(WEATHER_CONDITIONS.DRY.label);
const carDamage = ref(0); // 0..100

// --- SELECTED CAR ---
// The chosen preset modifies the player's base stats via multipliers.
const selectedCar = ref(CAR_PRESETS[1]); // default: Balanced

// Effective stats after applying the selected car's multipliers.
const effectiveStats = computed(() => {
  const s = selectedCar.value.stats;
  return {
    lapProgressBase: CAR_SETTINGS.LAP_PROGRESS_BASE * s.speedMul,
    cornerSpeedCap: Math.min(1, CAR_SETTINGS.CORNER_SPEED_CAP * s.gripMul),
    tireWearRate: CAR_SETTINGS.TIRE_WEAR_RATE * s.wearMul,
    fuelRate: {
      LEAN: CAR_SETTINGS.FUEL_CONSUMPTION_RATE.LEAN * s.fuelMul,
      STANDARD: CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD * s.fuelMul,
      RICH: CAR_SETTINGS.FUEL_CONSUMPTION_RATE.RICH * s.fuelMul,
    },
    gearRpmClimb: CAR_SETTINGS.GEAR_RPM_CLIMB * s.tempoMul,
  };
});

// --- AI RIVAL ---
// The rival lives in its own composable (useAiRival). It is modeled as a
// lap-time generator, not a full physics car, so the human car's singleton
// state stays untouched. We pull in its state, tick, and actions here.
const ai = useAiRival();

let simulationInterval = null;
let overtakeTimeout = null;
let lastSegmentIndex = -1;
let simWatcherRegistered = false;

// Find which track segment a lap progress value falls within.
// Handles wrapping so progress > LAP_DISTANCE wraps back to the start.
// Exported so the UI can derive segment info directly from lapProgress.
export const findSegmentAtProgress = (progress) => {
  const safeProgress = ((progress % CAR_SETTINGS.LAP_DISTANCE) + CAR_SETTINGS.LAP_DISTANCE) % CAR_SETTINGS.LAP_DISTANCE;
  let accumulated = 0;
  for (let i = 0; i < CAR_SETTINGS.TRACK_LAYOUT.length; i++) {
    accumulated += CAR_SETTINGS.TRACK_LAYOUT[i].length;
    if (safeProgress < accumulated) {
      return { index: i, segment: CAR_SETTINGS.TRACK_LAYOUT[i] };
    }
  }
  return { index: 0, segment: CAR_SETTINGS.TRACK_LAYOUT[0] };
};

// Warning latches so a low-level radio call is announced once per crossing
// rather than on every simulation tick.
const lowFuelWarned = ref(false);
const lowBatteryWarned = ref(false);
const overheatWarned = ref(false);
const damageWarned = ref(false);

/**
 * Reset all module-scope singleton refs to their initial values.
 * Used by tests and HMR to avoid state leaking across module reloads.
 * @returns {void}
 */
export function _resetSingletons() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (overtakeTimeout) {
    clearTimeout(overtakeTimeout);
    overtakeTimeout = null;
  }
  lastSegmentIndex = -1;
  simWatcherRegistered = false;
  engineStatus.value = false;
  rpm.value = 0;
  currentGear.value = 0;
  currentSegmentIndex.value = 0;
  drsStatus.value = false;
  overtakeActive.value = false;
  pitting.value = false;
  tireLife.value = 100;
  tireCompound.value = TIRE_COMPOUNDS.MEDIUM.label;
  fuelLevel.value = 100;
  batteryLevel.value = 100;
  fuelMix.value = FUEL_MIXES.STANDARD;
  ersMode.value = ERS_MODES.BALANCED.label;
  engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
  overheating.value = false;
  currentLap.value = 1;
  lapProgress.value = 0;
  raceFinished.value = false;
  currentLapTime.value = 0;
  lastLapTime.value = null;
  bestLapTime.value = null;
  leaderboard.value = [];
  weather.value = WEATHER_CONDITIONS.DRY.label;
  carDamage.value = 0;
  selectedCar.value = CAR_PRESETS[1];
  lowFuelWarned.value = false;
  lowBatteryWarned.value = false;
  overheatWarned.value = false;
  damageWarned.value = false;
}

// This function is our composable.
export function useCar() {
  // --- COMPUTED PROPERTIES ---
  const isLowBattery = computed(
    () => batteryLevel.value < CAR_SETTINGS.LOW_BATTERY_THRESHOLD,
  );
  const isLowFuel = computed(
    () => fuelLevel.value < CAR_SETTINGS.LOW_FUEL_THRESHOLD,
  );

  // Tire condition label derived from remaining tire life.
  const tireStatus = computed(() => {
    if (!engineStatus.value && tireLife.value >= 100) return "Cold";
    if (tireLife.value >= CAR_SETTINGS.TIRE_OPTIMAL_THRESHOLD) return "Optimal";
    if (tireLife.value >= CAR_SETTINGS.TIRE_WORN_THRESHOLD) return "Used";
    return "Worn";
  });

  // Engine temperature condition label.
  const tempStatus = computed(() => {
    if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL) return "Critical";
    if (engineTemp.value > CAR_SETTINGS.TEMP_OPTIMAL_MAX) return "Hot";
    return "Optimal";
  });

  // Car damage condition label derived from accumulated damage.
  const damageStatus = computed(() => {
    if (carDamage.value >= CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD)
      return "Critical";
    if (carDamage.value >= CAR_SETTINGS.DAMAGE_MAJOR_THRESHOLD) return "Major";
    if (carDamage.value >= CAR_SETTINGS.DAMAGE_MINOR_THRESHOLD) return "Minor";
    return "None";
  });

  // Pace multiplier (0..1): how much of the car's potential speed is available
  // after damage. At full damage the car keeps (1 - DAMAGE_MAX_PACE_PENALTY).
  const paceFactor = computed(() => {
    const penalty =
      (carDamage.value / 100) * CAR_SETTINGS.DAMAGE_MAX_PACE_PENALTY;
    return Math.max(0, 1 - penalty);
  });    // --- DERIVED SPEED ---
  // Compute a conceptual speed in km/h from RPM, gear ratio, and cornering.
  // Pure fun — not a physics model, but gives the driver a sense of pace.
  const speedKmh = computed(() => {
    const ratio = normalizedRpmRatio();
    const gr = currentGear.value > 0
      ? (CAR_SETTINGS.GEAR_RATIOS[currentGear.value] || 0.5)
      : 0;
    const seg = findSegmentAtProgress(lapProgress.value);
    const cf = seg.segment.type === "corner" ? effectiveStats.value.cornerSpeedCap : 1.0;
    // DRS grants a straight-line speed boost (only on straights, per F1 rules).
    const drsBoost = drsStatus.value && seg.segment.type === "straight" ? 1.12 : 1.0;
    const base = 50 + ratio * gr * 200;
    const raw = base * cf * drsBoost * selectedCar.value.stats.speedMul * (weatherConfig().gripFactor || 1.0) * paceFactor.value;
    return Math.round(raw);
  });

  // --- RACE STANDINGS ---
  // Both cars are reduced to a single "progress in laps" value so they can be
  // ranked and placed on the track map, even though the player (physics sim)
  // and the rival (lap-time generator) measure intra-lap progress differently.
  const playerProgress = computed(() =>
    totalProgress(
      currentLap.value,
      lapProgress.value / CAR_SETTINGS.LAP_DISTANCE,
      CAR_SETTINGS.TOTAL_LAPS,
    ),
  );

  const rivalProgress = computed(() =>
    totalProgress(ai.currentLap.value, ai.lapProgress.value, CAR_SETTINGS.TOTAL_LAPS),
  );

  // Position + gap relative to the rival. No rival => solo P1 (null-safe helper).
  const standings = computed(() =>
    computeStandings(
      { progress: playerProgress.value },
      ai.enabled.value ? { progress: rivalProgress.value } : null,
    ),
  );

  // Normalized loop position (0..1) for placing each marker on the circuit.
  const playerLoopPos = computed(() => loopPosition(playerProgress.value));
  const rivalLoopPos = computed(() => loopPosition(rivalProgress.value));

  // --- TRACK-AWARE GEAR LOGIC ---
  // Determine the target gear for the car's current track position.
  // On straights the target is top gear (7th), so the car upshifts
  // sequentially as RPM climbs. On corners the target is the optimal
  // cornering gear (slow=2nd, medium=3rd, fast=4th), so the car
  // downshifts toward it.
  const getTargetGearForSegment = (seg) => {
    if (seg.type === "straight") return CAR_SETTINGS.GEAR_COUNT;
    return CAR_SETTINGS.CORNER_TARGET_GEARS[seg.speed] || 3;
  };

  // Called after the main calculations and RPM climb. Uses the updated
  // lapProgress to determine which track segment the car is in and sets
  // the target gear accordingly.
  const autoShift = () => {
    if (!engineStatus.value) {
      currentGear.value = 0;
      return;
    }

    if (currentGear.value === 0) {
      currentGear.value = 1;
      // Engaging first gear from neutral — use the upshift sound.
      engineAudioService.onShiftUp();
      return;
    }

    const prevGear = currentGear.value;
    const segInfo = findSegmentAtProgress(lapProgress.value);
    const targetGear = getTargetGearForSegment(segInfo.segment);
    currentSegmentIndex.value = segInfo.index;

    // Track the current segment index so we can detect transitions in
    // subsequent ticks to play downshift sounds / trigger engine audio.
    lastSegmentIndex = segInfo.index;

    // On a straight: upshift when RPM is high enough.
    if (currentGear.value < targetGear) {
      if (rpm.value >= CAR_SETTINGS.GEAR_SHIFT_RPM) {
        currentGear.value++;
        rpm.value = CAR_SETTINGS.GEAR_DROP_RPM;
      }
    }

    // In or entering a corner: drop gears toward the target.
    // Drop 2 gears per tick for a realistic sequential downshift feel.
    if (currentGear.value > targetGear) {
      const drop = Math.min(2, currentGear.value - targetGear);
      currentGear.value -= drop;
      rpm.value = CAR_SETTINGS.GEAR_DROP_RPM;
    }

    // Safety downshift: RPM dropped to near-idle (e.g. after overtake).
    if (rpm.value <= CAR_SETTINGS.RPM_IDLE + 500 && currentGear.value > 1) {
      currentGear.value--;
      rpm.value = CAR_SETTINGS.GEAR_DROP_RPM;
    }

    // Play the appropriate shift sound — upshifts are quick and high-pitched,
    // downshifts are deeper and more aggressive (rev-matched blip).
    if (currentGear.value !== prevGear) {
      if (currentGear.value > prevGear) {
        engineAudioService.onShiftUp();
      } else {
        engineAudioService.onShiftDown();
      }
    }
  };

  // --- PRIVATE METHODS (LOGIC) ---
  const normalizedRpmRatio = () => {
    const rpmRatio =
      (rpm.value - CAR_SETTINGS.RPM_IDLE) /
      (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    return Math.max(0, rpmRatio);
  };

  const compoundConfig = () =>
    Object.values(TIRE_COMPOUNDS).find(
      (c) => c.label === tireCompound.value,
    ) || TIRE_COMPOUNDS.MEDIUM;

  const ersConfig = () =>
    Object.values(ERS_MODES).find((m) => m.label === ersMode.value) ||
    ERS_MODES.BALANCED;

  const weatherConfig = () =>
    Object.values(WEATHER_CONDITIONS).find((w) => w.label === weather.value) ||
    WEATHER_CONDITIONS.DRY;

  // Record a completed lap time onto the leaderboard and track the best.
  const recordLap = (lapNumber, timeMs) => {
    const time = Math.round(timeMs);
    lastLapTime.value = time;
    if (bestLapTime.value === null || time < bestLapTime.value) {
      bestLapTime.value = time;
    }
    const next = [...leaderboard.value, { lap: lapNumber, time }];
    next.sort((a, b) => a.time - b.time);
    leaderboard.value = next.slice(0, CAR_SETTINGS.LEADERBOARD_SIZE);
  };

  const updateLapProgress = (ratio) => {
    if (raceFinished.value) return;

    // Lap time accrues every tick the engine runs, so slower laps (less
    // distance covered per tick) post higher times.
    currentLapTime.value += CAR_SETTINGS.LAP_TIME_PER_TICK_MS;

    // Distance accrues with RPM × gear ratio: the same RPM in a higher gear
    // produces more speed. Wet weather (grip) and damage (pace) modulate.
    // In neutral (gear 0) the car barely creeps — no gear ratio to accelerate.
    const gearRatio = currentGear.value > 0
      ? (CAR_SETTINGS.GEAR_RATIOS[currentGear.value] || 0.5)
      : 0;
    const rawSpeed =
      effectiveStats.value.lapProgressBase *
      (0.3 + ratio * gearRatio) *
      weatherConfig().gripFactor *
      paceFactor.value;

    // Determine the current segment's corner factor from the START position.
    const startSeg = findSegmentAtProgress(lapProgress.value);
    const startCornerFactor =
      startSeg.segment.type === "corner"
        ? effectiveStats.value.cornerSpeedCap
        : 1.0;

    // DRS boosts pace on straights (real F1: DRS is disabled in corners).
    const drsBoost =
      drsStatus.value && startSeg.segment.type === "straight" ? 1.12 : 1.0;

    // Apply the speed and check if we crossed a segment boundary mid-tick.
    // If the new segment is a different type (straight ↔ corner), recalculate
    // with that segment's factor so corner entries slow down and exits speed
    // up within the same tick.
    const beforeProgress = lapProgress.value;
    lapProgress.value += rawSpeed * startCornerFactor * drsBoost;

    const endSeg = findSegmentAtProgress(lapProgress.value);
    if (endSeg.index !== startSeg.index) {
      const endCornerFactor =
        endSeg.segment.type === "corner"
        ? effectiveStats.value.cornerSpeedCap
        : 1.0;
      lapProgress.value = beforeProgress + rawSpeed * endCornerFactor;
    }

    while (lapProgress.value >= CAR_SETTINGS.LAP_DISTANCE) {
      lapProgress.value -= CAR_SETTINGS.LAP_DISTANCE;
      // Bank the time posted for the lap just completed and reset the clock.
      // Guard against a 0ms lap when two laps cross in a single tick: after
      // the first iteration currentLapTime is reset to 0, so the second lap
      // would record a bogus 0:00.000 entry. Only record real (positive) times.
      if (currentLapTime.value > 0) {
        recordLap(currentLap.value, currentLapTime.value);
      }
      currentLapTime.value = 0;
      if (currentLap.value >= CAR_SETTINGS.TOTAL_LAPS) {
        raceFinished.value = true;
        lapProgress.value = 0;
        // Stop the engine so all dashboard items (engine, gear, RPM, etc.)
        // freeze in their final post-race state.
        engineStatus.value = false;
        rpm.value = 0;
        currentGear.value = 0;
        drsStatus.value = false;
        overtakeActive.value = false;
        // Clear any pending overtake timeout so "Overtake finished" doesn't
        // announce awkwardly after the checkered flag.
        if (overtakeTimeout) {
          clearTimeout(overtakeTimeout);
          overtakeTimeout = null;
        }
        engineAudioService.stop();
        ttsService.speak(t("msg.checkeredFlag"));
        return;
      }
      currentLap.value += 1;
      ttsService.speak(t("msg.lapAnnounce", { lap: currentLap.value }));
    }
  };

  const updateTemperature = (ratio) => {
    let next = engineTemp.value;
    // Heat generated scales with RPM; cooling pulls back toward ambient.
    const heat = CAR_SETTINGS.TEMP_RISE_RATE * ratio;
    const cool = CAR_SETTINGS.TEMP_COOL_RATE * (1 - ratio);
    next += heat - cool;
    if (overtakeActive.value) next += CAR_SETTINGS.TEMP_OVERTAKE_PENALTY;
    // Weather nudges effective temperature: rain cools, dry heat builds.
    next += weatherConfig().tempBias;
    // Never drop below ambient.
    engineTemp.value = parseFloat(
      Math.max(CAR_SETTINGS.TEMP_AMBIENT, next).toFixed(1),
    );
  };

  // Damage accrues while the engine is overstressed: running critically hot or
  // grinding on destroyed tires. It only repairs in the pits.
  const updateDamage = () => {
    let added = 0;
    if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL) {
      added += CAR_SETTINGS.DAMAGE_OVERHEAT_RATE;
    }
    if (tireLife.value <= 0) {
      added += CAR_SETTINGS.DAMAGE_WORN_TIRE_RATE;
    }
    if (added > 0) {
      carDamage.value = parseFloat(
        Math.min(100, carDamage.value + added).toFixed(2),
      );
    }
  };

  const runSimulationTick = () => {
    // Skip the sim entirely while a pit stop is in progress so fuel, tires,
    // engine temp, lap time, and the AI rival all freeze for the duration.
    if (pitting.value) return;
    const ratio = normalizedRpmRatio();

    // Fuel consumption scales with the selected fuel mix and current RPM.
    const baseConsumptionRate =
      effectiveStats.value.fuelRate[fuelMix.value.toUpperCase()] ||
      effectiveStats.value.fuelRate.STANDARD;

    // Multiplier ranges linearly from MIN (idle) to MAX (max RPM).
    const rpmMultiplier =
      CAR_SETTINGS.RPM_MULTIPLIER_MIN +
      ratio * (CAR_SETTINGS.RPM_MULTIPLIER_MAX - CAR_SETTINGS.RPM_MULTIPLIER_MIN);
    const totalConsumptionRate = baseConsumptionRate * rpmMultiplier;

    if (fuelLevel.value > 0) {
      fuelLevel.value = parseFloat(
        Math.max(0, fuelLevel.value - totalConsumptionRate).toFixed(2),
      );
    }

    // Tires wear faster at higher RPM (1x at idle up to 2x at max RPM),
    // scaled by the fitted compound's wear factor and the current weather.
    if (tireLife.value > 0) {
      const wear =
        effectiveStats.value.tireWearRate *
        (1 + ratio) *
        compoundConfig().wearFactor *
        weatherConfig().wearFactor;
      tireLife.value = parseFloat(
        Math.max(0, tireLife.value - wear).toFixed(2),
      );
    }

    // Battery recharges at a rate scaled by the selected ERS mode.
    if (batteryLevel.value < 100) {
      const recharge =
        CAR_SETTINGS.BATTERY_RECHARGE_RATE * ersConfig().rechargeFactor;
      batteryLevel.value = parseFloat(
        Math.min(100, batteryLevel.value + recharge).toFixed(2),
      );
    }

    updateTemperature(ratio);
    updateDamage();
    updateLapProgress(ratio);
    ai.tick();
    checkWarnings();

    // RPM climbs while the engine is running, simulating acceleration.
    // This happens after the main calculations so the current tick's ratio
    // uses the RPM as it was at the start of the tick (preserving test
    // expectations and making gear transitions predictable).
    if (engineStatus.value && !overheating.value) {
      rpm.value = Math.min(
        CAR_SETTINGS.RPM_MAX,
        rpm.value + effectiveStats.value.gearRpmClimb,
      );
    }

    // Check for gear changes based on the new RPM (affects next tick).
    autoShift();

    // Keep the synthesized engine pitch in sync with RPM.
    if (engineAudioService.isActive) {
      engineAudioService.setRpm(rpm.value);
    }

    // Out of fuel: the engine stalls.
    if (fuelLevel.value <= 0 && engineStatus.value) {
      stallEngine();
      return;
    }

    // Overheating: the engine cuts power until it cools below critical.
    if (engineTemp.value >= CAR_SETTINGS.TEMP_CRITICAL && engineStatus.value) {
      overheatEngine();
    } else if (overheating.value && engineTemp.value < CAR_SETTINGS.TEMP_OPTIMAL_MAX) {
      // Engine has cooled enough — restore full power.
      overheating.value = false;
    }
  };

  // Announce low fuel / battery / overheat once per threshold crossing.
  const checkWarnings = () => {
    if (isLowFuel.value && !lowFuelWarned.value) {
      lowFuelWarned.value = true;
      ttsService.speak(t("msg.warnFuel"));
    } else if (!isLowFuel.value) {
      lowFuelWarned.value = false;
    }

    if (isLowBattery.value && !lowBatteryWarned.value) {
      lowBatteryWarned.value = true;
      ttsService.speak(t("msg.warnBattery"));
    } else if (!isLowBattery.value) {
      lowBatteryWarned.value = false;
    }

    if (engineTemp.value > CAR_SETTINGS.TEMP_OPTIMAL_MAX && !overheatWarned.value) {
      overheatWarned.value = true;
      ttsService.speak(t("msg.warnTemp"));
    } else if (engineTemp.value <= CAR_SETTINGS.TEMP_OPTIMAL_MAX) {
      overheatWarned.value = false;
    }

    const damageCritical =
      carDamage.value >= CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD;
    if (damageCritical && !damageWarned.value) {
      damageWarned.value = true;
      ttsService.speak(t("msg.warnDamage"));
    } else if (!damageCritical) {
      damageWarned.value = false;
    }
  };

  const stallEngine = async () => {
    if (overtakeTimeout) {
      clearTimeout(overtakeTimeout);
      overtakeTimeout = null;
    }
    engineStatus.value = false;
    rpm.value = 0;
    currentGear.value = 0;
    drsStatus.value = false;
    overtakeActive.value = false;
    engineAudioService.stop();
    await ttsService.speak(t("msg.stalling"));
  };

  const overheatEngine = async () => {
    if (overtakeTimeout) {
      clearTimeout(overtakeTimeout);
      overtakeTimeout = null;
    }
    // Power cut: drop revs to idle and disable boosting systems.
    overheating.value = true;
    drsStatus.value = false;
    overtakeActive.value = false;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    currentGear.value = 0;
    await ttsService.speak(t("msg.overheatCut"));
  };

  // --- HELPERS ---

  /**
   * Translate a message key, speak it via TTS, and return the translated string.
   * Reduces repetitive t() + speak() + return boilerplate across status queries.
   */
  const speakAndReturn = async (key, params) => {
    const msg = t(key, params);
    await ttsService.speak(msg);
    return msg;
  };

  // --- ACTIONS (PUBLIC METHODS) ---
  const startEngine = async () => {
    if (engineStatus.value) {
      const message = t("msg.engineAlreadyRunning");
      await ttsService.speak(message);
      return message;
    }

    if (fuelLevel.value <= 0) {
      const message = t("msg.tankEmpty");
      await ttsService.speak(message);
      return message;
    }

    engineStatus.value = true;
    currentGear.value = 1;
    rpm.value = CAR_SETTINGS.GEAR_START_RPM;
    overheating.value = false;

    // Start the synthesized engine audio.
    engineAudioService.start(CAR_SETTINGS.GEAR_START_RPM);

    const message = t("msg.engineStarted");
    await audioService.playSound("engineStart");
    await ttsService.speak(message);
    return message;
  };

  const stopEngine = async () => {
    if (!engineStatus.value) {
      const message = t("msg.engineAlreadyOff");
      await ttsService.speak(message);
      return message;
    }

    if (overtakeTimeout) {
      clearTimeout(overtakeTimeout);
      overtakeTimeout = null;
    }
    engineStatus.value = false;
    rpm.value = 0;
    currentGear.value = 0;
    drsStatus.value = false;

    // Stop the synthesized engine audio.
    engineAudioService.stop();

    const message = t("msg.engineStopped");
    await audioService.playSound("engineStop");
    await ttsService.speak(message);
    return message;
  };

  const activateDrs = async () => {
    let message = "";

    if (!engineStatus.value) {
      message = t("msg.drsEngineOff");
    } else if (drsStatus.value) {
      message = t("msg.drsAlreadyActive");
    } else {
      drsStatus.value = true;
      try {
        await audioService.playSound("drsOn");
      } catch (error) {
        console.error("Failed to play DRS activation sound.", error);
      }
      message = t("msg.drsEnabled");
    }

    await ttsService.speak(message);
    return message;
  };

  const deactivateDrs = async () => {
    let message = "";

    if (!drsStatus.value) {
      message = t("msg.drsAlreadyDisabled");
    } else {
      drsStatus.value = false;
      try {
        await audioService.playSound("drsOff");
      } catch (error) {
        console.error("Failed to play DRS deactivation sound.", error);
      }
      message = t("msg.drsDisabled");
    }

    await ttsService.speak(message);
    return message;
  };

  const activateOvertake = async () => {
    let message = "";
    if (overtakeActive.value) message = t("msg.overtakeAlreadyActive");
    else if (!engineStatus.value) message = t("msg.overtakeEngineOff");
    else if (overheating.value) message = t("msg.overtakeOverheating");
    else if (batteryLevel.value < CAR_SETTINGS.OVERTAKE_BATTERY_COST)
      message = t("msg.overtakeLowBattery");

    if (message) {
      await ttsService.speak(message);
      return message;
    }

    overtakeActive.value = true;
    batteryLevel.value -= CAR_SETTINGS.OVERTAKE_BATTERY_COST;
    rpm.value += CAR_SETTINGS.RPM_OVERTAKE_BOOST;
    message = t("msg.overtakeActivated");

    await audioService.playSound("overtakeOn");
    await ttsService.speak(message);

    if (overtakeTimeout) clearTimeout(overtakeTimeout);
    overtakeTimeout = setTimeout(async () => {
      overtakeActive.value = false;
      rpm.value = engineStatus.value ? CAR_SETTINGS.RPM_IDLE : 0;
      await ttsService.speak(t("msg.overtakeFinished"));
    }, CAR_SETTINGS.OVERTAKE_DURATION_MS);

    return message;
  };

  const setFuelMix = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!FUEL_MIXES[key]) {
      const message = t("msg.unknownFuelMix", { mode });
      await ttsService.speak(message);
      return message;
    }

    fuelMix.value = FUEL_MIXES[key];
    const message = t("msg.fuelMixSet", { label: FUEL_MIXES[key] });
    await ttsService.speak(message);
    return message;
  };

  const setErsMode = async (mode) => {
    const key = String(mode).toUpperCase();
    if (!ERS_MODES[key]) {
      const message = t("msg.unknownErsMode", { mode });
      await ttsService.speak(message);
      return message;
    }

    ersMode.value = ERS_MODES[key].label;
    const message = t("msg.ersModeSet", { label: ERS_MODES[key].label });
    await ttsService.speak(message);
    return message;
  };

  const setTireCompound = async (compound) => {
    const key = String(compound).toUpperCase();
    if (!TIRE_COMPOUNDS[key]) {
      const message = t("msg.unknownCompound", { compound });
      await ttsService.speak(message);
      return message;
    }

    if (engineStatus.value && !pitting.value) {
      const message = t("msg.compoundPitFirst");
      await ttsService.speak(message);
      return message;
    }

    tireCompound.value = TIRE_COMPOUNDS[key].label;
    // Only restore tire life during a pit stop — otherwise the compound
    // change is just a label swap (no free tires outside the pits).
    if (pitting.value) {
      tireLife.value = 100;
    }
    const message = t("msg.compoundFitted", { label: TIRE_COMPOUNDS[key].label });
    await ttsService.speak(message);
    return message;
  };

  const checkTireStatus = () =>
    speakAndReturn("msg.tireStatus", {
      compound: tireCompound.value,
      status: statusWord(tireStatus.value),
      life: tireLife.value,
    });

  const getFuelStatus = () =>
    speakAndReturn("msg.fuelStatus", { level: fuelLevel.value });

  const getBatteryStatus = () => {
    const key = isLowBattery.value ? "msg.batteryCritical" : "msg.batteryStatus";
    return speakAndReturn(key, { level: batteryLevel.value });
  };

  const getTempStatus = () =>
    speakAndReturn("msg.tempStatus", {
      temp: engineTemp.value,
      status: statusWord(tempStatus.value),
    });

  const getLapStatus = () => {
    if (raceFinished.value) return speakAndReturn("msg.raceComplete");
    return speakAndReturn("msg.lapStatus", {
      lap: currentLap.value,
      total: CAR_SETTINGS.TOTAL_LAPS,
    });
  };

  const getHelp = () => speakAndReturn("msg.help");

  // Announce the player's current race position and the gap to the rival.
  const getPosition = () => {
    const s = standings.value;
    if (s.leader === null) return speakAndReturn("msg.positionSolo");
    const gapLaps = Math.abs(s.gap).toFixed(1);
    const gap = t(
      s.leader === "player" ? "msg.gapAhead" : "msg.gapBehind",
      { laps: gapLaps },
    );
    return speakAndReturn("msg.position", {
      pos: formatPosition(s.playerPosition),
      gap,
    });
  };

  const getBestLap = () => {
    if (bestLapTime.value === null) return speakAndReturn("msg.noLapYet");
    return speakAndReturn("msg.bestLap", {
      time: formatLapTime(bestLapTime.value),
    });
  };

  const getDamageStatus = () =>
    speakAndReturn("msg.damageStatus", {
      damage: carDamage.value,
      status: statusWord(damageStatus.value),
    });

  const getWeatherStatus = () =>
    speakAndReturn("msg.weatherStatus", { weather: weather.value });

  const setWeather = async (condition) => {
    const key = String(condition).toUpperCase();
    if (!WEATHER_CONDITIONS[key]) {
      const message = t("msg.unknownWeather", { condition });
      await ttsService.speak(message);
      return message;
    }
    weather.value = WEATHER_CONDITIONS[key].label;
    const message = t("msg.weatherSet", { label: WEATHER_CONDITIONS[key].label });
    await ttsService.speak(message);
    return message;
  };

  const performPitStop = async () => {
    if (raceFinished.value) {
      const message = t("msg.raceComplete");
      await ttsService.speak(message);
      return message;
    }

    // Freeze the sim (fuel/tires/AI/lap-time) for the pit duration so the
    // stop is a real pause rather than a drain window.
    pitting.value = true;
    try {
      await stopEngine();
      await new Promise((resolve) =>
        setTimeout(resolve, CAR_SETTINGS.PIT_STOP_DURATION_MS),
      );

      fuelLevel.value = 100;
      batteryLevel.value = 100;
      tireLife.value = 100;
      carDamage.value = 0;
      engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
      overheating.value = false;
      lowFuelWarned.value = false;
      lowBatteryWarned.value = false;
      overheatWarned.value = false;
      damageWarned.value = false;

      await startEngine();
      const message = t("msg.pitComplete");
      await ttsService.speak(message);
      return message;
    } finally {
      pitting.value = false;
    }
  };

  const resetRace = async () => {
    if (overtakeTimeout) clearTimeout(overtakeTimeout);
    overtakeTimeout = null;

    engineStatus.value = false;
    rpm.value = 0;
    currentGear.value = 0;
    drsStatus.value = false;
    overtakeActive.value = false;
    pitting.value = false;
    tireLife.value = 100;
    tireCompound.value = TIRE_COMPOUNDS.MEDIUM.label;
    fuelLevel.value = 100;
    batteryLevel.value = 100;
    fuelMix.value = FUEL_MIXES.STANDARD;
    ersMode.value = ERS_MODES.BALANCED.label;
    engineTemp.value = CAR_SETTINGS.TEMP_AMBIENT;
    overheating.value = false;
    currentLap.value = 1;
    lapProgress.value = 0;
    raceFinished.value = false;
    lowFuelWarned.value = false;
    lowBatteryWarned.value = false;
    overheatWarned.value = false;

    // Reset lap timing, leaderboard, weather and damage.
    currentLapTime.value = 0;
    lastLapTime.value = null;
    bestLapTime.value = null;
    leaderboard.value = [];
    weather.value = WEATHER_CONDITIONS.DRY.label;
    carDamage.value = 0;
    selectedCar.value = CAR_PRESETS[1]; // Balanced
    damageWarned.value = false;

    // Reset the segment tracker for the start/finish straight.
    lastSegmentIndex = -1;
    currentSegmentIndex.value = 0;

    // Reset the AI rival but keep it enabled at its chosen difficulty so a
    // reset re-runs the same matchup. setAiDifficulty/disableAi change those.
    ai.resetProgress();

    const message = t("msg.raceReset");
    await ttsService.speak(message);
    return message;
  };

  // Select a preset car. Only allowed pre-race (engine off, not pitting,
  // not finished). The car choice persists across pit stops and resets.
  const selectCar = async (carId) => {
    if (engineStatus.value || pitting.value) {
      const message = t("msg.carSelectEngineRunning");
      await ttsService.speak(message);
      return message;
    }
    const car = CAR_PRESETS.find((c) => c.id === carId);
    if (!car) {
      const message = t("msg.carSelectUnknown", { id: carId });
      await ttsService.speak(message);
      return message;
    }
    selectedCar.value = car;
    const message = t("msg.carSelected", { label: car.label });
    await ttsService.speak(message);
    return message;
  };

  // --- WATCHER FOR SIMULATION ---
  // The sim loop runs while the engine is on OR an AI rival is still racing, so
  // the rival keeps lapping even if the player never starts their own engine.
  // Guard with a module-scope flag so the watcher + interval are registered
  // only once even if useCar() is called from multiple components.
  if (!simWatcherRegistered) {
    simWatcherRegistered = true;
    watch(
      [engineStatus, ai.enabled, ai.finished, pitting],
      () => {
        const shouldRun =
          !pitting.value &&
          (engineStatus.value || (ai.enabled.value && !ai.finished.value));
        if (shouldRun) {
          if (simulationInterval) clearInterval(simulationInterval);
          simulationInterval = setInterval(
            runSimulationTick,
            CAR_SETTINGS.SIMULATION_TICK_MS,
          );
        } else {
          if (simulationInterval) clearInterval(simulationInterval);
          simulationInterval = null;
        }
      },
      { immediate: true },
    );
  }

  // Clean up the simulation interval when the hosting component unmounts.
  // Guard with getCurrentInstance so this is a no-op when called outside
  // a component's setup (e.g. in test suites).
  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
      engineAudioService.stop();
    });
  }

  // --- EXPOSE PUBLIC API ---
  return {
    // State
    engineStatus,
    rpm,
    currentGear,
    currentSegmentIndex,
    drsStatus,
    overtakeActive,
    tireLife,
    tireCompound,
    fuelLevel,
    batteryLevel,
    fuelMix,
    ersMode,
    engineTemp,
    overheating,
    currentLap,
    lapProgress,
    raceFinished,
    pitting,
    currentLapTime,
    lastLapTime,
    bestLapTime,
    leaderboard,
    weather,
    carDamage,
    selectedCar,
    // AI rival state (re-exposed from useAiRival under the public names).
    aiEnabled: ai.enabled,
    aiDifficulty: ai.difficulty,
    aiCurrentLap: ai.currentLap,
    aiLapProgress: ai.lapProgress,
    aiBestLapTime: ai.bestLapTime,
    aiLeaderboard: ai.leaderboard,
    aiFinished: ai.finished,
    // Getters
    tireStatus,
    tempStatus,
    isLowBattery,
    isLowFuel,
    damageStatus,
    paceFactor,
    speedKmh,
    standings,
    playerLoopPos,
    rivalLoopPos,
    aiConfig: ai.config,
    // Actions
    startEngine,
    stopEngine,
    activateDrs,
    deactivateDrs,
    activateOvertake,
    setFuelMix,
    setErsMode,
    setTireCompound,
    setWeather,
    setAiDifficulty: ai.setDifficulty,
    disableAi: ai.disable,
    getAiStatus: ai.getStatus,
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
    // Helpers
    formatLapTime,
    // Internals exposed for testing
    runSimulationTick,
  };
}
