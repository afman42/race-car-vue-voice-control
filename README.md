# Race Car Voice Control

A Vue.js application that allows you to control a virtual race car using voice commands. Experience the thrill of Formula 1 racing through voice-controlled commands in your browser.

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
- **Accessible UI**: ARIA roles and live regions for screen-reader support

## How to Use

1. Click the "Open Radio Channel" button to start listening (or use the Manual Controls)
2. Speak clearly and wait for audio feedback
3. Use any of the voice commands listed below
4. Watch the dashboard update in real-time

## Voice Commands

- **Help**: "help", "what can I say", or "commands"
- **Engine**: "start engine", "stop engine", or "shut down"
- **DRS**: "drs" / "activate drs" to enable; "drs off", "close drs", or "disable drs" to disable
- **Overtake**: "overtake" or "over take"
- **Fuel Mix**: "lean mix", "rich mix", or "standard mix"
- **ERS Mode**: "hotlap", "charge mode", or "balanced mode"
- **Tire Compound** (in the pits): "soft tire", "medium tire", or "hard tire"
- **Tires**: "tire status", "check tire", or "tyre"
- **Fuel**: "fuel status", "tank status", or "gas"
- **Battery**: "battery status" or "battery"
- **Temperature**: "temperature", "engine temp", or "temp status"
- **Lap**: "lap status", "what lap", or "current lap"
- **Pit Stop**: "pit stop", "box box", or "pit now"
- **Reset**: "reset", "new race", or "restart"

## Technical Details

- Fuel consumption scales with RPM and the selected fuel mix
- Tires wear each tick while the engine runs, degrading Optimal -> Used -> Worn, scaled by compound
- Battery recharge rate is scaled by the ERS deployment mode
- Engine temperature rises with RPM and overtaking, cools toward ambient otherwise; crossing the
  critical threshold cuts power until the car is pitted
- Laps advance as accumulated distance (driven by RPM) builds up; the race ends after the final lap
- The engine stalls automatically when the fuel tank empties
- Critical fuel, battery, and temperature warnings are announced once per threshold crossing
- Engine must be running to activate DRS and overtake modes; tire compounds change only in the pits
- A pit stop refuels, recharges, cools the engine, and fits fresh tires
- All voice recognition happens in the browser using the Web Speech API
- Tunable values live in `src/config.js`

## Project Structure

```
src/
├── config.js                          car simulation constants, fuel mixes, compounds, ERS modes
├── main.js                            app bootstrap
├── App.vue                            root component
├── components/
│   ├── RaceControl.vue                UI, dashboard, manual controls, command dispatch
│   └── RaceControl.spec.js            component tests
├── composables/
│   ├── useCar.js                      core car state and actions (singleton)
│   ├── commandRouter.js               maps transcripts to command keys
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

## Notes

- Clear browser cache if experiencing issues
- For best results, use in a quiet environment
- Some commands require the engine to be running first
