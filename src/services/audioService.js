// src/services/audioService.js

/**
 * A lightweight audio manager that pre-loads sound effects and plays them on
 * demand. Load failures are tracked so play() silently skips broken sounds
 * instead of rejecting — keeping voice interactions smooth even when audio
 * assets are missing or fail to load.
 */

// This object will hold our pre-loaded audio elements
const sounds = {};

// Set of sound names that loaded successfully
const loaded = new Set();

// A map of sound names to their file paths
const soundFiles = {
  engineStart: "/audio/engine-start.mp3",
  engineStop: "/audio/engine-stop.mp3",
  drsOn: "/audio/beep.mp3",
  drsOff: "/audio/beep.mp3",
  overtakeOn: "/audio/overtake-on.mp3",
};

/**
 * Create a single Audio element, wire up load-event handlers, and return it.
 * The caller uses the `ready` promise to know when loading is done.
 */
const createAudio = (src) => {
  const audio = new window.Audio(src);
  audio.preload = "auto";
  return audio;
};

export default {
  /**
   * Pre-loads all audio files into Audio objects.
   * This is crucial for instant playback without network delay.
   */
  loadSounds() {
    if (typeof window === "undefined" || typeof window.Audio === "undefined") {
      console.warn("Audio API not available; skipping sound preload.");
      return;
    }

    for (const key in soundFiles) {
      const audio = createAudio(soundFiles[key]);

      // Mark the sound as loaded once playback becomes possible
      audio.addEventListener("canplaythrough", () => loaded.add(key), {
        once: true,
      });

      // If the file fails to load (404, network error, etc.), log it but keep
      // the app working — play() will gracefully skip broken sounds.
      audio.addEventListener("error", () => {
        console.warn(`Audio load failed: ${soundFiles[key]} (sound: "${key}")`);
      });

      sounds[key] = audio;
    }
  },

  /**
   * Play a pre-loaded sound. Resolves immediately (silently) if the sound
   * failed to load, so callers never need to catch audio errors.
   * @param {string} name - The name of the sound to play.
   * @returns {Promise<void>}
   */
  playSound(name) {
    if (
      typeof window === "undefined" ||
      typeof window.Audio === "undefined" ||
      !sounds[name]
    ) {
      return Promise.resolve();
    }

    // Gracefully skip sounds that failed to load.
    if (!loaded.has(name)) {
      return Promise.resolve();
    }

    const audio = sounds[name];

    return new Promise((resolve) => {
      const onEnded = () => {
        audio.removeEventListener("ended", onEnded);
        resolve();
      };

      audio.addEventListener("ended", onEnded);
      audio.currentTime = 0;

      audio.play().catch(() => {
        // Play can still fail at runtime (e.g. browser autoplay policy).
        // Log a warning but resolve so voice interactions stay smooth.
        console.warn(`Audio play failed: "${name}" — browser may have blocked playback`);
        audio.removeEventListener("ended", onEnded);
        resolve();
      });
    });
  },
};
