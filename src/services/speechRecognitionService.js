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
// Fatal errors that mean restarting would loop forever (mic denied, etc.).
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);
let lastError = null;

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
    lastError = null;

    recognitionInstance.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim().toLowerCase();
      onResultCallback(transcript);
    };

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      lastError = event.error;
      if (onErrorCallback) {
        onErrorCallback(event.error);
      }
    };

    // Fired when the service stops for any reason.
    recognitionInstance.onend = () => {
      // If it wasn't stopped by the user, restart it automatically — unless
      // the last error was fatal (mic denied, no audio capture). Restarting
      // after those would loop forever spamming recognition.start().
      if (!isManuallyStopped && !FATAL_ERRORS.has(lastError)) {
        console.log("Recognition service ended, restarting...");
        setTimeout(() => recognitionInstance.start(), 100);
      } else {
        console.log("Recognition service stopped (manual or fatal error).");
      }
      // Clear the error so a subsequent manual start isn't blocked by it.
      lastError = null;
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
