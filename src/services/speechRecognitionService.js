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
let restartTimeout = null;
let retryDelayMs = 100;
const RETRY_MAX_MS = 1000;
const CONFIDENCE_THRESHOLD = 0.5;

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
    retryDelayMs = 100;
    clearTimeout(restartTimeout);

    recognitionInstance.onresult = (event) => {
      // Iterate from resultIndex, pick the last final result above the
      // confidence threshold so low-confidence utterances don't feed the
      // fuzzy matcher and produce false-positive commands.
      let transcript = "";
      let bestConfidence = -1;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res.isFinal) continue;
        const conf = res[0].confidence ?? 1;
        if (conf >= CONFIDENCE_THRESHOLD && conf > bestConfidence) {
          transcript = res[0].transcript.trim().toLowerCase();
          bestConfidence = conf;
        }
      }
      // Fallback: if nothing cleared the threshold, use the last final.
      if (!transcript) {
        for (let i = event.results.length - 1; i >= event.resultIndex; i--) {
          if (event.results[i].isFinal) {
            transcript = event.results[i][0].transcript.trim().toLowerCase();
            break;
          }
        }
      }
      if (transcript) onResultCallback(transcript);
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
      if (!isManuallyStopped && !FATAL_ERRORS.has(lastError)) {
        console.log("Recognition service ended, restarting...");
        const delay = retryDelayMs;
        retryDelayMs = Math.min(RETRY_MAX_MS, retryDelayMs * 2);
        restartTimeout = setTimeout(() => {
          restartTimeout = null;
          if (isManuallyStopped || FATAL_ERRORS.has(lastError)) return;
          try {
            recognitionInstance.start();
          } catch (e) {
            console.error("Auto-restart start() failed", e);
          }
        }, delay);
      } else {
        console.log("Recognition service stopped (manual or fatal error).");
        retryDelayMs = 100;
      }
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
    clearTimeout(restartTimeout);
    if (recognition) {
      recognition.stop();
    }
  },

  /**
   * Reset the manually-stopped flag so auto-restart can resume.
   * Used after a transient stop (e.g. pausing during command processing).
   */
  resetManualStop() {
    isManuallyStopped = false;
  },

  /**
   * Whether listening was last stopped by the user (vs. still active).
   * @returns {boolean}
   */
  isManuallyStopped() {
    return isManuallyStopped;
  },
};
