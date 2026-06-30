# Architecture

## Project Structure

```
src/
├── config.js                    # All tunable constants
├── i18n.js                      # i18n engine (locale detection + t())
├── main.js                      # Vue app bootstrap
├── App.vue                      # Root component (global font & dark theme)
│
├── components/                  # Vue Single-File Components
│   ├── RaceControl.vue          # Main dashboard UI (~540 lines)
│   ├── RaceControl.css          # Dashboard styles (extracted for readability)
│   ├── TrackMap.vue             # SVG track map with player/rival markers
│   ├── RpmGauge.vue             # RPM gauge with needle animation
│   ├── Leaderboard.vue          # Fastest laps board (player + AI)
│   ├── ManualControls.vue       # On-screen button grid
│   └── CarSelectModal.vue       # Pre-race car selection modal
│
├── commands/
│   └── matchers.js              # Voice command keyword matchers (en + id)
│
├── composables/                 # Vue 3 reactive logic
│   ├── useCarState.js           # Singleton state refs + helpers (source of truth)
│   ├── useCarSimulation.js      # Core simulation tick (physics engine)
│   ├── useCar.js                # Slim orchestrator (~620 lines)
│   ├── useRaceControl.js        # UI orchestration, speech, command routing
│   ├── useAiRival.js            # AI rival lap-time generator
│   ├── useQualifying.js         # Qualifying mode logic (extracted)
│   └── commandRouter.js         # Voice transcript → command key
│
├── locales/
│   ├── en.js                    # English messages
│   └── id.js                    # Indonesian messages
│
├── utils/
│   ├── formatLapTime.js         # Lap time formatter
│   └── raceStanding.js          # Progress, standings, position formatting
│
└── services/                    # Browser API wrappers
    ├── audioService.js              # Sound effect playback
    ├── engineAudioService.js        # Synthesized engine pitch (Web Audio API)
    ├── speechRecognitionService.js  # Web Speech API recognition
    └── textToSpeechService.js       # Web Speech API synthesis
```

---

## Design Decisions

### 1. Singleton State Pattern

**All state is module-scoped** — every `useCar()` call returns the same reactive instances. No prop drilling, no provide/inject needed. The whole app synchronizes automatically.

```
Module-level refs (useCarState.js)
    ├── engineStatus, rpm, currentGear
    ├── tireLife, tireTemp, tireCompound
    ├── fuelLevel, batteryLevel, fuelMix, ersMode
    ├── engineTemp, overheating, carDamage
    ├── currentLap, lapProgress, raceFinished
    ├── drsStatus, drsEligible, overtakeActive
    ├── weather, nextWeather, weatherChangeLap
    ├── pitWindowStart, pitWindowVisible, pitWindowUrgent
    ├── raceMode, qualifyingLapsRemaining, qualifyingBestLap
    └── ... plus computed helpers (effectiveStats, paceFactor, etc.)
```

**Reset pattern:** `_resetSingletons()` restores all state to defaults. Used by both tests (via `beforeEach`) and the production `resetRace()` action.

### 2. AI as a Lap-Time Generator

The AI rival (`useAiRival.js`) is **not** a full physics simulation — it has no engine, fuel, tires, or temperature. Instead it's a simple **lap-time generator**:

- Each tick accrues simulated milliseconds toward a target lap time
- Difficulty settings (`paceFactor` + `variance`) control speed and consistency
- On completing a lap, it posts a time to its own leaderboard
- This keeps the player's simulation completely independent

### 3. Two-Pass Command Matching

`commandRouter.js` resolves voice transcripts to command keys using two passes:

1. **Pass 1 — Word-boundary match** (fast, precise): checks if any keyword appears at a word boundary in the transcript. Prevents "collapse" matching "lap" while allowing "raining" to match "rain". Short keywords (< 4 chars) require exact matches to prevent false positives.

2. **Pass 2 — Fuzzy match** (tolerant): splits transcript into tokens, then checks each keyword phrase using per-word **Levenshtein edit distance**. Tolerates slips like "start engin" → "startEngine".

**Keyword ordering matters** — matchers are ordered in `commands/matchers.js` with specific multi-word commands before broad single-word ones (e.g. "tire temperature" before "temperature", "qualifying status" before "qualifying").

### 4. Feature Extraction (Slim Composables)

The project follows a pattern of extracting focused composables from the main orchestrator:

| Composable | Extracted From | Purpose |
|---|---|---|
| `useCarState.js` | — | Singleton state (always existed) |
| `useCarSimulation.js` | `useCar.js` | Physics tick, auto-shift, stall/overheat |
| `useRaceControl.js` | `RaceControl.vue` | UI logic, speech, command routing |
| `useQualifying.js` | `useCar.js` | Qualifying mode (P1/P2 shootout) |

This keeps each file focused and testable.

### 5. Graceful Error Handling

Every service is designed to **never crash the app**:

| Service | Safeguard |
|---|---|
| `audioService.js` | Tracks load failures, silently resolves for broken sounds |
| `textToSpeechService.js` | Resolves on error instead of rejecting (headless browsers) |
| `runCommand()` | Wraps each action in try-catch |
| `speechRecognitionService.js` | Fatal errors (`not-allowed`) suppress auto-restart |

### 6. Warning Latches

Each critical threshold (fuel, battery, temperature, damage, tire temp) triggers exactly **one** voice alert per crossing. A latch resets when the value recovers, preventing spam.

### 7. Auto-Restarting Speech Recognition

After each successful command, speech recognition auto-restarts after **500ms**. Manual "Stop Radio" sets a flag that prevents auto-restart. Fatal errors (microphone denied) also suppress auto-restart.

---

## Data Flow

```
1. User speaks a command
        ↓
2. SpeechRecognitionService (Web Speech API)
        ↓
3. commandRouter.matchCommand(transcript, locale)
   → Pass 1: exact word-boundary match
   → Pass 2: fuzzy Levenshtein match
        ↓
4. Command key (e.g. "startEngine", "fuelMixLean")
        ↓
5. RaceControl.vue → runCommand(command)
   → commandActions[command]() from useRaceControl
   → Updates reactive state in useCarState
   → Speaks response via TTS
   → Returns status message
        ↓
6. Dashboard updates reactively via Vue computed properties
   (speedKmh, tireStatus, standings, etc.)
```

---

## Services Layer

### `audioService.js`
- Pre-loads `Audio` elements at startup
- `playSound(name)` silently resolves for failed loads
- Graceful fallback when Audio API is unavailable

### `engineAudioService.js`
- Synthesizes continuous engine pitch via `OscillatorNode` + gain
- `start(rpm)` / `setRpm(rpm)` / `stop()` for smooth transitions
- Upshift blips (sine 1200→600 Hz) and downshift grumbles (sawtooth + white noise)

### `speechRecognitionService.js`
- Wraps `webkitSpeechRecognition` / `SpeechRecognition`
- Dynamic language switching via `setLanguage()`
- Auto-restart unless manually stopped or fatal error occurred
- Handles: mic denied, not supported, no speech, network errors

### `textToSpeechService.js`
- Wraps `window.speechSynthesis`
- Caches voice list, refreshes on `voiceschanged` event
- Picks voice matching current language (prefers exact BCP-47 match)
- Cancels in-progress speech before new utterances
- Rate set to 1.1× for natural pacing
- **Never rejects** — errors log as warnings and resolve silently

---

## Simulation Loop

```
Engine ON or AI enabled (and not pitting)
    ↓
250ms tick interval (setInterval)
    ↓
runSimulationTick():
    ├── Skip if pitting
    ├── Fuel consumption (RPM × mix rate)
    ├── Tire wear (RPM × compound × weather × tire temp factor)
    ├── Battery recharge (ERS mode)
    ├── Engine temperature (RPM + overtake - cooling + weather bias)
    ├── Tire temperature (driving heat - coasting cool + weather bias)
    ├── DRS eligibility check (distance to rival on detection segment)
    ├── Pit window projection (tire wear + fuel per lap)
    ├── Weather shift check (forecast + apply)
    ├── Damage accrual (overheat + worn tires + overheated tires)
    ├── Lap progress (RPM × gear × grip × tire temp × DRS boost)
    ├── AI rival tick (independent lap-time generator)
    ├── Warning checks (fuel, battery, temp, damage, tire temp)
    ├── RPM climb
    ├── Track-aware gear shifting (autoShift)
    └── Engine stall / overheat check
```
