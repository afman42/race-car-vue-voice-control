// src/services/audioService.js

// This object will hold our pre-loaded audio elements
const sounds = {};

// A map of sound names to their file paths
const soundFiles = {
  engineStart: '/audio/engine-start.mp3',
  engineStop: '/audio/engine-stop.mp3',
  drsOn: '/audio/beep.mp3',
  drsOff: '/audio/beep.mp3',
};

export default {
  /**
   * Pre-loads all audio files into Audio objects.
   * This is crucial for instant playback without network delay.
   */
  loadSounds() {
    console.log('Loading sounds...');
    for (const key in soundFiles) {
      const audio = new Audio(soundFiles[key]);
      audio.preload = 'auto';
      sounds[key] = audio;
    }
  },

  /**
   * Plays a pre-loaded sound.
   * @param {string} name - The name of the sound to play (e.g., 'engineStart').
   */
  playSound(name) {
    if (sounds[name]) {
      // Rewind to the start in case it's played again quickly
      sounds[name].currentTime = 0;
      sounds[name].play().catch(error => {
        console.error(`Could not play sound: ${name}`, error);
      });
    } else {
      console.warn(`Sound not found: ${name}`);
    }
  },
};
