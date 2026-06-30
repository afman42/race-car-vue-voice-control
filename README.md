# 🏎️ Race Car Voice Control

> **Control a virtual Formula 1 car with your voice — right in the browser.**
>
> Speak commands to start the engine, shift fuel strategies, deploy DRS, battle an AI rival, manage tire temperature, plan pit stops, and more. Supports **English** and **Bahasa Indonesia**.

---

## ✨ Features at a Glance

| Category | Capabilities |
|---|---|
| **🎤 Voice Control** | 50+ commands with fuzzy matching — minor speech-recognition slips are tolerated |
| **🕹️ Manual Controls** | Full on-screen button grid — no microphone needed |
| **🏁 10-Lap Races** | Each lap timed with a live leaderboard of the fastest 5 laps |
| **🤖 AI Rival** | Easy / Medium / Hard / Random difficulty opponents |
| **🌦️ Dynamic Weather** | Dry, Cloudy, Wet, Storm — affects grip, tire wear, engine cooling. Mid-race shifts add strategy |
| **🏎️ 4 Car Presets** | Speedster, Balanced, Grip Master, Endurance — each changes speed, grip, tire wear, fuel use |
| **🏆 Qualifying Mode** | 3-lap shootout to determine grid position (P1 vs P2) |
| **🌡️ Tire Temperature** | Cold → Optimal → Hot → Overheated — affects grip, wear, and damage |
| **🔧 Pit Stop Strategy** | Recommended pit window based on tire/fuel projections, "Box now" alerts |
| **📊 DRS Detection Zone** | DRS only available within 1s of the rival at the detection point |
| **🔧 Pit Stops** | Refuel, recharge, cool engine, repair damage, fit new tires |
| **⚙️ Full Simulation** | Gears, RPM, fuel consumption, tire degradation, ERS modes, engine temperature, damage |
| **⚠️ Radio Warnings** | Automatic voice alerts for critical fuel, battery, overheating, and damage |
| **🌐 Bilingual** | Full English and Indonesian localization for UI, voice, and commands |

---

## 🚀 Quick Start

```bash
pnpm install
pnpm dev              # Start dev server (https://localhost:5173)
pnpm test:run         # Run 236 unit tests (Vitest)
pnpm test:e2e         # Run 67 end-to-end tests (Playwright)
```

> **Requirements:** Chrome browser, microphone access, HTTPS (auto-configured with a self-signed cert), Node.js 18+, pnpm.

---

## 🧠 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Vue 3 SPA (Vite + pnpm)                      │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ RaceControl   │──▶│ useRaceControl│──▶│  useCar (Orchestrator)│ │
│  │ (Main UI)     │   │ (UI Logic)    │   │                      │ │
│  └──────────────┘   └──────────────┘   └───┬──────────────────┘ │
│       │                                     │                    │
│       ▼                                     ▼                    │
│  ┌──────────────┐   ┌────────────────────────────────────┐      │
│  │ManualControls│   │  useCarState (Singleton State)     │      │
│  │CarSelectModal│   │  useCarSimulation (Physics Tick)   │      │
│  │TrackMap      │   │  useAiRival (Lap-Time Generator)   │      │
│  │RpmGauge      │   │  useQualifying (Quali Logic)       │      │
│  │Leaderboard   │   └────────────────────────────────────┘      │
│  └──────────────┘                                              │
└──────────────────────────────────────────────────────────────────┘
```

**Key design pattern:** All state lives at **module scope** (singleton pattern). Every composable shares the same reactive instances — no prop drilling, no provide/inject needed.

---

## 📁 Project Structure

```
src/
├── config.js                # All tunable constants (physics, AI, weather, DRS, etc.)
├── i18n.js                  # Internationalization engine
├── main.js                  # App bootstrap
├── App.vue                  # Root component (global font & dark theme)
│
├── components/              # Vue SFCs (template + script + styles)
│   ├── RaceControl.vue      # Main dashboard UI (540 lines)
│   ├── RaceControl.css      # Dashboard styles (extracted for maintainability)
│   ├── TrackMap.vue         # SVG track map with player/rival markers
│   ├── RpmGauge.vue         # RPM gauge with needle + shift lights
│   ├── Leaderboard.vue      # Fastest laps board (player + AI)
│   ├── ManualControls.vue   # On-screen button grid
│   └── CarSelectModal.vue   # Pre-race car selection modal
│
├── composables/             # Vue 3 composables (reactive logic)
│   ├── useCarState.js       # Singleton state refs + helpers
│   ├── useCarSimulation.js  # Simulation tick (physics engine)
│   ├── useCar.js            # Slim orchestrator (~620 lines)
│   ├── useRaceControl.js    # UI orchestration, command routing, speech
│   ├── useAiRival.js        # AI rival lap-time generator
│   ├── useQualifying.js     # Qualifying mode logic (extracted)
│   └── commandRouter.js     # Voice transcript → command key
│
├── commands/
│   └── matchers.js          # Voice command keyword matchers (en + id)
│
├── locales/
│   ├── en.js                # English message dictionary
│   └── id.js                # Indonesian message dictionary
│
├── utils/
│   ├── formatLapTime.js     # Lap time formatter (M:SS.mmm)
│   └── raceStanding.js      # Progress, standings, position formatting
│
└── services/                # Browser API wrappers
    ├── audioService.js              # Sound effects
    ├── engineAudioService.js        # Synthesized engine pitch
    ├── speechRecognitionService.js  # Web Speech API wrapper
    └── textToSpeechService.js       # Speech synthesis wrapper
```

---

## 📖 Documentation

| Document | What You'll Find |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Requirements, installation, scripts, troubleshooting |
| [`docs/COMMANDS.md`](docs/COMMANDS.md) | All voice commands (English & Bahasa Indonesia) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Design decisions, data flow, component relationships |
| [`docs/SIMULATION.md`](docs/SIMULATION.md) | Physics model, weather, AI difficulty, full configuration reference |
| [`docs/TESTING.md`](docs/TESTING.md) | Test breakdown, patterns, and how to run |

---

## 🧪 Test Summary

| Suite | Tests | Runner |
|---|---|---|
| **Unit tests** | 236 across 11 files | Vitest + jsdom |
| **E2E tests** | 67 across 2 files | Playwright (Chromium) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Vue 3 (Composition API + `<script setup>`) |
| **Build** | Vite 7 with Vue plugin + basic SSL |
| **Testing (unit)** | Vitest + jsdom + @vue/test-utils |
| **Testing (e2e)** | Playwright |
| **Speech** | Web Speech API (recognition + synthesis) |
| **Package Manager** | pnpm |
