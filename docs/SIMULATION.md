# Simulation Model

The car simulation runs on a **250ms tick interval** (`CAR_SETTINGS.SIMULATION_TICK_MS`). Each tick updates all systems sequentially while the engine is on or an AI rival is still racing. The sim freezes entirely during a pit stop.

---

## Systems Overview

| System | Behaviour | Key Constants |
|---|---|---|
| **Fuel** | Consumed based on RPM × fuel mix multiplier | Lean 0.08, Standard 0.2, Rich 0.48 per tick |
| **Tires** | Degrade from 100% → Worn; wear scales with RPM, compound, and weather | Base rate 0.6%/tick; Soft 1.6×, Medium 1.0×, Hard 0.6× |
| **Battery** | Recharges based on ERS mode | Base 0.08%/tick; Hotlap 0.3×, Balanced 1.0×, Charge 2.0× |
| **Engine Temp** | Rises with RPM + overtaking, cools toward 90°C ambient | Rise 4°C/tick, Cool 3°C/tick, Overtake +4°C/tick |
| **Damage** | +4/tick while overheating, +2/tick on destroyed tires | Repaired only in pits; max 40% pace penalty at 100 damage |
| **Gears** | RPM climbs 1000/tick; auto-upshift at 7500 RPM drops to 5000 RPM. Track-aware: upshifts on straights, downshifts into corners (2 gears/tick) | 7 gears with speed multipliers from 0.45× (1st) to 1.55× (7th). Corner targets: slow=2nd, medium=3rd, fast=4th |
| **Lap Progress** | Distance accrues proportional to LAP_PROGRESS_BASE × RPM ratio × gear ratio × grip × pace × cornerFactor × DRS boost (straights only) | 600 distance units per lap (~80 ticks, ~20s); 10 laps total. Corners capped at 55% speed. DRS grants +12% pace on straights |
| **Lap Timing** | +400ms simulated time per tick | Top 5 fastest laps kept on leaderboard. A full 10-lap race takes ~3.5 minutes |
| **AI Rival** | Independent lap-time generator (no physics) | Base 32000ms/lap (~80 ticks); difficulty sets pace ± variance |

---

## Weather Effects

| Condition | Grip Factor | Tire Wear Factor | Temp Bias |
|---|---|---|---|
| **Dry** | 1.00 (baseline) | 1.00 (baseline) | 0°C |
| **Cloudy** | 0.95 | 0.90 | -3°C |
| **Wet** | 0.75 | 1.30 | -8°C |
| **Storm** | 0.55 | 1.60 | -12°C |

- **Grip factor** scales lap pace (lower = slower)
- **Tire wear factor** scales tire degradation
- **Temp bias** nudges engine cooling (rain cools, dry builds heat)

---

## AI Rival Difficulty

| Level | Pace Factor | Variance | Behaviour |
|---|---|---|---|
| **Easy** | 0.80 (slower) | ±12% | Both slower and less consistent |
| **Medium** | 0.92 | ±7% | Balanced opponent |
| **Hard** | 1.00 (reference) | ±3% | Consistent, fast lap times |
| **Random** | — | — | Picks one of the above randomly |

- **Pace factor** scales the base lap time (32000ms): `time = base / paceFactor`
- **Variance** is the random fractional swing applied each lap

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| **Engine stall** (fuel = 0) | RPM drops to 0, gear to neutral, DRS & overtake disabled. Engine must be restarted after a pit stop refuel. |
| **Overheat power cut** (temp ≥ 130°C) | RPM drops to idle, gear to neutral, DRS & overtake disabled. Recovers when temp drops below critical. |
| **Engine start** | Gear engages 1st at 4000 RPM (race-ready). RPM climbs 1000/tick toward the 7500 shift point. |
| **Auto-upshift (straight)** | When RPM ≥ 7500 and gear < target (7 on straights), shifts up and drops RPM to 5000. |
| **Auto-downshift (corner)** | When gear > corner target (2nd/3rd/4th), drops 2 gears/tick toward target. |
| **Safety downshift** | When RPM ≤ 1250 and gear > 1, shifts down to prevent stalling. |
| **Corner speed cap** | Speed is capped at 55% while cornering. Segment crossing recalculates mid-tick. |
| **Overtake denied** | Fails if battery < 20%, engine is off, or engine is overheating. |
| **Tire changes** | Only allowed in pits (engine must be off). |
| **Warning latches** | Each critical threshold triggers exactly one voice alert per crossing. |
| **Post-race** | Simulation stops after the final lap. The AI rival can still finish independently. |
| **Battery cap** | Recharge stops at 100%. |
| **Pit stop** | Stops engine → freezes sim (fuel/tires/AI/lap-time all pause) → waits 4s → refuels 100% → restarts engine. Repairs all damage and fits fresh tires. |

---

## Full Configuration

All tunable constants live in [`src/config.js`](../src/config.js).

### `CAR_SETTINGS`

```js
{
  RPM_IDLE: 750,
  RPM_MAX: 8000,
  RPM_OVERTAKE_BOOST: 2000,
  OVERTAKE_DURATION_MS: 8000,
  OVERTAKE_BATTERY_COST: 20,
  PIT_STOP_DURATION_MS: 4000,
  SIMULATION_TICK_MS: 250,           # 250ms tick interval (8x smoother than original 2s)
  FUEL_CONSUMPTION_RATE: {
    LEAN: 0.08, STANDARD: 0.2, RICH: 0.48
  },
  BATTERY_RECHARGE_RATE: 0.08,
  RPM_MULTIPLIER_MIN: 0.3,
  RPM_MULTIPLIER_MAX: 2.0,
  LOW_FUEL_THRESHOLD: 15,
  LOW_BATTERY_THRESHOLD: 10,
  TIRE_WEAR_RATE: 0.6,
  TIRE_OPTIMAL_THRESHOLD: 70,
  TIRE_WORN_THRESHOLD: 30,
  LAP_DISTANCE: 600,
  TOTAL_LAPS: 10,
  LAP_PROGRESS_BASE: 8,
  TEMP_AMBIENT: 90,
  TEMP_OPTIMAL_MAX: 110,
  TEMP_CRITICAL: 130,
  TEMP_RISE_RATE: 4,
  TEMP_COOL_RATE: 3,
  TEMP_OVERTAKE_PENALTY: 4,
  LAP_TIME_PER_TICK_MS: 400,
  LEADERBOARD_SIZE: 5,
  DAMAGE_OVERHEAT_RATE: 4,
  DAMAGE_WORN_TIRE_RATE: 2,
  DAMAGE_MINOR_THRESHOLD: 20,
  DAMAGE_MAJOR_THRESHOLD: 50,
  DAMAGE_CRITICAL_THRESHOLD: 80,
  DAMAGE_MAX_PACE_PENALTY: 0.4,
  AI_BASE_LAP_MS: 32000,

  // Gear simulation
  GEAR_COUNT: 7,
  GEAR_RATIOS: [0, 0.45, 0.60, 0.78, 0.95, 1.15, 1.35, 1.55],
  GEAR_SHIFT_RPM: 7500,
  GEAR_DROP_RPM: 5000,
  GEAR_RPM_CLIMB: 1000,
  GEAR_START_RPM: 4000,

  // Track layout (7 segments, lengths sum to 600)
  TRACK_LAYOUT: [
    { type: "straight", length: 150 },
    { type: "corner", length: 48, speed: "slow" },
    { type: "straight", length: 72 },
    { type: "corner", length: 60, speed: "medium" },
    { type: "straight", length: 90 },
    { type: "corner", length: 60, speed: "fast" },
    { type: "straight", length: 120 },
  ],
  CORNER_SPEED_CAP: 0.55,
  CORNER_TARGET_GEARS: { slow: 2, medium: 3, fast: 4 },
}
```

### Other Exports

| Export | Purpose |
|---|---|
| `AI_DIFFICULTY` | EASY (0.80), MEDIUM (0.92), HARD (1.00) pace factors and variance |
| `FUEL_MIXES` | LEAN = "Lean", STANDARD = "Standard", RICH = "Rich" |
| `TIRE_COMPOUNDS` | SOFT (wear 1.6×), MEDIUM (wear 1.0×), HARD (wear 0.6×) |
| `ERS_MODES` | HOTLAP (recharge 0.3×), BALANCED (1.0×), CHARGE (2.0×) |
| `WEATHER_CONDITIONS` | DRY, CLOUDY, WET, STORM with grip/wear/tempBias |
