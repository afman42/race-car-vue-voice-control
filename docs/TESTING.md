# Testing

The project runs two test suites: **unit tests** (Vitest) and **end-to-end tests** (Playwright).

> **Current counts:** 236 unit tests (11 files) + 67 e2e tests (2 files) = **303 total tests**

---

## Quick Commands

```bash
pnpm test:run         # Unit tests (single run) — 236 tests
pnpm test             # Unit tests in watch mode
pnpm test:ui          # Vitest UI dashboard (interactive)
pnpm test:e2e         # E2E tests — 67 tests (auto-starts dev server)
```

---

## Test File Map

### Unit Tests — Vitest (236 tests, 11 files)

| Test File | Tests | What It Covers |
|---|---|---|
| `src/composables/useCar.spec.js` | 22 | Engine, DRS, overtake, fuel mix, tire status, pit stop, car selection, qualifying |
| `src/composables/useCarFeatures.spec.js` | 16 | Tire compounds, ERS modes, engine temperature, lap timer, help, reset |
| `src/composables/useCarSimulation.spec.js` | 20 | Fuel consumption, tire wear, battery recharge, autoShift, stall, overheat, pitting guard |
| `src/composables/useCarRaceFeatures.spec.js` | 22 | Lap timing, leaderboard, weather effects, weather shifts, damage |
| `src/composables/useCarAiRival.spec.js` | 15 | AI difficulty, lap generation, leaderboard, status query, qualifying mode |
| `src/composables/useCarStandings.spec.js` | 7 | Race standings, position callout, track position, solo vs. rival |
| `src/composables/useCarCarSelect.spec.js` | 11 | Car selection, stat comparisons (fuel, wear, corner speed, straight speed) |
| `src/composables/commandRouter.spec.js` | 33 | Exact matching, fuzzy matching, locale-specific, rejection, Levenshtein |
| `src/components/RaceControl.spec.js` | 30 | Dashboard render, voice/manual commands, segment display, car modal, standings |
| `src/utils/raceStanding.spec.js` | 15 | totalProgress, loopPosition, computeStandings, formatPosition |
| `src/utils/formatLapTime.spec.js` | 4 | Lap time formatting, null/undefined, rounding |

### E2E Tests — Playwright (67 tests, 2 files)

| Test File | Tests | What It Covers |
|---|---|---|
| `e2e/race-control.spec.js` | 28 | Dashboard state, engine/gears, AI difficulty, DRS/overtake, weather, fuel/ERS/tires, status queries, language switch, track map, reset, full race flow |
| `e2e/race-app.spec.js` | 39 | Initial state, engine/gears, AI rival, manual controls, language toggle, lap timing, leaderboard, weather cycling, status commands, race progression, reset, AI gap tracking |

---

## Testing Patterns

### 1. Singleton State Reset

Because `useCar` and `useAiRival` use module-level state (singleton pattern), tests must manually reset state between runs:

```js
import { useCar } from "./useCar";

beforeEach(async () => {
  const { resetRace, disableAi, aiEnabled } = useCar();
  await resetRace();
  if (aiEnabled.value) await disableAi();
  vi.clearAllMocks();
});
```

### 2. Simulation Ticks Without Waiting

The `runSimulationTick` function is exposed for direct calls — no need to wait for 250ms intervals:

```js
const { runSimulationTick, fuelLevel } = useCar();
engineStatus.value = true;
rpm.value = CAR_SETTINGS.RPM_MAX;

for (let i = 0; i < 10; i++) runSimulationTick();
expect(fuelLevel.value).toBeLessThan(100);
```

### 3. Command Router as Pure Function

Command matching is tested as pure functions — no Vue reactivity needed:

```js
import { matchCommand } from "@/composables/commandRouter";

expect(matchCommand("start engine")).toBe("startEngine");
expect(matchCommand("start engin")).toBe("startEngine"); // fuzzy match
expect(matchCommand("xyzzy")).toBeNull();
```

### 4. Mocked Audio Services

Both `audioService` and `textToSpeechService` are globally mocked in `vitest.setup.js`. Tests can assert on mock calls:

```js
expect(audioService.playSound).toHaveBeenCalledWith("engineStart");
expect(ttsService.speak).toHaveBeenCalledWith("Engine started.");
```

### 5. Speech Recognition Capture

Component tests capture the speech callback to simulate voice commands:

```js
let capturedOnResult = null;

vi.mock("@/services/speechRecognitionService", () => ({
  default: {
    startListening: vi.fn((onResult) => {
      capturedOnResult = onResult;
      return true;
    }),
    // ...
  },
}));

// Simulate a voice command:
await wrapper.get(".control-button").trigger("click");
await capturedOnResult("start engine");
```

### 6. E2E Test Patterns

- All tests start with a fresh `page.goto("/")`
- Assertions use Playwright's auto-retrying matchers (`toBeVisible`, `toContainText`)
- Button clicks use `page.getByRole("button", { name: "Exact Text" })` for precision
- Dashboard tiles selected via `.display-item` filter locators
- Tests depending on simulation time use generous timeouts and `test.setTimeout()`

---

## Running Specific Tests

```bash
# Run a single test file
npx vitest run src/composables/useCar.spec.js

# Run tests matching a pattern
npx vitest run --reporter verbose -t "DRS"

# Run a single e2e test file
npx playwright test e2e/race-control.spec.js --reporter list

# Run e2e tests with visible browser
npx playwright test --headed
```

---

## Writing New Tests

1. **Unit tests:** Follow the singleton reset pattern in `beforeEach`
2. **Composable tests:** Import `useCar()`, modify state directly, call actions, assert results
3. **Component tests:** Mount `RaceControl.vue`, use captured speech callback
4. **Utility tests:** Pure functions — no setup needed
5. **E2E tests:** Add to existing spec files or create new ones in `e2e/`
