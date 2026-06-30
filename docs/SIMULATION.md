# Simulation Model

The car simulation runs on a **250ms tick interval** (`CAR_SETTINGS.SIMULATION_TICK_MS`). Each tick updates all systems sequentially while the engine is on or an AI rival is still racing. The sim freezes entirely during a pit stop.

A full 10-lap race takes approximately **3.3 minutes** of simulation time.

---

## Tick Execution Order

```
runSimulationTick():
   1. Skip if pitting
   2. Fuel consumption
   3. Tire wear (compound × weather × temperature)
   4. Battery recharge (ERS mode)
   5. Engine temperature
   6. Tire temperature (new — heats while driving, cools while coasting)
   7. Damage accrual (overheat + worn tires + overheated tires)
   8. DRS eligibility (new — checks gap at detection zone)
   9. Pit window projection (new — tire/fuel wear rates per lap)
  10. Weather shift check (forecast + apply)
  11. Lap progress + sector timing
  12. AI rival tick
  13. Warning checks (fuel, battery, temp, damage, tire temp)
  14. RPM climb
  15. Track-aware gear shifting (autoShift)
  16. Engine stall / overheat check
```

---

## Systems Detail

### ⛽ Fuel
Consumed based on RPM × fuel mix multiplier.

| Mix | Consumption | Best For |
|---|---|---|
| **Lean** | 0.08/tick | Saving fuel, cruising |
| **Standard** | 0.20/tick | Balanced driving |
| **Rich** | 0.48/tick | Maximum power, overtaking |

RPM multiplier ranges from 0.3× (idle) to 2.0× (max RPM).

### 🛞 Tire Wear
Degrades from 100% → Worn. Scales with RPM, compound, weather, and tire temperature.

| Compound | Wear Factor | Best For |
|---|---|---|
| **Soft** | 1.6× | Maximum grip, qualifying sprints |
| **Medium** | 1.0× | Balanced race pace |
| **Hard** | 0.6× | Long stints, minimal pit stops |

**Tire temperature multiplier:**
- **Cold** (<70°C): wear 1.2× faster
- **Optimal** (70–110°C): normal wear
- **Hot** (110–130°C): wear 1.3× faster
- **Overheated** (>130°C): rapid wear + damage accrual

### 🌡️ Tire Temperature *(New Feature)*
Heats while driving (0.6°C/tick), cools while coasting (0.5°C/tick), with ambient drift toward 90°C baseline. Weather adds bias: rain cools, dry heat builds.

| Temp Range | Status | Grip Effect |
|---|---|---|
| <70°C | **Cold** | Grip 0.90× (slower corners, less pace) |
| 70–110°C | **Optimal** | Full grip 1.0× |
| 110–130°C | **Hot** | Grip 0.95×, wear 1.3× |
| >130°C | **Overheated** | Grip 0.90×, wear 1.3×, gradual damage |

**Strategy:** Short shifts keep tires in the optimal window. Cold tires understeer, overheated tires degrade fast and risk suspension damage.

### 🔋 Battery
Recharges based on ERS mode at 0.08%/tick base.

| ERS Mode | Recharge Factor | Use Case |
|---|---|---|
| **Hotlap** | 0.3× | Deploy energy for fastest laps |
| **Balanced** | 1.0× | Normal racing |
| **Charge** | 2.0× | Harvest energy, conserve for later |

### 🌡️ Engine Temperature
Rises with RPM (3°C/tick), drops toward 90°C ambient (4°C/tick at idle). Overtake adds 4°C/tick extra heat. Weather bias: rain cools (-3 to -12°C), dry has no bias.

| Temp | Status | Effect |
|---|---|---|
| 90–120°C | **Optimal** | Normal operation |
| 120–140°C | **Hot** | Warning announced once |
| >140°C | **Critical** | Power cut — RPM drops to idle, DRS/overtake disabled |

### 💥 Damage
Accrues from three sources:

| Source | Rate | When |
|---|---|---|
| Engine overheating | 4/tick | Temp ≥ 140°C |
| Destroyed tires | 2/tick | Tire life ≤ 0% |
| Overheated tires | 1.2/tick | Tire temp ≥ 130°C |

- Max 40% pace penalty at 100 damage
- Repaired to 0 during pit stop
- Thresholds: Minor (20%), Major (50%), Critical (80%)

### ⚙️ Gears & Track-Aware Shifting
7 forward gears with automatic, track-aware shifting.

| Aspect | Value |
|---|---|
| Gear ratios | [0.45, 0.60, 0.78, 0.95, 1.15, 1.35, 1.55] |
| Shift point | 7500 RPM (upshift → drops to 5000 RPM) |
| RPM climb | 1000/tick |
| Corner targets | Slow=2nd, Medium=3rd, Fast=4th |
| Corner speed cap | 55% of straight speed |

- **Straights:** upshift toward gear 7
- **Corners:** downshift 2 gears/tick toward target
- **Safety:** downshifts when RPM ≤ 1250 and gear > 1

### 🏁 Lap Progress
Distance accrues each tick based on:

```
speed = LAP_PROGRESS_BASE × RPM_ratio × gear_ratio × grip × tire_temp × pace × corner_factor × DRS_boost
```

| Factor | Default | Effect |
|---|---|---|
| Lap progress base | 9 | Base distance per tick |
| RPM ratio | 0–1 | Higher revs = faster |
| Gear ratio | 0.45–1.55 | Higher gear = more speed |
| Weather grip | 0.55–1.0 | Wet = slower |
| Tire temp grip | 0.90–1.0 | Cold/hot = slower |
| Corner cap | 0.55 | 55% speed in corners |
| DRS boost | 1.12 | +12% on straights |

A lap completes after accumulating 600 distance units (~78 ticks = ~19.5s).

### 🏁 Qualifying Mode
A 3-lap shootout where both player and AI set their fastest lap:
- Player gets 3 flying laps
- AI generates 3 laps independently
- Best lap determines grid position (P1 or P2)
- No weather shifts during qualifying
- Race simulation starts with the qualifying grid

---

## DRS Detection Zone *(New Feature)*

DRS (Drag Reduction System) is only available when:

1. AI rival is **enabled**
2. The car is on **detection segment** (main straight, segment 0)
3. The **gap to the rival** is ≤ 0.05 lap units (~1 second)

Once eligible, DRS stays active until the detection segment is exited or the lap completes. Without AI enabled, DRS works freely.

---

## Pit Window Strategy *(New Feature)*

The simulation projects tire wear and fuel consumption rates to recommend optimal pit timing:

| Threshold | Behaviour |
|---|---|
| ≤ 5 laps of tire/fuel remaining | Pit window **visible** on dashboard |
| ≤ 2 laps remaining | **"Box now!"** urgent alert + blinking tile |

The projection calculates:
- Wear per lap: `tireWearRate × (1 + RPM) × compoundFactor × weatherFactor`
- Fuel per lap: `fuelRate × fuelPerTick × ticksPerLap`
- Limiting factor: whichever runs out first (tires or fuel)

---

## Weather System

### Conditions

| Condition | Grip | Tire Wear | Temp Bias | Strategy |
|---|---|---|---|---|
| **Dry** | 1.00 | 1.00 | 0°C | Baseline, full pace |
| **Cloudy** | 0.95 | 0.90 | -3°C | Slightly slower, cooler |
| **Wet** | 0.75 | 1.30 | -8°C | Significantly slower, high tire wear |
| **Storm** | 0.55 | 1.60 | -12°C | Extreme caution needed |

### Dynamic Weather Shifts *(Enabled by default)*
Weather can change mid-race, forcing strategic pit stops:

- Shift scheduled when race simulation starts
- Change lap: randomly chosen between **lap 4 and lap 8**
- **2-lap forecast** announced via radio before the change
- Driver can pit to change tire compound for new conditions
- Disabled during qualifying

---

## AI Rival Difficulty

| Level | Pace Factor | Variance | Behaviour |
|---|---|---|---|
| **Easy** | 0.80 | ±12% | Both slower and inconsistent |
| **Medium** | 0.92 | ±7% | Balanced opponent, beatable |
| **Hard** | 1.00 | ±3% | Consistent, matches player pace |
| **Random** | — | — | Picks one above randomly |

- Base lap time: **31,200ms**
- Final time: `base / paceFactor × randomSwing`
- AI has its own leaderboard (capped at 5 fastest laps)
- AI tracks qualifying laps independently during qualifying mode

---

## Configuration Reference

All constants live in [`src/config.js`](../src/config.js). Key exports:

### `CAR_SETTINGS`
```js
{
  RPM_IDLE: 750,
  RPM_MAX: 8000,
  RPM_OVERTAKE_BOOST: 2000,
  OVERTAKE_DURATION_MS: 8000,
  OVERTAKE_BATTERY_COST: 20,
  PIT_STOP_DURATION_MS: 4000,
  SIMULATION_TICK_MS: 250,
  FUEL_CONSUMPTION_RATE: { LEAN: 0.08, STANDARD: 0.2, RICH: 0.48 },
  BATTERY_RECHARGE_RATE: 0.08,
  TIRE_WEAR_RATE: 0.6,
  LAP_DISTANCE: 600,
  TOTAL_LAPS: 10,
  LAP_PROGRESS_BASE: 9,
  TEMP_AMBIENT: 90,
  TEMP_OPTIMAL_MAX: 120,
  TEMP_CRITICAL: 140,
  DAMAGE_OVERHEAT_RATE: 4,
  DAMAGE_WORN_TIRE_RATE: 2,
  AI_BASE_LAP_MS: 31200,
  // ... gears, track layout, corner caps, etc.
}
```

### Other Exports

| Export | Purpose |
|---|---|
| `CAR_PRESETS` | 4 car presets with stat multipliers |
| `AI_DIFFICULTY` | EASY/MEDIUM/HARD paceFactor + variance |
| `FUEL_MIXES` | LEAN/STANDARD/RICH display labels |
| `TIRE_COMPOUNDS` | SOFT (1.6×)/MEDIUM (1.0×)/HARD (0.6×) wear factors |
| `ERS_MODES` | HOTLAP (0.3×)/BALANCED (1.0×)/CHARGE (2.0×) recharge factors |
| `WEATHER_CONDITIONS` | DRY/CLOUDY/WET/STORM with grip/wear/tempBias |
| `TIRE_TEMP` | Temperature thresholds, heat/cool rates, grip/wear factors |
| `DRS_DETECTION` | Detection segment, eligibility gap threshold |
| `PIT_WINDOW` | Show window laps, urgent threshold, suggest-ahead laps |
| `QUALIFYING` | Number of qualifying laps (3) |
| `WEATHER_SHIFT` | Enabled/disabled, change lap range, forecast laps |
