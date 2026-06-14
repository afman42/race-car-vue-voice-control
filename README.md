# Race Car Voice Control

A Vue.js application that allows you to control a virtual race car using voice commands. Experience the thrill of Formula 1 racing through voice-controlled commands in your browser.

## Features

- **Voice Control**: Control various car functions with simple voice commands
- **Real-time Dashboard**: Monitor engine status, RPM, DRS, overtake, fuel mix, fuel, battery, and tire conditions
- **Interactive Simulation**: Realistic car behavior with fuel consumption based on RPM and fuel mix
- **Fuel Mix Strategy**: Switch between Lean, Standard, and Rich mixes to trade pace for fuel economy
- **Tire Wear**: Tires degrade over time (faster at high RPM) and are reset on a pit stop
- **Engine Stall**: Running out of fuel stalls the engine, just like the real thing
- **Radio Warnings**: Automatic voice alerts when fuel or battery levels get critical
- **Overtake Countdown**: Visual bar showing the remaining overtake boost
- **Audio Feedback**: Sound effects and voice responses for all actions
- **Accessible UI**: ARIA roles and live regions for screen-reader support

## How to Use

1. Click the "Open Radio Channel" button to start listening
2. Speak clearly and wait for audio feedback
3. Use any of the voice commands listed below
4. Watch the dashboard update in real-time

## Voice Commands

- **Engine**: "start engine", "stop engine", or "shut down"
- **DRS**: "drs" / "activate drs" to enable; "drs off", "close drs", or "disable drs" to disable
- **Overtake**: "overtake" or "over take"
- **Fuel Mix**: "lean mix", "rich mix", or "standard mix"
- **Tires**: "tire status", "check tire", or "tyre"
- **Fuel**: "fuel status", "tank status", or "gas"
- **Battery**: "battery status" or "battery"
- **Pit Stop**: "pit stop"
- **Reset**: "reset", "new race", or "restart"

## Technical Details

- The simulation includes realistic fuel consumption that scales with RPM and the selected fuel mix
- Tires wear down each tick while the engine runs, degrading through Optimal -> Used -> Worn
- The engine stalls automatically when the fuel tank empties
- Low-fuel and low-battery warnings are announced once per threshold crossing
- Battery recharges automatically when below full
- Engine must be running to activate DRS and overtake modes
- A pit stop refuels, recharges, and fits fresh tires
- All voice recognition happens in the browser using the Web Speech API
- Tunable values live in `src/config.js`

## Project Structure

```
src/
├── config.js                          car simulation constants and fuel mixes
├── main.js                            app bootstrap
├── App.vue                            root component
├── components/
│   ├── RaceControl.vue                UI, dashboard, and command dispatch
│   └── RaceControl.spec.js            component tests
├── composables/
│   ├── useCar.js                      core car state and actions (singleton)
│   ├── commandRouter.js               maps transcripts to command keys
│   ├── useCar.spec.js                 action/state tests
│   ├── useCarSimulation.spec.js       simulation-tick tests
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

## Notes

- Clear browser cache if experiencing issues
- For best results, use in a quiet environment
- Some commands require the engine to be running first
