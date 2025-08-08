// src/services/speechRecognitionService.js

// Handle browser prefixes
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

// Recognition settings
recognition.continuous = true; // Keep listening even after a result
recognition.lang = 'en-US';    // Set language
recognition.interimResults = false; // We only want final results

export default {
  startListening(onResultCallback, onErrorCallback) {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      onErrorCallback(new Error("Speech recognition not supported in this browser."));
      return;
    }

    // Fired when speech is recognized
    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim().toLowerCase();
      console.log('Transcript:', transcript);
      onResultCallback(transcript);
    };

    // Fired on error
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (onErrorCallback) {
        onErrorCallback(event.error);
      }
    };
    
    // Fired when listening ends
    recognition.onend = () => {
        console.log('Speech recognition service stopped.');
    };

    try {
        recognition.start();
        console.log('Speech recognition service started.');
    } catch(e) {
        console.error("Could not start recognition", e);
        onErrorCallback(e);
    }
  },

  stopListening() {
    recognition.stop();
  },
};
