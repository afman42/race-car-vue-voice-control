# Race Car Voice Control

A Vue.js application that allows you to control a virtual race car using voice commands. Experience the thrill of Formula 1 racing through voice-controlled commands in your browser — now with **bilingual support** (English & Indonesian).

## Features

- **Voice Control**: Control various car functions with simple voice commands
- **Manual Controls**: A full set of on-screen buttons so the app works without a microphone
- **Real-time Dashboard**: Monitor engine, RPM, DRS, overtake, tires, fuel, battery, fuel mix, ERS mode, and engine temperature
- **Race Progress**: Lap counter that advances as you drive, finishing after the final lap
- **Interactive Simulation**: Realistic car behavior with fuel consumption based on RPM and fuel mix
- **Fuel Mix Strategy**: Switch between Lean, Standard, and Rich mixes to trade pace for fuel economy
- **Tire Compounds**: Fit Soft, Medium, or Hard tires (in the pits) to trade grip for durability
- **Tire Wear**: Tires degrade over time (faster at high RPM and on softer compounds)
- **ERS Deployment Modes**: Hotlap, Balanced, or Charge change how aggressively the battery harvests
- **Engine Temperature**: Heat builds at high RPM and during overtakes; overheating cuts power
- **Engine Stall**: Running out of fuel stalls the engine, just like the real thing
- **Radio Warnings**: Automatic voice alerts for critical fuel, battery, and engine temperature
- **Overtake Countdown**: Visual bar showing the remaining overtake boost
- **Audio Feedback**: Sound effects and voice responses for all actions
- **Bilingual Support**: Full English and Indonesian localization — UI text, voice responses, and voice commands all switch with the selected language
- **Language Persistence**: Your language choice is saved to localStorage
- **Accessible UI**: ARIA roles and live regions for screen-reader support
- **Graceful Audio Handling**: Sound effects that silently skip on load failure, keeping voice interactions smooth
- **Automatic Cleanup**: Simulation interval properly cleaned up when the component unmounts

## Language Support

The app supports **English** (default) and **Bahasa Indonesia**. A language dropdown in the top-right corner lets you switch at any time.

When you switch languages:
- All on-screen labels and buttons update immediately
- Voice responses (TTS) switch to the selected language
- Voice command keywords switch to the selected language
- Speech recognition language changes to match

## How to Use

1. Click the "Open Radio Channel" / "Buka Saluran Radio" button to start listening (or use the Manual Controls)
2. Speak clearly and wait for audio feedback
3. Use any of the voice commands listed below
4. Watch the dashboard update in real-time

## Voice Commands

### English

| Category | Commands |
|---|---|
| **Help** | "help", "what can I say", "commands" |
| **Engine** | "start engine", "stop engine", "shut down" |
| **DRS** | "drs" / "activate drs" to enable; "drs off", "close drs", "disable drs" to disable |
| **Overtake** | "overtake", "over take" |
| **Fuel Mix** | "lean mix", "rich mix", "standard mix" |
| **ERS Mode** | "hotlap", "charge mode", "balanced mode" |
| **Tire Compound** (in pits) | "soft tire", "medium tire", "hard tire" |
| **Tires** | "tire status", "check tire", "tyre" |
| **Fuel** | "fuel status", "tank status", "gas" |
| **Battery** | "battery status", "battery" |
| **Temperature** | "temperature", "engine temp", "temp status" |
| **Lap** | "lap status", "what lap", "current lap" |
| **Pit Stop** | "pit stop", "box box", "pit now" |
| **Reset** | "reset", "new race", "restart" |

### Bahasa Indonesia

| Kategori | Perintah |
|---|---|
| **Bantuan** | "bantuan", "tolong", "perintah apa", "daftar perintah" |
| **Mesin** | "nyalakan mesin", "hidupkan mesin", "start mesin", "matikan mesin", "stop mesin" |
| **DRS** | "drs", "drs mati", "tutup drs", "matikan drs" |
| **Salip** | "salip", "menyalip", "nyalip" |
| **Campuran BBM** | "campuran irit", "mode irit", "campuran kaya", "mode kaya", "campuran standar", "mode standar" |
| **Mode ERS** | "ers hotlap", "mode hotlap", "mode isi", "ers isi", "isi baterai", "mode seimbang", "ers seimbang" |
| **Jenis Ban** (di pit) | "ban lunak", "ban sedang", "ban medium", "ban keras" |
| **Ban** | "ban", "status ban" |
| **Bahan Bakar** | "bahan bakar", "bensin", "tangki" |
| **Baterai** | "baterai" |
| **Suhu** | "suhu", "temperatur", "status suhu" |
| **Lap** | "status lap", "lap berapa", "lap" |
| **Pit Stop** | "pit stop", "masuk pit", "ke pit" |
| **Atur Ulang** | "atur ulang", "balapan baru", "mulai ulang", "reset" |

## Technical Details

- Fuel consumption scales with RPM and the selected fuel mix
- Tires wear each tick while the engine runs, degrading Optimal → Used → Worn, scaled by compound
- Battery recharge rate is scaled by the ERS deployment mode
- Engine temperature rises with RPM and overtaking, cools toward ambient otherwise; crossing the critical threshold cuts power until the car is pitted
- Laps advance as accumulated distance (driven by RPM) builds up; the race ends after the final lap
- The engine stalls automatically when the fuel tank empties
- Critical fuel, battery, and temperature warnings are announced once per threshold crossing
- Engine must be running to activate DRS and overtake modes; tire compounds change only in the pits
- A pit stop refuels, recharges, cools the engine, and fits fresh tires
- All voice recognition happens in the browser using the Web Speech API
- All i18n messages live in `src/i18n.js` — easy to extend with new locales
- `audioService.js` tracks load errors per sound — broken audio files are silently skipped instead of crashing playback
- `useCar.js` auto-cleans the simulation interval on component unmount (no stale ticks)
- Tunable values live in `src/config.js`

## Project Structure

```
src/
├── config.js                          car simulation constants, fuel mixes, compounds, ERS modes
├── i18n.js                            internationalization engine (English + Indonesian)
├── main.js                            app bootstrap
├── App.vue                            root component
├── components/
│   ├── RaceControl.vue                UI, dashboard, manual controls, command dispatch
│   └── RaceControl.spec.js            component tests
├── composables/
│   ├── useCar.js                      core car state and actions (singleton)
│   ├── commandRouter.js               maps transcripts to command keys (multi-language)
│   ├── useCar.spec.js                 action/state tests
│   ├── useCarSimulation.spec.js       simulation-tick tests (fuel, tire wear, stall)
│   ├── useCarFeatures.spec.js         compound, ERS, temperature, lap, help tests
│   └── commandRouter.spec.js          command-matching tests
└── services/
    ├── audioService.js                preload + play sound effects
    ├── speechRecognitionService.js    Web Speech recognition wrapper
    └── textToSpeechService.js         speech synthesis wrapper
```

## Requirements

- Chrome browser (recommended)
- Microphone access enabled
- Earphones recommended for best audio experience
- No VPN or proxy recommended for optimal performance

## Setup

```bash
pnpm install
pnpm dev
```

## Running Tests

```bash
pnpm test       # watch mode
pnpm test:run   # single run
```

The test suite covers **70 tests** across 5 files:

| Test File | Tests | Coverage |
|---|---|---|
| `useCar.spec.js` | 18 | Engine, DRS, overtake, fuel mix, tire status, pit stop — including edge cases (engine-off overtake) |
| `useCarFeatures.spec.js` | 16 | Tire compounds, ERS modes, engine temperature, lap timer, help, reset |
| `useCarSimulation.spec.js` | 9 | Fuel consumption, battery recharge, tire wear, warnings, stall — including battery cap and post-race behavior |
| `commandRouter.spec.js` | 17 | All voice command keywords, no false matches, locale-specific matching (Indonesian + English fallback) |
| `RaceControl.spec.js` | 10 | Dashboard render, radio toggle, voice/manual commands, unmount cleanup |


## Notes

- Clear browser cache if experiencing issues
- For best results, use in a quiet environment
- Some commands require the engine to be running first
- Language preference is saved across sessions via localStorage
