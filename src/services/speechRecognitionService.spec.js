// src/services/speechRecognitionService.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The service caches a single recognition instance in module state, so each
// test re-imports it fresh with a stub SpeechRecognition constructor installed.

const makeResults = (entries, resultIndex = 0) => {
  const results = entries.map(({ transcript, confidence, isFinal = true }) => {
    const alternative = { transcript, confidence };
    return { 0: alternative, isFinal, length: 1 };
  });
  results.length = entries.length;
  return { resultIndex, results };
};

const createRecognitionClass = (opts = {}) => {
  const instances = [];
  function FakeRecognition() {
    this.continuous = false;
    this.interimResults = true;
    this.lang = "";
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.startCalls = 0;
    this.stopCalls = 0;
    this.start = vi.fn(() => {
      this.startCalls += 1;
      if (opts.startThrows && this.startCalls <= (opts.startThrowsTimes ?? 1)) {
        throw new Error("start failed");
      }
    });
    this.stop = vi.fn(() => {
      this.stopCalls += 1;
    });
    instances.push(this);
  }
  FakeRecognition.instances = instances;
  return FakeRecognition;
};

const loadService = async () => {
  vi.resetModules();
  const mod = await vi.importActual("@/services/speechRecognitionService");
  return mod.default;
};

let logSpy;
let errorSpy;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe("speechRecognitionService.startListening - availability", () => {
  it("reports not-supported and returns false when no constructor exists", async () => {
    const service = await loadService();
    const onError = vi.fn();

    expect(service.startListening(vi.fn(), onError)).toBe(false);
    expect(onError).toHaveBeenCalledWith("not-supported");
  });

  it("returns false without an error callback when unsupported", async () => {
    const service = await loadService();
    expect(service.startListening(vi.fn())).toBe(false);
  });

  it("uses the webkit-prefixed constructor as a fallback", async () => {
    const Fake = createRecognitionClass();
    window.webkitSpeechRecognition = Fake;

    const service = await loadService();
    expect(service.startListening(vi.fn(), vi.fn())).toBe(true);
    expect(Fake.instances).toHaveLength(1);
  });

  it("configures continuous, non-interim recognition on first use", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());

    const instance = Fake.instances[0];
    expect(instance.continuous).toBe(true);
    expect(instance.interimResults).toBe(false);
    expect(instance.lang).toBe("en-US");
  });

  it("reuses the same recognition instance across calls", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    service.stopListening();
    service.startListening(vi.fn(), vi.fn());

    expect(Fake.instances).toHaveLength(1);
  });

  it("reports not-supported when the constructor itself throws", async () => {
    window.SpeechRecognition = function Broken() {
      throw new Error("no mic subsystem");
    };

    const service = await loadService();
    const onError = vi.fn();
    expect(service.startListening(vi.fn(), onError)).toBe(false);
    expect(onError).toHaveBeenCalledWith("not-supported");
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to initialise speech recognition",
      expect.any(Error),
    );
  });

  it("returns false and forwards the error when start() throws", async () => {
    const Fake = createRecognitionClass({ startThrows: true });
    window.SpeechRecognition = Fake;

    const service = await loadService();
    const onError = vi.fn();
    expect(service.startListening(vi.fn(), onError)).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("speechRecognitionService.setLanguage", () => {
  it("ignores an empty language", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    service.setLanguage("");

    expect(Fake.instances[0].lang).toBe("en-US");
  });

  it("applies the language to a live recognition instance", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    service.setLanguage("id-ID");

    expect(Fake.instances[0].lang).toBe("id-ID");
  });

  it("applies a language set before the first start", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.setLanguage("id-ID");
    service.startListening(vi.fn(), vi.fn());

    expect(Fake.instances[0].lang).toBe("id-ID");
  });

  it("options.lang overrides the stored language for the session", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn(), { lang: "id-ID" });

    expect(Fake.instances[0].lang).toBe("id-ID");
  });
});

describe("speechRecognitionService onresult transcript selection", () => {
  const startWith = async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;
    const service = await loadService();
    const onResult = vi.fn();
    service.startListening(onResult, vi.fn());
    return { service, instance: Fake.instances[0], onResult };
  };

  it("emits a confident final transcript trimmed and lowercased", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(
      makeResults([{ transcript: "  Start Engine  ", confidence: 0.9 }]),
    );

    expect(onResult).toHaveBeenCalledWith("start engine");
  });

  it("treats a missing confidence value as fully confident", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(
      makeResults([{ transcript: "pit stop", confidence: undefined }]),
    );

    expect(onResult).toHaveBeenCalledWith("pit stop");
  });

  it("picks the highest-confidence final result above the threshold", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(
      makeResults([
        { transcript: "drs on", confidence: 0.6 },
        { transcript: "overtake", confidence: 0.95 },
      ]),
    );

    expect(onResult).toHaveBeenCalledWith("overtake");
  });

  it("skips interim results entirely", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(
      makeResults([
        { transcript: "interim guess", confidence: 0.99, isFinal: false },
      ]),
    );

    expect(onResult).not.toHaveBeenCalled();
  });

  it("falls back to the last final result when none clears the threshold", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(
      makeResults([
        { transcript: "First Mumble", confidence: 0.2 },
        { transcript: "Second Mumble", confidence: 0.1 },
      ]),
    );

    expect(onResult).toHaveBeenCalledWith("second mumble");
  });

  it("ignores results before resultIndex", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(
      makeResults(
        [
          { transcript: "stale", confidence: 0.99 },
          { transcript: "fresh", confidence: 0.99 },
        ],
        1,
      ),
    );

    expect(onResult).toHaveBeenCalledWith("fresh");
  });

  it("emits nothing when the transcript is blank", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(makeResults([{ transcript: "   ", confidence: 0.99 }]));

    expect(onResult).not.toHaveBeenCalled();
  });

  it("emits nothing when there are no results at all", async () => {
    const { instance, onResult } = await startWith();

    instance.onresult(makeResults([]));

    expect(onResult).not.toHaveBeenCalled();
  });
});

describe("speechRecognitionService onerror", () => {
  it("forwards the error code to the callback", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    const onError = vi.fn();
    service.startListening(vi.fn(), onError);

    Fake.instances[0].onerror({ error: "no-speech" });

    expect(onError).toHaveBeenCalledWith("no-speech");
    expect(errorSpy).toHaveBeenCalledWith(
      "Speech recognition error:",
      "no-speech",
    );
  });

  it("does not throw when no error callback was supplied", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn());

    expect(() => Fake.instances[0].onerror({ error: "network" })).not.toThrow();
  });
});

describe("speechRecognitionService auto-restart on end", () => {
  it("restarts after a backoff delay when the service ends on its own", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];
    expect(instance.startCalls).toBe(1);

    instance.onend();
    expect(instance.startCalls).toBe(1); // deferred, not immediate
    vi.advanceTimersByTime(100);
    expect(instance.startCalls).toBe(2);
  });

  it("doubles the retry delay on repeated ends and caps it", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];

    instance.onend();
    vi.advanceTimersByTime(100);
    expect(instance.startCalls).toBe(2);

    // Second end waits 200ms, not 100ms.
    instance.onend();
    vi.advanceTimersByTime(100);
    expect(instance.startCalls).toBe(2);
    vi.advanceTimersByTime(100);
    expect(instance.startCalls).toBe(3);
  });

  it("does not restart after a manual stop", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];

    service.stopListening();
    instance.onend();
    vi.advanceTimersByTime(2000);

    expect(instance.startCalls).toBe(1);
  });

  it.each(["not-allowed", "service-not-allowed", "audio-capture"])(
    "does not restart after the fatal error %s",
    async (fatalError) => {
      vi.useFakeTimers();
      const Fake = createRecognitionClass();
      window.SpeechRecognition = Fake;

      const service = await loadService();
      service.startListening(vi.fn(), vi.fn());
      const instance = Fake.instances[0];

      instance.onerror({ error: fatalError });
      instance.onend();
      vi.advanceTimersByTime(2000);

      expect(instance.startCalls).toBe(1);
    },
  );

  it("still restarts after a transient error", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];

    instance.onerror({ error: "no-speech" });
    instance.onend();
    vi.advanceTimersByTime(100);

    expect(instance.startCalls).toBe(2);
  });

  it("cancels a pending restart when the user stops inside the window", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];

    instance.onend();
    service.stopListening();
    vi.advanceTimersByTime(2000);

    expect(instance.startCalls).toBe(1);
  });

  it("logs instead of throwing when the auto-restart start() fails", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];
    instance.start.mockImplementation(() => {
      throw new Error("restart refused");
    });

    instance.onend();
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      "Auto-restart start() failed",
      expect.any(Error),
    );
  });

  it("resets the backoff when startListening is called again", async () => {
    vi.useFakeTimers();
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    const instance = Fake.instances[0];

    instance.onend();
    vi.advanceTimersByTime(100); // start #2, delay now 200
    service.startListening(vi.fn(), vi.fn()); // start #3, delay back to 100

    instance.onend();
    vi.advanceTimersByTime(100);
    expect(instance.startCalls).toBe(4);
  });
});

describe("speechRecognitionService stop flag", () => {
  it("reports not manually stopped before any stop", async () => {
    const service = await loadService();
    expect(service.isManuallyStopped()).toBe(false);
  });

  it("stopListening is safe with no recognition instance", async () => {
    const service = await loadService();
    expect(() => service.stopListening()).not.toThrow();
    expect(service.isManuallyStopped()).toBe(true);
  });

  it("stopListening stops the live instance and sets the flag", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    service.stopListening();

    expect(Fake.instances[0].stop).toHaveBeenCalled();
    expect(service.isManuallyStopped()).toBe(true);
  });

  it("resetManualStop clears the flag so auto-restart can resume", async () => {
    const service = await loadService();
    service.stopListening();
    service.resetManualStop();
    expect(service.isManuallyStopped()).toBe(false);
  });

  it("startListening clears a previous manual stop", async () => {
    const Fake = createRecognitionClass();
    window.SpeechRecognition = Fake;

    const service = await loadService();
    service.startListening(vi.fn(), vi.fn());
    service.stopListening();
    service.startListening(vi.fn(), vi.fn());

    expect(service.isManuallyStopped()).toBe(false);
  });
});
