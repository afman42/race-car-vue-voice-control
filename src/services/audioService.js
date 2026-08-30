// src/services/audioService.js

/**
 * A lightweight audio manager that pre-loads sound effects and plays them on
 * demand. Playback is attempted directly (the browser buffers/stream as
 * needed) and every failure only warns — play() always resolves so voice
 * interactions stay smooth even when audio assets are missing, still loading,
 * or fail at runtime.
 */

// This object will hold our pre-loaded audio elements
const sounds = {};

// A map of sound names to their file paths (duplicate paths share one element)
const soundFiles = {
  engineStart: "/audio/engine-start.mp3",
  engineStop: "/audio/engine-stop.mp3",
  drsOn: "/audio/beep.mp3",
  drsOff: "/audio/beep.mp3",
  overtakeOn: "/audio/overtake-on.mp3",
};

/**
 * Create a single Audio element configured for instant playback.
 */
const createAudio = (src) => {
  const audio = new window.Audio(src);
  audio.preload = "auto";
  return audio;
};

export default {
  /**
   * Pre-loads all audio files into Audio objects.
   * Idempotent: keys already registered are left untouched, and names sharing
   * the same file path reuse a single element (playSound() rewinds to 0
   * before replaying, so sharing is safe). This is crucial for instant
   * playback without network delay.
   */
  loadSounds() {
    if (typeof window === "undefined" || typeof window.Audio === "undefined") {
      console.warn("Audio API not available; skipping sound preload.");
      return;
    }

    const srcToAudio = {};
    for (const key in soundFiles) {
      if (sounds[key]) continue; // idempotent: key already registered

      const src = soundFiles[key];
      if (!srcToAudio[src]) {
        const audio = createAudio(src);
        // If the file fails to load (404, network error, etc.), log it but
        // keep the app working — play() rejects and is caught instead.
        audio.addEventListener("error", () => {
          console.warn(`Audio load failed: ${src}`);
        });
        srcToAudio[src] = audio;
      }
      sounds[key] = srcToAudio[src];
    }
  },

  /**
   * Play a sound by name. Playback is attempted directly (buffering from the
   * network if needed) and the promise resolves when the clip ends — or as
   * soon as playback fails for any reason (autoplay policy, missing media,
   * mid-play error), so callers never need to catch audio errors.
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

    const audio = sounds[name];

    return new Promise((resolve) => {
      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        resolve();
      };

      const onEnded = () => cleanup();
      // A media error can leave play()'s promise pending forever; resolve
      // the caller's promise on the element error instead of hanging.
      const onError = () => cleanup();

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      audio.currentTime = 0;

      audio.play().catch(() => {
        // Play can still fail at runtime (e.g. browser autoplay policy).
        // Log a warning but resolve so voice interactions stay smooth.
        console.warn(
          `Audio play failed: "${name}" — browser may have blocked playback`,
        );
        cleanup();
      });
    });
  },
};