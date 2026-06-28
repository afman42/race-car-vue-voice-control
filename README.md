# 🏎️ Race Car Voice Control

> **Control a virtual Formula 1 car with your voice — right in the browser.**

A Vue 3 single-page application that combines **speech recognition**, **real-time physics simulation**, and an interactive racing dashboard. Speak commands to start the engine, shift fuel strategies, deploy DRS, battle an AI rival, and more. Supports **English** and **Bahasa Indonesia**.

---

## Quick Start

```bash
pnpm install
pnpm dev        # Start dev server (https)
pnpm test:run   # Run all 159 tests
```

> **Requirements:** Chrome browser. Microphone access. HTTPS (auto-configured with a self-signed cert).

---

## Features

- **🎤 Voice Control** — 50+ voice commands with fuzzy matching that tolerates recognition slips
- **🕹️ Manual Controls** — Full on-screen button grid, no microphone needed
- **🏁 10-Lap Races** — Each lap timed, fastest laps tracked on a leaderboard
- **🤖 AI Rival** — Race a computer opponent at Easy / Medium / Hard / Random difficulty
- **🌦️ Weather System** — Dry, Cloudy, Wet, or Storm affect grip, tire wear, and engine cooling
- **🔧 Pit Stops** — Refuel, recharge, cool the engine, repair damage, fit fresh tires
- **📊 Live Dashboard** — RPM gauge, track map, position badge, and real-time status displays
- **🌐 Bilingual** — Full English and Indonesian localization (UI, voice responses, commands)
- **⚠️ Radio Warnings** — Automatic voice alerts for critical fuel, battery, overheating, damage

---

## Documentation

| Document | Description |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Requirements, installation, project scripts, troubleshooting |
| [`docs/COMMANDS.md`](docs/COMMANDS.md) | All voice commands (English & Bahasa Indonesia) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Project structure, design decisions, data flow |
| [`docs/SIMULATION.md`](docs/SIMULATION.md) | Physics model, weather effects, AI difficulty, configuration |
| [`docs/TESTING.md`](docs/TESTING.md) | Test suite breakdown, patterns, and how to run tests |

---

## Project Structure

```
src/
├── config.js              # Tunable constants (physics, AI, compounds)
├── i18n.js                # i18n engine (English + Indonesian)
├── main.js                # App bootstrap
├── App.vue                # Root component
├── components/
│   └── RaceControl.vue    # Main UI: dashboard, controls, command dispatch
├── composables/
│   ├── useCar.js          # Core singleton: car state, simulation, actions
│   ├── useAiRival.js      # AI rival singleton: lap-time generator
│   └── commandRouter.js   # Voice transcript → command key (exact + fuzzy)
├── utils/
│   ├── formatLapTime.js   # Lap time formatter (M:SS.mmm)
│   └── raceStanding.js    # Progress, standings, position formatting
└── services/
    ├── audioService.js              # Sound effects (graceful on failure)
    ├── speechRecognitionService.js  # Web Speech API (auto-restart)
    └── textToSpeechService.js       # Speech synthesis (voice matching)
```

---

## Tech Stack

- **Vue 3** with Composition API + `<script setup>`
- **Vite 7** with Vue plugin + basic SSL
- **Vitest** + **jsdom** + **@vue/test-utils** for testing
- **Web Speech API** (speech recognition + synthesis)
- **pnpm** as package manager
