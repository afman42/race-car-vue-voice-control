# Architecture

## Project Structure

```
src/
├── config.js                        # All tunable constants (physics, AI, compounds, etc.)
├── i18n.js                          # Internationalization engine + all message dictionaries
├── main.js                          # Vue app bootstrap
├── App.vue                          # Root component (applies global font & dark theme)
│
├── components/
│   ├── RaceControl.vue              # Main UI: dashboard, track map, controls, command dispatch
│   └── RaceControl.spec.js          # Component integration tests
│
├── composables/                     # Vue 3 composables (reactive state + logic)
│   ├── useCar.js                    # Core singleton: car state, simulation, all public actions
│   ├── useAiRival.js                # AI rival singleton: lap-time generator
│   ├── commandRouter.js             # Voice transcript → command key (exact + fuzzy matching)
│   ├── useCar.spec.js               # Engine, DRS, overtake, pit stop tests
│   ├── useCarSimulation.spec.js     # Simulation tick tests (fuel, tires, stall)
│   ├── useCarFeatures.spec.js       # Compound, ERS, temperature, lap, help tests
│   ├── useCarRaceFeatures.spec.js   # Lap timing, leaderboard, weather, damage tests
│   ├── useCarAiRival.spec.js        # AI difficulty, lap generation, board tests
│   ├── useCarStandings.spec.js      # Race standings & track position tests
│   └── commandRouter.spec.js        # Command matching & fuzzy tests
│
├── utils/
│   ├── formatLapTime.js             # Lap time formatter: M:SS.mmm
│   ├── formatLapTime.spec.js        # Formatter unit tests
│   ├── raceStanding.js              # Progress, standings, position formatting
│   └── raceStanding.spec.js         # Standings utility unit tests
│
└── services/                        # Browser API wrappers
    ├── audioService.js              # Preload + play sound effects (graceful on failure)
    ├── speechRecognitionService.js  # Web Speech API recognition wrapper (auto-restart)
    └── textToSpeechService.js       # Web Speech API synthesis wrapper (voice matching)
```

---

## Design Decisions

### Singleton State Pattern

All state is defined at **module scope** (outside the composable function), so every component that calls `useCar()` or `useAiRival()` shares the **same reactive instance**. No prop drilling, no provide/inject needed — the whole app is synchronized by default.

### AI as a Lap-Time Generator

The AI rival (`useAiRival.js`) is modeled as a **lap-time generator**, not a full physics car. It has no engine, fuel, tires, or temperature simulation. Each tick it accrues simulated time toward a target lap time (determined by difficulty), and on completion posts a time to its own leaderboard.

This keeps the human car's state completely independent and avoids duplicating the complex physics engine.

### Two-Pass Command Matching

The `commandRouter.js` module resolves voice transcripts to command keys:

1. **Pass 1 — Exact substring match** (fast, precise): checks if any known keyword is a substring of the transcript
2. **Pass 2 — Fuzzy match** (tolerant): splits the transcript into word tokens, then checks each keyword phrase using per-word Levenshtein edit distance

Short keywords (< 4 chars) require exact matches to prevent false positives (e.g. "t" matching "tire").

### Graceful Audio Handling

The `audioService.js` tracks sound load failures. `playSound()` silently resolves for broken sounds instead of throwing, so voice interactions remain smooth even when audio assets are missing.

### Warning Latches

Each critical threshold (fuel, battery, temperature, damage) triggers exactly **one** voice alert per crossing. A latch flips when the threshold is crossed and resets when the value recovers, preventing spam.

### Auto-Restarting Speech Recognition

After each successful command, the speech recognition service automatically restarts after a 500ms delay. Manually clicking "Stop Radio" sets a flag that prevents auto-restart.

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
    ↓
useCar.js action (e.g. startEngine, setFuelMix)
    → updates reactive state
    → speaks response via TTS
    → returns status message
    ↓
Dashboard updates reactively via Vue computed properties
```

## Services

### `audioService.js`
- Pre-loads Audio elements at startup
- Tracks loaded sounds in a `Set`
- `playSound(name)` silently resolves for failed loads
- Falls back gracefully when `Audio` API is unavailable (e.g. server-side rendering)

### `speechRecognitionService.js`
- Wraps `window.SpeechRecognition` / `webkitSpeechRecognition`
- Supports dynamic language switching via `setLanguage()`
- **Auto-restart**: if the recognition service ends without manual stoppage, it restarts after 100ms
- Handles errors: mic denied, not supported, no speech, network

### `textToSpeechService.js`
- Wraps `window.speechSynthesis`
- Picks a voice matching the current language (prefers exact BCP-47 match)
- Cancels any in-progress speech before starting new utterances
- Rate set to 1.1x for natural pacing
