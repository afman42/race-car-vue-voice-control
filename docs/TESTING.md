# Testing

The project runs two test suites: **unit tests** (Vitest) and **end-to-end tests** (Playwright).

> **Current counts:** 766 unit tests (26 files) + 67 e2e tests (2 files) = **833 total tests**

---

## Quick Commands

```bash
pnpm test:run         # Unit tests (single run) — 766 tests
pnpm test             # Unit tests in watch mode
pnpm test:coverage    # Unit tests + coverage report (fails under 80%)
pnpm test:e2e         # E2E tests — 67 tests (auto-starts dev server)
```

---

## Coverage

Coverage runs on the `v8` provider via `@vitest/coverage-v8`. Thresholds live in
`vitest.config.js` under `test.coverage.thresholds` and are enforced — the run
**exits non-zero** if any metric drops below **80%**:

| Metric | Threshold | Current |
|---|---|---|
| Statements | 80% | 97% |
| Branches | 80% | 92% |
| Functions | 80% | 99% |
| Lines | 80% | 98% |

Scope: `src/**/*.{js,vue}`, excluding `*.spec.js` and `src/components/RaceControl.css`
(a plain stylesheet with no statements to cover). Reports are written to
`coverage/` — gitignored.

```bash
pnpm test:coverage                              # full report + threshold gate
npx vitest run --coverage --coverage.include='src/services/**'   # narrow scope
```

---

## Test File Map

### Unit Tests — Vitest (766 tests, 26 files)

**Composables (294 tests)**

| Test File | Tests | What It Covers |
|---|---|---|
| `src/composables/useRaceControl.spec.js` | 95 | Listening toggle, speech-error mapping, relisten scheduling, overtake countdown, gear flash, segment/position display, car selection, full command-action table |
| `src/composables/commandRouter.spec.js` | 43 | Exact matching, fuzzy matching, locale-specific, rejection, Levenshtein |
| `src/composables/useCar.spec.js` | 34 | Engine, DRS, overtake, fuel mix, tire status, pit stop, car selection, qualifying |
| `src/composables/useCarRaceFeatures.spec.js` | 29 | Lap timing, leaderboard, weather effects, weather shifts, damage |
| `src/composables/useCarAiRival.spec.js` | 22 | AI difficulty, lap generation, leaderboard, status query, qualifying mode |
| `src/composables/useCarSimulation.spec.js` | 20 | Fuel consumption, tire wear, battery recharge, autoShift, stall, overheat, pitting guard |
| `src/composables/useQualifying.spec.js` | 17 | Grid position vs. rival, display info object, session restart, status/best-lap branches |
| `src/composables/useCarFeatures.spec.js` | 16 | Tire compounds, ERS modes, engine temperature, lap timer, help, reset |
| `src/composables/useCarCarSelect.spec.js` | 11 | Car selection, stat comparisons (fuel, wear, corner speed, straight speed) |
| `src/composables/useCarStandings.spec.js` | 7 | Race standings, position callout, track position, solo vs. rival |

**Components (116 tests)**

| Test File | Tests | What It Covers |
|---|---|---|
| `src/components/RaceControl.spec.js` | 37 | Dashboard render, voice/manual commands, segment display, car modal, standings |
| `src/components/RaceControlTiles.spec.js` | 33 | Conditional tiles: qualifying badges/overlay, DRS zone indicator, pit-window tile, temp/damage severity classes, shift lights, rival panel, language selector |
| `src/components/CarSelectModal.spec.js` | 22 | Card rendering, stat bars, select/close events, focus capture & restore, Tab/Shift+Tab focus trap, Escape |
| `src/components/TrackMap.spec.js` | 14 | Marker placement from path geometry, rival visibility, segment boundary markers, start/finish anchoring, geometry-unavailable fallback |
| `src/components/RpmGauge.spec.js` | 10 | Needle offset across the rpm range, clamping, reactivity, accessible label, geometry-unavailable fallback |

**Services (97 tests)**

| Test File | Tests | What It Covers |
|---|---|---|
| `src/services/speechRecognitionService.spec.js` | 36 | Constructor fallback, language switching, confidence-based transcript selection, error forwarding, auto-restart backoff, fatal-error suppression, manual-stop flag |
| `src/services/engineAudioService.spec.js` | 27 | AudioContext lifecycle, harmonic layers, rpm→frequency mapping, shift blips, fade-out & deferred cleanup, teardown |
| `src/services/textToSpeechService.spec.js` | 20 | Availability guards, utterance setup, voice selection precedence, cancel-and-defer queueing, dispose |
| `src/services/audioService.spec.js` | 14 | Preload idempotency, shared elements for duplicate paths, playback resolution on end/error/blocked autoplay |

**Config, i18n & utils (259 tests)**

| Test File | Tests | What It Covers |
|---|---|---|
| `src/locales/locales.spec.js` | 177 | en/id key parity, entry-kind parity, every template renders filled and tolerates missing params |
| `src/config.spec.js` | 36 | `validateConfig` guards, gear/temp/tire/damage threshold ordering, car preset stat bounds, mode-table monotonicity, strategy windows |
| `src/i18n.spec.js` | 21 | Locale detection (storage → navigator → default), `t()` interpolation & fallbacks, `setLocale` persistence, `useI18n` surface |
| `src/utils/raceStanding.spec.js` | 15 | totalProgress, loopPosition, computeStandings, formatPosition |
| `src/utils/formatLapTime.spec.js` | 6 | Lap time formatting, null/undefined, non-finite, rounding, no 4-digit millis |
| `src/App.spec.js` | 2 | Main landmark, dashboard mount |
| `src/main.spec.js` | 2 | Mount target, `validateConfig` runs before mount |

### E2E Tests — Playwright (67 tests, 2 files)

| Test File | Tests | What It Covers |
|---|---|---|
| `e2e/race-app.spec.js` | 39 | Initial state, engine/gears, AI rival, manual controls, language toggle, lap timing, leaderboard, weather cycling, status commands, race progression, reset, AI gap tracking |
| `e2e/race-control.spec.js` | 28 | Dashboard state, engine/gears, AI difficulty, DRS/overtake, weather, fuel/ERS/tires, status queries, language switch, track map, reset, full race flow |

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

### 7. Re-importing Modules with Fresh State

The service modules keep state at module scope (cached voices, the recognition
instance, the `AudioContext`). Service specs install their stubs, then re-import
the real implementation so each test starts clean:

```js
const loadService = async () => {
  vi.resetModules();
  const mod = await vi.importActual("@/services/engineAudioService");
  return mod.default;
};
```

`vi.importActual` is required because `vitest.setup.js` globally mocks
`audioService` and `textToSpeechService`. `i18n.spec.js` uses the same trick to
re-run its one-time locale detection per test.

### 8. Stubbing Browser APIs jsdom Lacks

jsdom provides no Web Audio, no `SpeechRecognition`, and no SVG geometry. Each
has to be installed on the global before import and removed afterwards:

```js
// Constructors MUST use `function` — an arrow function is not newable.
window.AudioContext = vi.fn(function () {
  return fakeContext;
});

// jsdom has no SVGPathElement; <path> nodes are plain SVGElement.
SVGElement.prototype.getTotalLength = function () {
  return 126;
};
SVGElement.prototype.getPointAtLength = function (len) {
  return { x: len, y: len / 2 };
};
```

jsdom *does* ship `window.Audio`, so the "API unavailable" branches must null it
explicitly (`window.Audio = undefined`) and restore the original after.

### 9. Testing a Composable That Registers Lifecycle Hooks

`useRaceControl()` calls `onUnmounted`, so it only runs inside a component
instance. A throwaway host component exposes the API and gives the test control
over unmount:

```js
const mountControl = () => {
  let api;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useRaceControl();
        return () => null;
      },
    }),
  );
  return { api, wrapper };
};
```

### 10. Fake Timers for Deferred Behaviour

Auto-restart backoff, the 500ms relisten, the gear flash, and the overtake
countdown are all timer-driven. `vi.useFakeTimers()` also fakes `Date.now()`,
which the countdown reads, so elapsed-time math advances in step:

```js
vi.useFakeTimers();
api.toggleListening();
await capturedOnResult("start engine");
vi.advanceTimersByTime(500);
expect(speechService.startListening).toHaveBeenCalled();
```

Reset with `vi.useRealTimers()` in `afterEach`. Note that advancing past the
overtake duration also runs simulation ticks — hold `rpm` at idle if the
simulation's overheat cut would otherwise clear the flag first.

---

## Running Specific Tests

```bash
# Run a single test file
npx vitest run src/composables/useCar.spec.js

# Run tests matching a pattern
npx vitest run --reporter verbose -t "DRS"

# Coverage for one directory only (thresholds still apply to that subset)
npx vitest run --coverage --coverage.include='src/services/**' src/services

# Run a single e2e test file
npx playwright test e2e/race-control.spec.js --reporter list

# Run e2e tests with visible browser
npx playwright test --headed
```

---

## Writing New Tests

1. **Unit tests:** Follow the singleton reset pattern in `beforeEach`
2. **Composable tests:** Import `useCar()`, modify state directly, call actions, assert results
3. **Composables with lifecycle hooks:** Wrap in a throwaway host component (pattern 9)
4. **Component tests:** Mount the component, use the captured speech callback where voice is involved
5. **Service tests:** Stub the browser API, then `vi.resetModules()` + `vi.importActual` (patterns 7–8)
6. **Utility tests:** Pure functions — no setup needed
7. **E2E tests:** Add to existing spec files or create new ones in `e2e/`

Colocate unit specs beside their subject as `<name>.spec.js`. Run
`pnpm test:coverage` before opening a PR — the 80% thresholds are enforced and
will fail the run, not just warn.
