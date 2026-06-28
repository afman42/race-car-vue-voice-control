# Testing

The project runs two test suites: **unit tests** (Vitest) and **end-to-end tests** (Playwright).

---

## Quick Commands

```bash
pnpm test:run         # Unit tests (Vitest, single run) — ~159 tests
pnpm test             # Unit tests in watch mode
pnpm test:ui          # Vitest UI dashboard
pnpm test:e2e         # E2E tests (Playwright) — ~66 tests total
pnpm test:e2e:ui      # Playwright UI mode (interactive debug)
```

> **E2E tests require the dev server to be running** — Playwright auto-starts it via `webServer` config.

---

## Unit Tests — Vitest (159 tests across 11 files)

### Core Composable Tests

| Test File | Tests | What It Covers |
|---|---|---|
| `useCar.spec.js` | 18 | Engine start/stop, DRS toggle, overtake activation, fuel mix switching, pit stop — including edge cases like overtake with engine off |
| `useCarFeatures.spec.js` | 16 | Tire compound changes (pit-only enforcement), ERS mode switching, engine temperature, lap timer, help command, race reset |
| `useCarSimulation.spec.js` | 9 | Fuel consumption at different RPMs, battery recharge (including cap at 100%), tire wear, engine stall, warning latches, post-race behavior |
| `useCarRaceFeatures.spec.js` | 22 | Lap timing and completion, fastest-lap leaderboard (sorting, capping), weather effects on grip and wear, damage accrual and pace penalty |
| `useCarAiRival.spec.js` | 15 | AI difficulty levels, lap generation, leaderboard sorting/capping, status query (with and without laps), disable, reset |
| `useCarStandings.spec.js` | 7 | Race standings computation, position callout, track-loop position, solo vs. rival scenarios |

### Utility Tests

| Test File | Tests | What It Covers |
|---|---|---|
| `raceStanding.spec.js` | 15 | `totalProgress` (normal and edge cases), `loopPosition` wrapping, `computeStandings` (ahead, behind, tie, solo), `formatPosition` |
| `formatLapTime.spec.js` | 4 | M:SS.mmm formatting, null/undefined placeholder, rounding, sub-minute zero-padding |

### Routing & Component Tests

| Test File | Tests | What It Covers |
|---|---|---|
| `commandRouter.spec.js` | 33 | Exact keyword matching, false-positive rejection (short strings), locale-specific matching, fuzzy (Levenshtein) matching with tolerance |
| `RaceControl.spec.js` | 15 | Dashboard render, radio toggle, voice/manual command execution, AI controls (enable/disable), race standings display, unmount cleanup |

---

## E2E Tests — Playwright (66 tests across 2 files)

| Test File | Tests | What It Covers |
|---|---|---|
| `race-control.spec.js` | 28 | Initial state, engine & gear simulation, AI difficulty buttons, DRS/overtake, weather, fuel/ERS/tires, status queries, language switch, track map, manual controls, reset, full race flow |
| `race-app.spec.js` | 38 | Initial state, engine & gears, AI rival difficulty, manual controls (all subsystems), language toggle, lap timing & leaderboard, weather cycling, status commands, race progression, reset, AI gap tracking |

### E2E Test Patterns

- All tests start fresh via `page.goto("/")` (no `beforeEach` in `race-app.spec.js`, one in `race-control.spec.js`)
- Assertions use Playwright's auto-retrying matchers (`toBeVisible`, `toContainText`, etc.)
- Tests that depend on simulation time (gear shifts, lap completion) use generous timeouts and `test.setTimeout()` when needed
- Button clicks use `page.getByRole("button", { name: "Exact Text" })` for precision
- Dashboard tiles are selected via `.display-item` filter locators to avoid strict-mode ambiguity

---

## Testing Patterns

### Singleton State Reset

Because `useCar` and `useAiRival` use module-level state (singleton pattern), tests must manually reset state between runs:

```js
const { resetRace, disableAi, aiEnabled } = useCar();
await resetRace();
if (aiEnabled.value) await disableAi();
```

### Simulation Edge Cases

To test simulation ticks without waiting 2 seconds, the `runSimulationTick` function is exposed and called directly:

```js
const { runSimulationTick, fuelLevel } = useCar();
await startEngine();
// Fast-forward fuel consumption
for (let i = 0; i < 10; i++) runSimulationTick();
expect(fuelLevel.value).toBeLessThan(100);
```

### Command Router

Command matching is tested as a pure function — no Vue reactivity needed:

```js
import { matchCommand } from '@/composables/commandRouter';
expect(matchCommand("start engine")).toBe("startEngine");
expect(matchCommand("start engin")).toBe("startEngine"); // fuzzy match
expect(matchCommand("xyzzy")).toBeNull();
```
