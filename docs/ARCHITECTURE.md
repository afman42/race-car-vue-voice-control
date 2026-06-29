# Architecture

## Project Structure

```
src/
├── config.js                        # All tunable constants (physics, AI, compounds, etc.)
├── i18n.js                          # Internationalization engine (locale detection + t())
├── main.js                          # Vue app bootstrap
├── App.vue                          # Root component (applies global font & dark theme)
│
├── components/
│   ├── RaceControl.vue              # Main UI: dashboard, controls (template + styles only)
│   ├── TrackMap.vue                 # SVG track map with player/rival markers + segment boundaries
│   ├── RpmGauge.vue                 # RPM gauge with needle animation
│   ├── Leaderboard.vue              # Fastest laps board (player + AI, reused)
│   ├── ManualControls.vue           # On-screen button grid (keyboard fallback)
│   └── CarSelectModal.vue           # Pre-race car selection modal (4 presets)
│
├── commands/
│   └── matchers.js                  # Voice command keyword matchers (en + id), ordered
│
├── composables/                     # Vue 3 composables (reactive state + logic)
│   ├── useCarState.js               # Module-scoped singleton state refs + computed properties
│   ├── useCarSimulation.js           # Core simulation tick, autoShift, stall/overheat
│   ├── useCar.js                    # Slim orchestrator: imports state + sim, exposes public API
│   ├── useAiRival.js                # AI rival singleton: lap-time generator
│   ├── useRaceControl.js            # UI orchestration: command routing, speech, overtake countdown
│   ├── commandRouter.js             # Voice transcript → command key (exact + fuzzy matching)
│   ├── useCar.spec.js               # Engine, DRS, overtake, pit stop, car selection tests
│   ├── useCarSimulation.spec.js     # Simulation tick + autoShift edge case tests
│   ├── useCarFeatures.spec.js       # Compound, ERS, temperature, lap, help tests
│   ├── useCarRaceFeatures.spec.js   # Lap timing, leaderboard, weather, damage tests
│   ├── useCarAiRival.spec.js        # AI difficulty, lap generation, board tests
│   ├── useCarStandings.spec.js      # Race standings & track position tests
│   └── commandRouter.spec.js        # Command matching & fuzzy tests
│
├── locales/
│   ├── en.js                        # English message dictionary (UI + spoken + errors)
│   └── id.js                        # Indonesian message dictionary
│
├── utils/
│   ├── formatLapTime.js             # Lap time formatter: M:SS.mmm
│   ├── formatLapTime.spec.js        # Formatter unit tests
│   ├── raceStanding.js              # Progress, standings, position formatting
│   └── raceStanding.spec.js         # Standings utility unit tests
│
└── services/                        # Browser API wrappers
    ├── audioService.js              # Preload + play sound effects (graceful on failure)
    ├── speechRecognitionService.js  # Web Speech API recognition wrapper (auto-restart, fatal-error guard)
    ├── textToSpeechService.js       # Web Speech API synthesis wrapper (voice matching, voiceschanged cache)
    └── engineAudioService.js        # Synthesized engine pitch via Web Audio API (node disconnect on stop)

e2e/                                 # Playwright end-to-end tests
├── race-control.spec.js             # 28 tests: dashboard, engine, AI, DRS, etc.
└── race-app.spec.js                 # 39 tests: comprehensive app behavior
```

---

## Design Decisions

### Singleton State Pattern

All state is defined at **module scope** (outside the composable function), so every component that calls `useCar()` or `useAiRival()` shares the **same reactive instance**. No prop drilling, no provide/inject needed — the whole app is synchronized by default.

### AI as a Lap-Time Generator

The AI rival (`useAiRival.js`) is modeled as a **lap-time generator**, not a full physics car. It has no engine, fuel, tires, or temperature simulation. Each tick it accrues simulated time toward a target lap time (determined by difficulty), and on completion posts a time to its own leaderboard. This keeps the human car's state completely independent.

### Two-Pass Command Matching

The `commandRouter.js` module resolves voice transcripts to command keys. Keyword matchers are defined in `commands/matchers.js` (ordered — specific multi-word commands before broad single-word ones):

1. **Pass 1 — Word-boundary match** (fast, precise): checks if any known keyword appears at a word boundary in the transcript (prevents "collapse" matching "lap" while still allowing "raining" to match "rain")
2. **Pass 2 — Fuzzy match** (tolerant): splits the transcript into word tokens, then checks each keyword phrase using per-word Levenshtein edit distance

Short keywords (< 4 chars) require exact matches to prevent false positives (e.g. "t" matching "tire").

### Graceful Audio Handling

Both `audioService.js` and `textToSpeechService.js` are designed to **never crash the app**:

- `audioService.js` tracks sound load failures and silently resolves for broken sounds
- `textToSpeechService.js` resolves on error instead of rejecting, so headless browsers (Playwright) don't break command processing
- The `runCommand` function in `RaceControl.vue` wraps each action in a try-catch as a safety net

### Warning Latches

Each critical threshold (fuel, battery, temperature, damage) triggers exactly **one** voice alert per crossing. A latch flips when the threshold is crossed and resets when the value recovers, preventing spam.

### Auto-Restarting Speech Recognition

After each successful command, the speech recognition service automatically restarts after a 500ms delay. Manually clicking "Stop Radio" / "Hentikan Radio" sets a flag that prevents auto-restart. Fatal errors (`not-allowed`, `service-not-allowed`, `audio-capture`) also suppress auto-restart to avoid infinite retry loops when the microphone is denied.

---

## Data Flow

```
User speaks
    ↓
SpeechRecognitionService (Web Speech API)
    ↓
commandRouter.matchCommand(transcript, locale)
    → exact match → fuzzy match
    ↓
command key (e.g. "startEngine", "fuelMixLean")
    ↓
RaceControl.vue → commandActions[command]()
    → wrapped in try-catch → updates reactive state
    → speaks response via TTS → returns status message
    ↓
Dashboard updates reactively via Vue computed properties
```

---

## Simulation Loop

```
Engine ON or AI enabled (and not pitting)
    ↓
250ms tick interval (setInterval)
    ↓
runSimulationTick():
    ├── Skip if pitting (pit stop freezes all systems)
    ├── Fuel consumption (RPM × mix rate)
    ├── Tire wear (RPM × compound × weather)
    ├── Battery recharge (ERS mode)
    ├── Engine temperature (RPM + overtake - cooling)
    ├── Damage accrual (overheat + worn tires)
    ├── Lap progress (RPM × gear × grip × pace × DRS boost on straights)
    ├── AI rival tick
    ├── Warning checks (fuel, battery, temp, damage)
    ├── RPM climb (+1000/tick)
    ├── Track-aware gear shifting (autoShift)
    └── Engine stall / overheat check
```

---

## Services

### `audioService.js`
- Pre-loads `Audio` elements at startup
- Tracks loaded sounds in a `Set`
- `playSound(name)` silently resolves for failed loads
- Falls back gracefully when `Audio` API is unavailable (e.g. server-side rendering)

### `engineAudioService.js`
- Synthesizes a continuous engine pitch via `OscillatorNode` + gain
- `start(rpm)` / `setRpm(rpm)` / `stop()` for smooth pitch transitions
- `onShiftUp()` / `onShiftDown()` play quick blip sounds with distinct character
  - Upshifts: short sine burst (1200→600 Hz)
  - Downshifts: sawtooth grumble + backfire crackle with white-noise burst

### `speechRecognitionService.js`
- Wraps `window.SpeechRecognition` / `webkitSpeechRecognition`
- Supports dynamic language switching via `setLanguage()`
- **Auto-restart**: if the recognition service ends without manual stoppage, it restarts after 100ms — unless the last error was fatal (`not-allowed`, `service-not-allowed`, `audio-capture`), which suppresses restart to avoid infinite loops
- Handles errors: mic denied, not supported, no speech, network

### `textToSpeechService.js`
- Wraps `window.speechSynthesis`
- Caches the voice list and refreshes on the `voiceschanged` event (Chrome populates `getVoices()` asynchronously)
- Picks a voice matching the current language (prefers exact BCP-47 match)
- Cancels any in-progress speech before starting new utterances
- **Never rejects** — errors are logged as warnings and resolved silently
- Rate set to 1.1× for natural pacing

---

## Configuration

All tunable constants live in [`src/config.js`](../src/config.js). Key sections:

| Export | Purpose |
|---|---|
| `CAR_SETTINGS` | Core simulation: RPM, gears, fuel, tires, battery, temperature, damage, lap timing, track layout |
| `AI_DIFFICULTY` | EASY / MEDIUM / HARD pace factors and variance |
| `FUEL_MIXES` | LEAN / STANDARD / RICH display labels |
| `TIRE_COMPOUNDS` | SOFT / MEDIUM / HARD wear factors |
| `ERS_MODES` | HOTLAP / BALANCED / CHARGE recharge factors |
| `WEATHER_CONDITIONS` | DRY / CLOUDY / WET / STORM grip, wear, temp bias |

See [`docs/SIMULATION.md`](SIMULATION.md) for the full reference.
