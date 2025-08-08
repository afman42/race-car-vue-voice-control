// src/services/textToSpeechService.js

const synth = window.speechSynthesis;

let voices = [];

function populateVoiceList() {
  if (typeof synth === "undefined") {
    return;
  }
  voices = synth.getVoices();
}

populateVoiceList();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoiceList;
}

export default {
  speak(textToSpeak) {
    if (synth.speaking) {
      console.error("SpeechSynthesis.speaking");
      return;
    }
    if (textToSpeak === "") {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    utterance.onerror = (event) => {
      console.error("SpeechSynthesisUtterance.onerror", event);
    };

    // Optional: Configure the voice
    // You can find a "Google UK English Male" or similar voice for a co-pilot feel
    const desiredVoice =
      voices.find((voice) => voice.name.includes("Google UK English Male")) ||
      voices[0];
    utterance.voice = desiredVoice;
    utterance.pitch = 1; // 0 to 2
    utterance.rate = 1.1; // 0.1 to 10

    synth.speak(utterance);
  },
};
