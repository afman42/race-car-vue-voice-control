# 🏎️ Race Car Voice Control

> **Control a virtual Formula 1 car with your voice — right in the browser.**

A Vue 3 single-page application that combines **speech recognition**, **real-time physics simulation**, and an interactive racing dashboard. Speak commands to start the engine, shift fuel strategies, deploy DRS, battle an AI rival, and more. Supports **English** and **Bahasa Indonesia**.

---

## Quick Start

```bash
pnpm install
pnpm dev              # Start dev server (https://localhost:5173)
pnpm test:run         # Run unit tests (Vitest)
pnpm test:e2e         # Run end-to-end tests (Playwright)
```

> **Requirements:** Chrome browser, microphone access, HTTPS (auto-configured with a self-signed cert).

---

## Features

| Area | What You Can Do |
|---|---|
| **🎤 Voice Control** | 50+ commands with fuzzy matching — minor speech-recognition slips are tolerated |
| **🕹️ Manual Controls** | Full on-screen button grid — no microphone needed |
| **🏁 10-Lap Races** | Each lap timed with a live leaderboard of the fastest 5 laps |
| **🤖 AI Rival** | Race Easy / Medium / Hard / Random opponents |
| **🌦️ Weather System** | Dry, Cloudy, Wet, or Storm — each affects grip, tire wear, and engine cooling |
| **🔧 Pit Stops** | Refuel, recharge, cool the engine, repair damage, and fit new tires |
| **⚙️ Simulation** | Gears, RPM, fuel consumption, tire degradation, ERS modes, engine temperature, damage |
| **📊 Live Dashboard** | RPM gauge, track map, position badge, shift lights, segment display |
| **🌐 Bilingual** | Full English and Indonesian localization for UI, voice responses, and commands |
| **⚠️ Radio Warnings** | Automatic voice alerts for critical fuel, battery, overheating, and damage |

---

## Documentation

| Document | Description |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Requirements, installation, scripts, troubleshooting |
| [`docs/COMMANDS.md`](docs/COMMANDS.md) | All voice commands (English & Bahasa Indonesia) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Project structure, design decisions, data flow |
| [`docs/SIMULATION.md`](docs/SIMULATION.md) | Physics model, weather effects, AI difficulty, full configuration |
| [`docs/TESTING.md`](docs/TESTING.md) | Unit & e2e test breakdown, patterns, and how to run |

---

## Project Structure

```
src/
├── config.js              # Tunable constants (physics, AI, compounds)
├── i18n.js                # i18n engine (English + Indonesian)
├── main.js                # App bootstrap
├── App.vue                # Root component (global font & dark theme)
├── components/
│   ├── RaceControl.vue    # Main UI: dashboard, controls, command dispatch
│   ├── TrackMap.vue       # SVG track map with player/rival markers
│   ├── RpmGauge.vue       # RPM gauge with needle + shift lights
│   ├── Leaderboard.vue    # Fastest laps board (player + AI)
│   └── ManualControls.vue # On-screen button grid (keyboard fallback)
├── commands/
│   └── matchers.js        # Voice command keyword matchers (en + id)
├── composables/
│   ├── useCar.js          # Core singleton: car state, simulation, actions
│   ├── useAiRival.js      # AI rival singleton: lap-time generator
│   └── commandRouter.js   # Voice transcript → command key (exact + fuzzy)
├── locales/
│   ├── en.js              # English message dictionary
│   └── id.js              # Indonesian message dictionary
├── utils/
│   ├── formatLapTime.js   # Lap time formatter (M:SS.mmm)
│   └── raceStanding.js    # Progress, standings, position formatting
└── services/
    ├── audioService.js              # Sound effects (graceful on failure)
    ├── engineAudioService.js        # Synthesized engine pitch (Web Audio API)
    ├── speechRecognitionService.js  # Web Speech API (auto-restart, fatal-error guard)
    └── textToSpeechService.js       # Speech synthesis (voice matching, voiceschanged cache)

e2e/
├── race-control.spec.js   # 28 Playwright tests for core dashboard flow
└── race-app.spec.js       # 39 Playwright tests for comprehensive app behavior
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Vue 3 (Composition API + `<script setup>`) |
| **Build** | Vite 7 with Vue plugin + basic SSL |
| **Testing (unit)** | Vitest + jsdom + @vue/test-utils |
| **Testing (e2e)** | Playwright (Chromium) |
| **Speech** | Web Speech API (recognition + synthesis) |
| **Package Manager** | pnpm |
