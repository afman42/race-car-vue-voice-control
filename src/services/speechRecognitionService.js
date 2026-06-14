// src/services/speechRecognitionService.js

const getRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition;
};

let recognition;
let isManuallyStopped = false;
let currentLang = "en-US";

const ensureRecognition = () => {
  if (recognition) {
    return recognition;
  }

  const SpeechRecognitionConstructor = getRecognitionConstructor();

  if (!SpeechRecognitionConstructor) {
    return null;
  }

  try {
    recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.lang = currentLang;
    recognition.interimResults = false;
  } catch (error) {
    console.error("Failed to initialise speech recognition", error);
    recognition = null;
  }

  return recognition;
};

export default {
  /**
   * Set the recognition language (BCP-47 tag, e.g. "en-US" or "id-ID").
   * @param {string} lang
   */
  setLanguage(lang) {
    if (!lang) return;
    currentLang = lang;
    if (recognition) {
      recognition.lang = lang;
    }
  },

  startListening(onResultCallback, onErrorCallback, options = {}) {
    const recognitionInstance = ensureRecognition();

    if (!recognitionInstance) {
      if (onErrorCallback) {
        onErrorCallback("not-supported");
      }
      return false;
    }

    // Apply the requested language for this session, if provided.
    if (options.lang) {
      currentLang = options.lang;
    }
    recognitionInstance.lang = currentLang;

    // Set our flag to false when starting
    isManuallyStopped = false;

    recognitionInstance.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim().toLowerCase();
      onResultCallback(transcript);
    };

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (onErrorCallback) {
        onErrorCallback(event.error);
      }
    };

    // *** THE KEY CHANGE IS HERE ***
    // Fired when the service stops for any reason.
    recognitionInstance.onend = () => {
      // If it wasn't stopped by the user, restart it automatically.
      if (!isManuallyStopped) {
        console.log("Recognition service ended, restarting...");
        // We add a tiny delay to avoid overwhelming the browser
        setTimeout(() => recognitionInstance.start(), 100);
      } else {
        console.log("Recognition service stopped by user.");
      }
    };

    try {
      recognitionInstance.start();
      console.log("Speech recognition service started.");
      return true;
    } catch (e) {
      console.error("Could not start recognition", e);
      if (onErrorCallback) {
        onErrorCallback(e);
      }
      return false;
    }
  },

  stopListening() {
    // Set our flag to true when the user clicks the stop button
    isManuallyStopped = true;
    if (recognition) {
      recognition.stop();
    }
  },

  /**
   * Whether listening was last stopped by the user (vs. still active).
   * @returns {boolean}
   */
  isManuallyStopped() {
    return isManuallyStopped;
  },
};
