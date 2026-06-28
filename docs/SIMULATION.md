# Simulation Model

The car simulation runs on a **5-second tick interval** (`CAR_SETTINGS.SIMULATION_TICK_MS`). Each tick updates all systems sequentially.

## Systems Overview

| System | Behaviour | Key Constants |
|---|---|---|
| **Fuel** | Consumed based on RPM × fuel mix multiplier | Lean 0.2, Standard 0.5, Rich 1.2 per tick |
| **Tires** | Degrade from 100% → Worn; wear scales with RPM, compound, and weather | Base rate 1.5%/tick; Soft 1.6×, Medium 1.0×, Hard 0.6× |
| **Battery** | Recharges based on ERS mode | Base 0.2%/tick; Hotlap 0.3×, Balanced 1.0×, Charge 2.0× |
| **Engine Temp** | Rises with RPM + overtaking, cools toward 90°C ambient | Rise 12°C/tick, Cool 8°C/tick, Overtake +10°C/tick |
| **Damage** | +4/tick while overheating, +2/tick on destroyed tires | Repaired only in pits; max 40% pace penalty at 100 damage |
| **Gears** | RPM climbs 1500/tick; auto-upshift at 7500 RPM drops to 5000 RPM. Track-aware: upshifts on straights, downshifts into corners (2 gears/tick) | 7 gears with speed multipliers from 0.45× (1st) to 1.55× (7th). Corner targets: slow=2nd, medium=3rd, fast=4th |
| **Lap Progress** | Distance accrues proportional to RPM × gear ratio × grip × pace × cornerFactor | 100 distance units per lap; 10 laps total. Corners capped at 55% speed |
| **Lap Timing** | +1000ms simulated time per tick | Top 5 fastest laps kept on leaderboard |
| **AI Rival** | Independent lap-time generator (no physics) | Base 8000ms/lap; difficulty sets pace ± variance |

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

## AI Rival Difficulty

| Level | Pace Factor | Variance | Behaviour |
|---|---|---|---|
| **Easy** | 0.80 (slower) | ±12% | Both slower and less consistent |
| **Medium** | 0.92 | ±7% | Balanced opponent |
| **Hard** | 1.00 (reference) | ±3% | Consistent, fast lap times |
| **Random** | — | — | Picks one of the above randomly |

- **Pace factor** scales the base lap time (8000ms): time = base / paceFactor
- **Variance** is the random fractional swing applied each lap

## Edge Cases

| Scenario | Behaviour |
|---|---|
| **Engine stall** (fuel = 0) | RPM drops to 0, gear to neutral, DRS & overtake disabled, engine must be restarted after refuel |
| **Overheat power cut** (temp ≥ 130°C) | RPM drops to idle, gear to neutral, DRS & overtake disabled, recovers when temp drops below critical |
| **Engine start** | Gear engages 1st at 4000 RPM (race-ready), RPM climbs 1500/tick toward 7500 shift point |
| **Auto-upshift (straight)** | When RPM ≥ 7500 and gear < target (7 on straights), shifts up and drops RPM to 5000 |
| **Auto-downshift (corner)** | When gear > corner target (2/3/4), drops 2 gears/tick toward target |
| **Safety downshift** | When RPM ≤ 1250 and gear > 1, shifts down and RPM rises to 5000 |
| **Track segment crossing** | Corner speed cap (55%) applies to the segment the car starts the tick in |
| **Overtake denied** | Fails if battery < 20%, engine off, or engine overheating |
| **Tire changes** | Only allowed in pits (engine must be off) |
| **Warning latches** | Each critical threshold triggers exactly one voice alert per crossing |
| **Post-race** | Simulation stops after final lap; AI can still finish independently |
| **Battery cap** | Recharge stops at 100% |

---

## Configuration

All tunable constants live in [`src/config.js`](../src/config.js):

### `CAR_SETTINGS`
```js
{
  RPM_IDLE: 750,
  RPM_MAX: 8000,
  RPM_OVERTAKE_BOOST: 2000,
  OVERTAKE_DURATION_MS: 8000,
  OVERTAKE_BATTERY_COST: 20,
  PIT_STOP_DURATION_MS: 4000,
  SIMULATION_TICK_MS: 5000,
  FUEL_CONSUMPTION_RATE: { LEAN: 0.2, STANDARD: 0.5, RICH: 1.2 },
  BATTERY_RECHARGE_RATE: 0.2,
  RPM_MULTIPLIER_MIN: 0.3,
  RPM_MULTIPLIER_MAX: 2.0,
  LOW_FUEL_THRESHOLD: 15,
  LOW_BATTERY_THRESHOLD: 10,
  TIRE_WEAR_RATE: 1.5,
  TIRE_OPTIMAL_THRESHOLD: 70,
  TIRE_WORN_THRESHOLD: 30,
  LAP_DISTANCE: 100,
  TOTAL_LAPS: 10,
  TEMP_AMBIENT: 90,
  TEMP_OPTIMAL_MAX: 110,
  TEMP_CRITICAL: 130,
  TEMP_RISE_RATE: 12,
  TEMP_COOL_RATE: 8,
  TEMP_OVERTAKE_PENALTY: 10,
  LAP_TIME_PER_TICK_MS: 1000,
  LEADERBOARD_SIZE: 5,
  DAMAGE_OVERHEAT_RATE: 4,
  DAMAGE_WORN_TIRE_RATE: 2,
  DAMAGE_MINOR_THRESHOLD: 20,
  DAMAGE_MAJOR_THRESHOLD: 50,
  DAMAGE_CRITICAL_THRESHOLD: 80,
  DAMAGE_MAX_PACE_PENALTY: 0.4,
  AI_BASE_LAP_MS: 8000,
}
```

### Other Exports

| Export | Purpose |
|---|---|
| `AI_DIFFICULTY` | EASY / MEDIUM / HARD pace factors and variance |
| `FUEL_MIXES` | LEAN / STANDARD / RICH labels |
| `TIRE_COMPOUNDS` | SOFT / MEDIUM / HARD wear factors |
| `ERS_MODES` | HOTLAP / BALANCED / CHARGE recharge factors |
| `WEATHER_CONDITIONS` | DRY / CLOUDY / WET / STORM grip, wear, temp bias |
