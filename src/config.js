// src/config.js

export const CAR_SETTINGS = {
  RPM_IDLE: 750,
  RPM_MAX: 8000,
  RPM_OVERTAKE_BOOST: 2000,
  OVERTAKE_DURATION_MS: 8000,
  OVERTAKE_BATTERY_COST: 20,
  PIT_STOP_DURATION_MS: 4000,
  // Simulation tick rate. Lower = smoother, more responsive updates.
  // All per-tick rates below are scaled for this interval.
  // ponytail: was 2000ms — caused 30+ min races and jerky gauges. 250ms = smooth.
  SIMULATION_TICK_MS: 250,
  FUEL_CONSUMPTION_RATE: {
    LEAN: 0.08,
    STANDARD: 0.2,
    RICH: 0.48,
  },
  BATTERY_RECHARGE_RATE: 0.08,

  // RPM-based fuel multiplier: ranges linearly from MIN (idle) to MAX (max RPM).
  RPM_MULTIPLIER_MIN: 0.3,
  RPM_MULTIPLIER_MAX: 2.0,

  // Warning thresholds (percent). A radio warning is announced once when
  // a level drops below these values.
  LOW_FUEL_THRESHOLD: 15,
  LOW_BATTERY_THRESHOLD: 10,

  // Tire wear: tires lose this much "life" (percent) per simulation tick
  // while the engine runs, more at higher RPM. Life maps to a status label.
  TIRE_WEAR_RATE: 0.6,
  TIRE_OPTIMAL_THRESHOLD: 70,
  TIRE_WORN_THRESHOLD: 30,

  // Lap progress: each lap completes after this much accumulated "distance".
  // Distance accrues per tick proportional to RPM, so higher revs => faster laps.
  // ponytail: scaled 6x (100→600) so laps take ~80 ticks (~20s at 250ms/tick).
  LAP_DISTANCE: 600,
  TOTAL_LAPS: 10,
  // Base distance covered per tick at full pace (decoupled from LAP_DISTANCE
  // so changing the lap length doesn't change the speed formula).
  // Tuned so a player lap takes ~78 ticks (~19.5s at 250ms/tick).
  LAP_PROGRESS_BASE: 9,

  // Engine temperature (degrees C). Rises with RPM/overtake, cools toward
  // ambient otherwise. Above the critical threshold the engine cuts power.
  TEMP_AMBIENT: 90,
  TEMP_OPTIMAL_MAX: 120,
  TEMP_CRITICAL: 140,
  TEMP_RISE_RATE: 3,   // max degrees gained per tick at full RPM
  TEMP_COOL_RATE: 4,   // degrees shed per tick toward ambient
  TEMP_OVERTAKE_PENALTY: 4, // extra degrees per tick while overtaking

  // Lap timing: simulated milliseconds added to the current lap each tick.
  // Faster laps (higher RPM) finish in fewer ticks, so they post lower times.
  LAP_TIME_PER_TICK_MS: 400,
  LEADERBOARD_SIZE: 5, // how many fastest laps to keep on the board

  // Damage (0..100). Accrues from overheating and running ruined tires, and
  // saps performance (lap pace) until repaired in the pits.
  DAMAGE_OVERHEAT_RATE: 4, // damage per tick while temperature is critical
  DAMAGE_WORN_TIRE_RATE: 2, // damage per tick while tires are destroyed
  DAMAGE_MINOR_THRESHOLD: 20,
  DAMAGE_MAJOR_THRESHOLD: 50,
  DAMAGE_CRITICAL_THRESHOLD: 80,
  // At 100 damage the car loses this fraction of its pace (0.4 => 40% slower).
  DAMAGE_MAX_PACE_PENALTY: 0.4,

  // AI rival: the reference lap time (ms) a perfect rival targets. Difficulty
  // scales this by paceFactor (higher = faster) and adds random variance.
  // Tuned so HARD matches the player (~78 ticks), MEDIUM is beatable, EASY is comfortable.
  AI_BASE_LAP_MS: 31200,

  // Gear simulation: when the car is moving, RPM climbs each tick and
  // automatically upshifts when it hits the shift point, dropping RPM to
  // the next gear's sweet spot. Downshifts happen when RPM drops too low.
  GEAR_COUNT: 7, // number of forward gears (1-7)
  // Speed multiplier per gear: higher gears translate RPM into more speed.
  // Index 0 is unused (neutral).
  GEAR_RATIOS: [0, 0.45, 0.60, 0.78, 0.95, 1.15, 1.35, 1.55],
  GEAR_SHIFT_RPM: 7500, // RPM threshold that triggers an upshift
  GEAR_DROP_RPM: 5000, // RPM drops to this after an upshift
  GEAR_RPM_CLIMB: 1000, // RPM gained per tick while in gear
  GEAR_START_RPM: 4000, // RPM when the engine starts (car is ready to race)

  // Track layout: segments that make up each lap, defining where the car
  // upshifts (straights) and downshifts (corners). Lengths must sum to
  // LAP_DISTANCE (600) for clean lap wrapping.
  TRACK_LAYOUT: [
    { type: "straight", length: 150 },
    { type: "corner", length: 48, speed: "slow" },
    { type: "straight", length: 72 },
    { type: "corner", length: 60, speed: "medium" },
    { type: "straight", length: 90 },
    { type: "corner", length: 60, speed: "fast" },
    { type: "straight", length: 120 },
  ],
  // Speed multiplier applied when cornering (capped progress per tick).
  // This simulates the loss of pace through turns even in the correct gear.
  CORNER_SPEED_CAP: 0.55, // fraction of straight speed while cornering
  // Target gears for each corner type (downshift target).
  CORNER_TARGET_GEARS: { slow: 2, medium: 3, fast: 4 },
};

// Preset cars the player can choose before a race. Each car modifies the
// player's base simulation stats via multipliers (1.0 = default).
//   speedMul  — scales LAP_PROGRESS_BASE (higher = faster straights)
//   gripMul   — scales CORNER_SPEED_CAP (higher = faster corners)
//   wearMul   — scales TIRE_WEAR_RATE (higher = tires degrade faster)
//   fuelMul   — scales FUEL_CONSUMPTION_RATE (higher = thirstier)
//   tempoMul  — scales GEAR_RPM_CLIMB (higher = revs climb faster)
// Requirements describe what the car trades off for its strengths.
export const CAR_PRESETS = [
  {
    id: "speedster",
    label: "Speedster",
    stats: { speedMul: 1.15, gripMul: 0.90, wearMul: 1.30, fuelMul: 1.25, tempoMul: 1.10 },
    desc: "Top speed monster. Eats tires and fuel.",
    markerColor: "#00ffff",
  },
  {
    id: "balanced",
    label: "Balanced",
    stats: { speedMul: 1.00, gripMul: 1.00, wearMul: 1.00, fuelMul: 1.00, tempoMul: 1.00 },
    desc: "All-round performer. No weaknesses.",
    markerColor: "#2ecc40",
  },
  {
    id: "gripmaster",
    label: "Grip Master",
    stats: { speedMul: 0.90, gripMul: 1.20, wearMul: 0.85, fuelMul: 0.90, tempoMul: 0.95 },
    desc: "Cornering ace. Slow on straights, gentle on tires.",
    markerColor: "#ffdc00",
  },
  {
    id: "endurance",
    label: "Endurance",
    stats: { speedMul: 0.85, gripMul: 1.05, wearMul: 0.60, fuelMul: 0.70, tempoMul: 0.90 },
    desc: "Marathon runner. Sips fuel, saves tires. Low top speed.",
    markerColor: "#ff851b",
  },
];

// AI rival difficulty. paceFactor scales the rival's lap pace (1.0 = reference,
// lower = slower laps); variance is the fractional random swing applied to each
// lap (0.12 => +/-12%), so easier rivals are both slower and less consistent.
export const AI_DIFFICULTY = {
  EASY: { label: "Easy", paceFactor: 0.8, variance: 0.12 },
  MEDIUM: { label: "Medium", paceFactor: 0.92, variance: 0.07 },
  HARD: { label: "Hard", paceFactor: 1.0, variance: 0.03 },
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

// Weather conditions affect grip and pace. gripFactor scales lap pace and
// tire wear: wetter conditions are slower and chew tires harder. tempBias
// nudges the engine's effective cooling (rain cools, dry heat builds).
export const WEATHER_CONDITIONS = {
  DRY: { label: "Dry", gripFactor: 1.0, wearFactor: 1.0, tempBias: 0 },
  CLOUDY: { label: "Cloudy", gripFactor: 0.95, wearFactor: 0.9, tempBias: -3 },
  WET: { label: "Wet", gripFactor: 0.75, wearFactor: 1.3, tempBias: -8 },
  STORM: { label: "Storm", gripFactor: 0.55, wearFactor: 1.6, tempBias: -12 },
};

// Tire temperature model (degrees). Thermal dynamics affect grip and wear.
// Tires heat up while driving, cool down while coasting. Grip is optimal
// in the optimal range, reduced when cold or overheated.
export const TIRE_TEMP = {
  BASELINE: 90,
  HEAT_RATE: 0.6, // degrees gained per tick while driving hard
  COOL_RATE: 0.5, // degrees shed per tick while coasting
  AMBIENT_COOL: 0.2, // slow drift toward baseline
  COLD_THRESHOLD: 70,
  OPTIMAL_MAX: 110,
  CRITICAL_TEMP: 130,
  GRIP_COLD_FACTOR: 0.90,
  GRIP_OPTIMAL_FACTOR: 1.0,
  GRIP_HOT_FACTOR: 0.95,
  WEAR_COLD_FACTOR: 1.2,
  WEAR_HOT_FACTOR: 1.3,
};

// DRS detection: DRS is only available when the player is close enough
// to the AI rival at the detection point. DETECTION_SEGMENT is the track
// segment index where the gap is checked; ELIGIBILITY_GAP_LAPS is the max
// progress gap (in lap units) that qualifies.
export const DRS_DETECTION = {
  DETECTION_SEGMENT: 0, // main straight
  ELIGIBILITY_GAP_LAPS: 0.05, // ~1 second at ~20s/lap
};

// Pit window strategy projects tire-wear and fuel-consumption rates to
// recommend the optimal lap to pit.
export const PIT_WINDOW = {
  SUGGEST_AHEAD_LAPS: 2, // suggest pitting this many laps before critical
  SHOW_WINDOW_LAPS: 5, // show the pit window when this many laps remain
  URGENT_LAPS_REMAINING: 2, // "Box now" threshold
};

// Qualifying mode: a 3-lap shootout where both player and AI set their fastest
// lap. The best lap determines starting grid position for the race.
export const QUALIFYING = {
  LAPS: 3,
};

// Dynamic weather shifts: the weather can change mid-race, forcing pit stops
// for tire changes and adding strategic depth. The shift is scheduled when the
// race simulation starts.
export const WEATHER_SHIFT = {
  ENABLED: true,
  CHANGE_LAP_MIN: 4, // earliest lap a shift can happen
  CHANGE_LAP_MAX: 8, // latest lap a shift can happen
  FORECAST_LAPS: 2,   // how many laps in advance to announce the incoming change
};
