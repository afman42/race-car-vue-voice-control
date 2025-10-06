// src/services/audioService.js

// This object will hold our pre-loaded audio elements
const sounds = {};

// A map of sound names to their file paths
const soundFiles = {
  engineStart: "/audio/engine-start.mp3",
  engineStop: "/audio/engine-stop.mp3",
  drsOn: "/audio/beep.mp3",
  drsOff: "/audio/beep.mp3",
  radioBeep: "/audio/radio-beep.mp3", // ADD THIS
  overtakeOn: "/audio/overtake-on.mp3", // ADD THIS
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

    console.log("Loading sounds...");
    for (const key in soundFiles) {
      const audio = new window.Audio(soundFiles[key]);
      audio.preload = "auto";
      sounds[key] = audio;
    }
  },

  /**
   * PLAYS A SOUND AND RETURNS A PROMISE THAT RESOLVES WHEN IT'S FINISHED.
   * @param {string} name - The name of the sound to play.
   * @returns {Promise<void>}
   */
  playSound(name) {
    if (typeof window === "undefined" || typeof window.Audio === "undefined") {
      return Promise.resolve();
    }
    // Wrap the entire logic in a new Promise
    return new Promise((resolve, reject) => {
      if (sounds[name]) {
        const audio = sounds[name];

        // Function to handle cleanup and resolve the promise
        const onEnded = () => {
          audio.removeEventListener("ended", onEnded); // Clean up the listener
          resolve();
        };

        audio.addEventListener("ended", onEnded);

        audio.currentTime = 0;
        audio.play().catch((error) => {
          console.error(`Could not play sound: ${name}`, error);
          audio.removeEventListener("ended", onEnded); // Clean up on error too
          reject(error);
        });
      } else {
        const warning = `Sound not found: ${name}`;
        console.warn(warning);
        reject(new Error(warning)); // Reject the promise if sound is not found
      }
    });
  },
};
