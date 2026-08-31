// src/services/textToSpeechService.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// vitest.setup.js mocks this module globally, so every test pulls in the real
// implementation with vi.importActual and a stub speechSynthesis installed.

const makeVoice = (lang, name = lang) => ({ lang, name });

const createSynth = ({ voices = [], speaking = false, pending = false } = {}) => {
  const synth = {
    speaking,
    pending,
    onvoiceschanged: null,
    spoken: [],
    getVoices: vi.fn(() => voices),
    cancel: vi.fn(() => {
      synth.speaking = false;
      synth.pending = false;
    }),
    speak: vi.fn((utterance) => {
      synth.spoken.push(utterance);
    }),
    setVoices(next) {
      voices = next;
    },
  };
  return synth;
};

// jsdom has no SpeechSynthesisUtterance; the service constructs it directly.
const installUtterance = () => {
  const created = [];
  window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
    created.push(this);
  };
  globalThis.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
  return created;
};

const loadService = async () => {
  vi.resetModules();
  const mod = await vi.importActual("@/services/textToSpeechService");
  return mod.default;
};

let warnSpy;
let utterances;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  utterances = installUtterance();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
  delete globalThis.SpeechSynthesisUtterance;
});

describe("textToSpeechService.speak - availability", () => {
  it("warns and resolves when SpeechSynthesis is unavailable", async () => {
    const service = await loadService();

    await expect(service.speak("box box")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "SpeechSynthesis API not available; skipping speech.",
    );
  });

  it("resolves without speaking for empty text", async () => {
    const synth = createSynth();
    window.speechSynthesis = synth;

    const service = await loadService();
    await expect(service.speak("")).resolves.toBeUndefined();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("resolves without speaking for undefined text", async () => {
    const synth = createSynth();
    window.speechSynthesis = synth;

    const service = await loadService();
    await expect(service.speak()).resolves.toBeUndefined();
    expect(synth.speak).not.toHaveBeenCalled();
  });
});

describe("textToSpeechService.speak - utterance setup", () => {
  it("speaks the text and resolves on the end event", async () => {
    const synth = createSynth();
    window.speechSynthesis = synth;

    const service = await loadService();
    const promise = service.speak("engine started");

    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = utterances[0];
    expect(utterance.text).toBe("engine started");
    expect(utterance.lang).toBe("en-US");
    expect(utterance.pitch).toBe(1);
    expect(utterance.rate).toBe(1.1);

    utterance.onend();
    await expect(promise).resolves.toBeUndefined();
  });

  it("warns and resolves on an utterance error", async () => {
    const synth = createSynth();
    window.speechSynthesis = synth;

    const service = await loadService();
    const promise = service.speak("box box");
    utterances[0].onerror({ error: "synthesis-failed" });

    await expect(promise).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "SpeechSynthesisUtterance.onerror",
      expect.objectContaining({ error: "synthesis-failed" }),
    );
  });

  it("leaves the voice unset when none are available", async () => {
    const synth = createSynth({ voices: [] });
    window.speechSynthesis = synth;

    const service = await loadService();
    const promise = service.speak("hello");
    expect(utterances[0].voice).toBeUndefined();
    utterances[0].onend();
    await promise;
  });
});

describe("textToSpeechService voice selection", () => {
  const speakWith = async (voices, lang) => {
    const synth = createSynth({ voices });
    window.speechSynthesis = synth;
    const service = await loadService();
    if (lang) service.setLanguage(lang);
    const promise = service.speak("radio check");
    const utterance = utterances[0];
    utterance.onend();
    await promise;
    return utterance;
  };

  it("prefers an exact BCP-47 match", async () => {
    const utterance = await speakWith(
      [makeVoice("en-GB"), makeVoice("id-ID"), makeVoice("en-US")],
      "en-US",
    );
    expect(utterance.voice.lang).toBe("en-US");
  });

  it("matches case-insensitively", async () => {
    const utterance = await speakWith([makeVoice("EN-us")], "en-US");
    expect(utterance.voice.lang).toBe("EN-us");
  });

  it("falls back to a same-language voice from another region", async () => {
    const utterance = await speakWith(
      [makeVoice("fr-FR"), makeVoice("en-AU")],
      "en-US",
    );
    expect(utterance.voice.lang).toBe("en-AU");
  });

  it("falls back to the first voice when the language is unavailable", async () => {
    const utterance = await speakWith(
      [makeVoice("fr-FR"), makeVoice("de-DE")],
      "en-US",
    );
    expect(utterance.voice.lang).toBe("fr-FR");
  });

  it("skips voices with no lang field", async () => {
    const utterance = await speakWith(
      [{ name: "Broken" }, makeVoice("en-US")],
      "en-US",
    );
    expect(utterance.voice.lang).toBe("en-US");
  });

  it("honours a language switch to Indonesian", async () => {
    const utterance = await speakWith(
      [makeVoice("en-US"), makeVoice("id-ID")],
      "id-ID",
    );
    expect(utterance.voice.lang).toBe("id-ID");
    expect(utterance.lang).toBe("id-ID");
  });

  it("ignores an empty setLanguage call", async () => {
    const synth = createSynth({ voices: [makeVoice("en-US")] });
    window.speechSynthesis = synth;

    const service = await loadService();
    service.setLanguage("");
    const promise = service.speak("hello");
    expect(utterances[0].lang).toBe("en-US");
    utterances[0].onend();
    await promise;
  });

  it("refreshes the voice cache on the voiceschanged event", async () => {
    const synth = createSynth({ voices: [] });
    window.speechSynthesis = synth;

    const service = await loadService();
    expect(typeof synth.onvoiceschanged).toBe("function");

    synth.getVoices.mockReturnValue([makeVoice("id-ID"), makeVoice("en-US")]);
    synth.onvoiceschanged();

    const promise = service.speak("radio check");
    expect(utterances[0].voice.lang).toBe("en-US");
    utterances[0].onend();
    await promise;
  });
});

describe("textToSpeechService queue handling", () => {
  it("cancels and defers one tick when already speaking", async () => {
    vi.useFakeTimers();
    const synth = createSynth({ speaking: true });
    window.speechSynthesis = synth;

    const service = await loadService();
    const promise = service.speak("interrupt me");

    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);

    utterances[0].onend();
    await expect(promise).resolves.toBeUndefined();
  });

  it("cancels and defers when an utterance is pending", async () => {
    vi.useFakeTimers();
    const synth = createSynth({ pending: true });
    window.speechSynthesis = synth;

    const service = await loadService();
    const promise = service.speak("queued");

    expect(synth.cancel).toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);

    utterances[0].onend();
    await promise;
  });

  it("speaks synchronously when the engine is idle", async () => {
    const synth = createSynth();
    window.speechSynthesis = synth;

    const service = await loadService();
    const promise = service.speak("all clear");

    expect(synth.cancel).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);

    utterances[0].onend();
    await promise;
  });
});

describe("textToSpeechService.dispose", () => {
  it("is safe when SpeechSynthesis is unavailable", async () => {
    const service = await loadService();
    expect(() => service.dispose()).not.toThrow();
  });

  it("detaches the voiceschanged handler", async () => {
    const synth = createSynth({ voices: [makeVoice("en-US")] });
    window.speechSynthesis = synth;

    const service = await loadService();
    service.dispose();

    expect(synth.onvoiceschanged).toBeNull();
  });

  it("still speaks after dispose by re-reading getVoices()", async () => {
    const synth = createSynth({ voices: [makeVoice("en-US")] });
    window.speechSynthesis = synth;

    const service = await loadService();
    service.dispose();

    const promise = service.speak("still here");
    expect(utterances[0].voice.lang).toBe("en-US");
    utterances[0].onend();
    await expect(promise).resolves.toBeUndefined();
  });
});
