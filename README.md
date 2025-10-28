# Race Car Voice Control

A Vue.js application that allows you to control a virtual race car using voice commands. Experience the thrill of Formula 1 racing through voice-controlled commands in your browser.

## Features

- **Voice Control**: Control various car functions with simple voice commands
- **Real-time Dashboard**: Monitor engine status, RPM, DRS, fuel, battery, and tire conditions
- **Interactive Simulation**: Realistic car behavior with fuel consumption based on RPM
- **Audio Feedback**: Sound effects and voice responses for all actions

## How to Use

1. Click the "Open Radio Channel" button to start listening
2. Speak clearly and wait for audio feedback
3. Use any of the voice commands listed below
4. Watch the dashboard update in real-time

## Voice Commands

- **Engine**: "start engine" or "stop engine" / "shut down"
- **DRS**: "activate drs", "enable drs", "drs", or "dr"
- **Overtake**: "activate overtake", "enable overtake", "take", or "ready"
- **Tires**: "check tires", "tire status", "tire", or "t"
- **Fuel**: "fuel status", "tank status", or "gas"
- **Battery**: "battery status" or "battery"
- **Pit Stop**: "pit stop"

## Technical Details

- The simulation includes realistic fuel consumption that increases with RPM
- Battery recharges automatically when not in use
- Engine must be running to activate DRS and overtake modes
- All voice recognition happens in the browser using the Web Speech API

## Requirements

- Chrome browser (recommended)
- Microphone access enabled
- Earphones recommended for best audio experience
- No VPN or proxy recommended for optimal performance

## Setup

```bash
npm install
npm run dev
```

## Running Tests

```bash
npm run test
```

## Notes

- Clear browser cache if experiencing issues
- For best results, use in a quiet environment
- Some commands require the engine to be running first
