// src/config.js

export const CAR_SETTINGS = {
  RPM_IDLE: 750,
  RPM_MAX: 8000,
  RPM_OVERTAKE_BOOST: 2000,
  OVERTAKE_DURATION_MS: 8000,
  OVERTAKE_BATTERY_COST: 20,
  PIT_STOP_DURATION_MS: 4000,
  SIMULATION_TICK_MS: 5000,
  FUEL_CONSUMPTION_RATE: {
    LEAN: 0.2,
    STANDARD: 0.5,
    RICH: 1.2,
  },
  BATTERY_RECHARGE_RATE: 0.2,

  // RPM-based fuel multiplier: ranges linearly from MIN (idle) to MAX (max RPM).
  RPM_MULTIPLIER_MIN: 0.3,
  RPM_MULTIPLIER_MAX: 2.0,

  // Warning thresholds (percent). A radio warning is announced once when
  // a level drops below these values.
  LOW_FUEL_THRESHOLD: 15,
  LOW_BATTERY_THRESHOLD: 10,

  // Tire wear: tires lose this much "life" (percent) per simulation tick
  // while the engine runs, more at higher RPM. Life maps to a status label.
  TIRE_WEAR_RATE: 1.5,
  TIRE_OPTIMAL_THRESHOLD: 70,
  TIRE_WORN_THRESHOLD: 30,

  // Lap progress: each lap completes after this much accumulated "distance".
  // Distance accrues per tick proportional to RPM, so higher revs => faster laps.
  LAP_DISTANCE: 100,
  TOTAL_LAPS: 10,

  // Engine temperature (degrees C). Rises with RPM/overtake, cools toward
  // ambient otherwise. Above the critical threshold the engine cuts power.
  TEMP_AMBIENT: 90,
  TEMP_OPTIMAL_MAX: 110,
  TEMP_CRITICAL: 130,
  TEMP_RISE_RATE: 12, // max degrees gained per tick at full RPM
  TEMP_COOL_RATE: 8, // degrees shed per tick toward ambient
  TEMP_OVERTAKE_PENALTY: 10, // extra degrees per tick while overtaking
};

// Valid fuel mix modes mapped to their display label.
export const FUEL_MIXES = {
  LEAN: "Lean",
  STANDARD: "Standard",
  RICH: "Rich",
};

// Tire compounds: grip is informational, wearFactor scales the base wear rate.
// Softer compounds wear faster in exchange for more grip.
export const TIRE_COMPOUNDS = {
  SOFT: { label: "Soft", wearFactor: 1.6 },
  MEDIUM: { label: "Medium", wearFactor: 1.0 },
  HARD: { label: "Hard", wearFactor: 0.6 },
};

// ERS deployment modes scale how aggressively the battery recharges.
// HOTLAP spends energy (slower recharge), CHARGE harvests more.
export const ERS_MODES = {
  HOTLAP: { label: "Hotlap", rechargeFactor: 0.3 },
  BALANCED: { label: "Balanced", rechargeFactor: 1.0 },
  CHARGE: { label: "Charge", rechargeFactor: 2.0 },
};
