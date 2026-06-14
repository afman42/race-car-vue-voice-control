// src/services/textToSpeechService.js

const synth =
  typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
    ? window.speechSynthesis
    : null;

export default {
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
        console.error('SpeechSynthesisUtterance.onerror', event);
        reject(event); // Reject on error
      };
      
      // Optional voice configuration
      const desiredVoice = synth.getVoices().find(voice => voice.name.includes('Google UK English Male')) || synth.getVoices()[0];
      utterance.voice = desiredVoice;
      utterance.pitch = 1;
      utterance.rate = 1.1;

      synth.speak(utterance);
    });
  },
};
