// src/services/speechRecognitionService.js

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

// This flag will help us determine if the user stopped it intentionally
let isManuallyStopped = false;

// Recognition settings
recognition.continuous = true;
recognition.lang = "en-US";
recognition.interimResults = false;

export default {
  startListening(onResultCallback, onErrorCallback) {
    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      onErrorCallback(new Error("Speech recognition not supported."));
      return;
    }

    // Set our flag to false when starting
    isManuallyStopped = false;

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim().toLowerCase();
      onResultCallback(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (onErrorCallback) {
        onErrorCallback(event.error);
      }
    };

    // *** THE KEY CHANGE IS HERE ***
    // Fired when the service stops for any reason.
    recognition.onend = () => {
      // If it wasn't stopped by the user, restart it automatically.
      if (!isManuallyStopped) {
        console.log("Recognition service ended, restarting...");
        // We add a tiny delay to avoid overwhelming the browser
        setTimeout(() => recognition.start(), 100);
      } else {
        console.log("Recognition service stopped by user.");
      }
    };

    try {
      recognition.start();
      console.log("Speech recognition service started.");
    } catch (e) {
      console.error("Could not start recognition", e);
      onErrorCallback(e);
    }
  },

  stopListening() {
    // Set our flag to true when the user clicks the stop button
    isManuallyStopped = true;
    recognition.stop();
  },
};
