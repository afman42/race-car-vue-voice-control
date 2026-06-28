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

// Play a quick, higher-pitched blip for upshifts — short burst, rising then
// dropping, like a Formula 1 pneumatic quick-shift.
const playShiftUp = () => {
  if (!audioCtx || !isActive) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch { /* skip */ }
};

// Play a deeper, more aggressive blip for downshifts — lower pitch with a
// longer duration and a bit of grumble (sawtooth), simulating a rev-matched
// downshift blip. Augmented with a backfire crackle: a noise burst with two
// popping overtones that mimic unburnt fuel igniting in the exhaust.
const playShiftDown = () => {
  if (!audioCtx || !isActive) return;
  try {
    const now = audioCtx.currentTime;

    // --- Main downshift blip: sawtooth grumble ---
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    // --- Backfire crackle: brief white-noise burst ---
    const sampleRate = audioCtx.sampleRate;
    const burstLength = Math.floor(sampleRate * 0.12); // 120ms of noise
    const noiseBuffer = audioCtx.createBuffer(1, burstLength, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < burstLength; i++) {
      // Exponential decay envelope: loud pop then rapid fade
      const env = Math.exp(-i / (sampleRate * 0.025));
      noiseData[i] = (Math.random() * 2 - 1) * env;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseSource.start(now + 0.02);
    noiseSource.stop(now + 0.15);

    // --- Pop overtones: two short sine bursts for the "crackle" ---
    for (let p = 0; p < 2; p++) {
      const popOsc = audioCtx.createOscillator();
      const popGain = audioCtx.createGain();
      const popTime = now + 0.03 + p * 0.04;
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(p === 0 ? 1800 : 2200, popTime);
      popOsc.frequency.exponentialRampToValueAtTime(800, popTime + 0.03);
      popGain.gain.setValueAtTime(0.08, popTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.04);
      popOsc.connect(popGain);
      popGain.connect(audioCtx.destination);
      popOsc.start(popTime);
      popOsc.stop(popTime + 0.04);
    }
  } catch { /* skip */ }
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
   * Play a quick upshift blip (higher pitch, short burst).
   */
  onShiftUp() {
    playShiftUp();
  },

  /**
   * Play a deeper downshift blip (sawtooth, rev-matched feel).
   */
  onShiftDown() {
    playShiftDown();
  },

  /**
   * Whether the engine sound is currently active.
   */
  get isActive() {
    return isActive;
  },
};
