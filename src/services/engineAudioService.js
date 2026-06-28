// src/services/engineAudioService.js

/**
 * Synthesizes a continuous engine sound using the Web Audio API.
 * The pitch tracks RPM in real time, and a brief "blip" plays on gear shifts.
 * Falls back gracefully when the AudioContext is unavailable.
 */

let audioCtx = null;
let masterGain = null;
let isActive = false;

// Oscillator nodes for a layered engine sound
const layers = [];

// Harmonic structure: each layer is { frequency multiplier, gain }
const HARMONICS = [
  { mult: 1.0, gain: 0.12 }, // fundamental
  { mult: 2.0, gain: 0.06 }, // 2nd harmonic
  { mult: 3.0, gain: 0.03 }, // 3rd harmonic
  { mult: 0.5, gain: 0.04 }, // sub-harmonic (rumble)
];

// Map RPM (0..8000) to a frequency range
const RPM_FREQ_MIN = 35;
const RPM_FREQ_MAX = 160;

const rpmToFrequency = (rpm) => {
  const t = Math.max(0, Math.min(1, rpm / 8000));
  return RPM_FREQ_MIN + t * (RPM_FREQ_MAX - RPM_FREQ_MIN);
};

// Create all oscillator nodes and connect them through the gain chain.
const createOscillators = () => {
  if (!audioCtx) return;

  // Master gain controls overall volume (ramp up/down to avoid clicks).
  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);

  for (const { mult, gain } of HARMONICS) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Sawtooth gives a buzzy engine-like tone; lower harmonics use triangle
    // for a fuller sound.
    osc.type = mult >= 2 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(RPM_FREQ_MIN * mult, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);

    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.start();

    layers.push({ osc, gainNode, mult });
  }
};

// Play a short "blip" sound to simulate a gear shift.
const playShiftBlip = () => {
  if (!audioCtx || !isActive) return;

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Silently skip if audio context is in a bad state.
  }
};

export default {
  /**
   * Start the engine sound. Creates the AudioContext on first call (browsers
   * require a user gesture to create/resume an AudioContext).
   * @returns {boolean} true if the sound started successfully.
   */
  start(rpm = 4000) {
    if (isActive) return true;
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      return false;
    }

    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      createOscillators();

      // Fade in over 200ms to avoid a click.
      if (masterGain) {
        masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.2);
      }

      isActive = true;
      return true;
    } catch (e) {
      console.warn('Engine audio: could not start AudioContext', e);
      return false;
    }
  },

  /**
   * Stop the engine sound. Fades out to avoid a click, then stops oscillators.
   */
  stop() {
    if (!isActive || !audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      // Fade out over 300ms.
      if (masterGain) {
        masterGain.gain.setValueAtTime(masterGain.gain.value || 0.3, now);
        masterGain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      }

      // Stop oscillators after the fade completes.
      for (const { osc } of layers) {
        osc.stop(now + 0.35);
      }
    } catch {
      // Ignore errors during cleanup.
    }

    layers.length = 0;
    masterGain = null;
    isActive = false;
  },

  /**
   * Update the engine pitch to match the current RPM. Called each simulation
   * tick (or more often for smooth transitions).
   * @param {number} rpm
   */
  setRpm(rpm) {
    if (!isActive || !audioCtx) return;
    const baseFreq = rpmToFrequency(rpm);
    const now = audioCtx.currentTime;

    for (const { osc, mult } of layers) {
      // Ramp smoothly to avoid zipper noise.
      osc.frequency.setTargetAtTime(baseFreq * mult, now, 0.1);
    }

    // Increase gain slightly at high RPM for a more aggressive sound.
    if (masterGain) {
      const targetGain = 0.15 + (rpm / 8000) * 0.25;
      masterGain.gain.setTargetAtTime(targetGain, now, 0.15);
    }
  },

  /**
   * Call this when a gear shift happens to play a brief blip.
   */
  onShift() {
    playShiftBlip();
  },

  /**
   * Whether the engine sound is currently active.
   */
  get isActive() {
    return isActive;
  },
};
