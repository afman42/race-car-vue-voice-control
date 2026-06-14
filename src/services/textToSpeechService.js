// src/services/textToSpeechService.js

const synth =
  typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
    ? window.speechSynthesis
    : null;

// BCP-47 language tag used to pick a matching voice (e.g. "en-US", "id-ID").
let currentLang = "en-US";

/**
 * Pick the best available voice for the current language.
 * Prefers an exact lang match, then a same-language match, then default.
 */
const pickVoice = () => {
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices || voices.length === 0) return null;

  const short = currentLang.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase() === currentLang.toLowerCase()) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(short)) ||
    voices[0]
  );
};

export default {
  /**
   * Set the spoken language (BCP-47 tag). Affects voice selection.
   * @param {string} lang
   */
  setLanguage(lang) {
    if (lang) currentLang = lang;
  },

  speak(textToSpeak) {
    return new Promise((resolve, reject) => {
      if (!synth) {
        console.warn("SpeechSynthesis API not available; skipping speech.");
        resolve();
        return;
      }
      if (!textToSpeak) {
        resolve();
        return;
      }

      // If something is already being spoken, cancel it so the newest
      // message is heard rather than silently dropped.
      if (synth.speaking || synth.pending) {
        synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      utterance.onend = () => {
        resolve(); // Resolve the promise when speaking is finished
      };

      utterance.onerror = (event) => {
        console.error("SpeechSynthesisUtterance.onerror", event);
        reject(event); // Reject on error
      };

      // Pick a voice matching the active language; set the lang regardless so
      // the engine can fall back sensibly when no exact voice is installed.
      const desiredVoice = pickVoice();
      if (desiredVoice) utterance.voice = desiredVoice;
      utterance.lang = currentLang;
      utterance.pitch = 1;
      utterance.rate = 1.1;

      synth.speak(utterance);
    });
  },
};
