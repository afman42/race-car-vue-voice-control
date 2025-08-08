// src/services/textToSpeechService.js

const synth = window.speechSynthesis;

export default {
  speak(textToSpeak) {
    return new Promise((resolve, reject) => {
      if (synth.speaking) {
        // Don't interrupt, just resolve immediately or reject.
        // For this app, we can just let it finish.
        console.warn('SpeechSynthesis is already speaking.');
        resolve(); 
        return;
      }
      if (!textToSpeak) {
        resolve();
        return;
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
