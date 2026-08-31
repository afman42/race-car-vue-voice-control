// src/composables/useRaceControl.spec.js
//
// Covers the UI orchestration paths that RaceControl.spec.js does not reach:
// speech-error mapping, relisten scheduling, the overtake countdown timer,
// gear flash, locale switching and the segment/position display.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { useRaceControl } from "./useRaceControl";
import { useCar } from "./useCar";
import speechService from "@/services/speechRecognitionService";
import ttsService from "@/services/textToSpeechService";
import { CAR_SETTINGS } from "@/config";
import { setLocale } from "@/i18n";

// audioService and textToSpeechService are mocked globally in vitest.setup.js.

let capturedOnResult = null;
let capturedOnError = null;

vi.mock("@/services/speechRecognitionService", () => ({
  default: {
    startListening: vi.fn((onResult, onError) => {
      capturedOnResult = onResult;
      capturedOnError = onError;
      return true;
    }),
    stopListening: vi.fn(),
    resetManualStop: vi.fn(),
    setLanguage: vi.fn(),
    isManuallyStopped: vi.fn(() => false),
  },
}));

// useRaceControl registers onUnmounted, so it has to run inside a component.
const mountControl = () => {
  let api;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useRaceControl();
        return () => null;
      },
    }),
  );
  return { api, wrapper };
};

const flush = async () => {
  await Promise.resolve();
  await nextTick();
};

beforeEach(async () => {
  const { resetRace, disableAi, aiEnabled } = useCar();
  await resetRace();
  if (aiEnabled.value) await disableAi();
  setLocale("en");
  vi.clearAllMocks();
  capturedOnResult = null;
  capturedOnError = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRaceControl - listening toggle", () => {
  it("starts listening with the active speech language", () => {
    const { api, wrapper } = mountControl();

    api.toggleListening();

    expect(speechService.startListening).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { lang: "en-US" },
    );
    expect(api.isListening.value).toBe(true);
    expect(api.statusMessage.value).toContain("Listening");
    wrapper.unmount();
  });

  it("stays closed when the service refuses to start", () => {
    speechService.startListening.mockReturnValueOnce(false);
    const { api, wrapper } = mountControl();

    api.toggleListening();

    expect(api.isListening.value).toBe(false);
    wrapper.unmount();
  });

  it("stops listening on a second toggle", () => {
    const { api, wrapper } = mountControl();

    api.toggleListening();
    api.toggleListening();

    expect(speechService.stopListening).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("forceStart restarts even while already listening", () => {
    const { api, wrapper } = mountControl();

    api.toggleListening();
    speechService.startListening.mockClear();
    api.toggleListening(true);

    expect(speechService.startListening).toHaveBeenCalled();
    expect(api.isListening.value).toBe(true);
    wrapper.unmount();
  });

  it("pushes the language to both services when the locale changes", async () => {
    const { wrapper } = mountControl();
    expect(speechService.setLanguage).toHaveBeenCalledWith("en-US");

    setLocale("id");
    await nextTick();

    expect(speechService.setLanguage).toHaveBeenCalledWith("id-ID");
    wrapper.unmount();
  });

  it("re-renders the idle prompt in the new locale when not listening", async () => {
    const { api, wrapper } = mountControl();
    expect(api.statusMessage.value).toBe("Open Radio Channel");

    setLocale("id");
    await nextTick();

    expect(api.statusMessage.value).toBe("Buka Saluran Radio");
    wrapper.unmount();
  });

  it("keeps the listening message when the locale changes mid-session", async () => {
    const { api, wrapper } = mountControl();
    api.toggleListening();
    const before = api.statusMessage.value;

    setLocale("id");
    await nextTick();

    expect(api.statusMessage.value).toBe(before);
    wrapper.unmount();
  });

  it("onLocaleChange applies the value from a select event", () => {
    const { api, wrapper } = mountControl();

    api.onLocaleChange({ target: { value: "id" } });

    expect(api.locale.value).toBe("id");
    wrapper.unmount();
  });
});

describe("useRaceControl - error mapping", () => {
  const errorCases = [
    ["no-speech", "Copy that, standing by."],
    ["network", "Network error with radio signal."],
    ["aborted", "Copy that, standing by."],
  ];

  it.each(errorCases)(
    "keeps the radio open on the transient error %s",
    (code, message) => {
      const { api, wrapper } = mountControl();
      api.toggleListening();

      capturedOnError(code);

      expect(api.statusMessage.value).toBe(message);
      expect(api.isListening.value).toBe(true);
      wrapper.unmount();
    },
  );

  const fatalCases = [
    ["not-allowed", "Error: Microphone access denied."],
    ["service-not-allowed", "Error: Microphone access denied."],
    ["audio-capture", "Error: No microphone found. Check your audio device."],
    ["not-supported", "Error: Speech recognition not supported."],
    ["something-else", "An unknown error occurred."],
  ];

  it.each(fatalCases)("closes the radio on %s", (code, message) => {
    const { api, wrapper } = mountControl();
    api.toggleListening();

    capturedOnError(code);

    expect(api.statusMessage.value).toBe(message);
    expect(api.isListening.value).toBe(false);
    wrapper.unmount();
  });

  it("reads the code off an error event object", () => {
    const { api, wrapper } = mountControl();
    api.toggleListening();

    capturedOnError({ error: "not-allowed" });

    expect(api.statusMessage.value).toBe("Error: Microphone access denied.");
    wrapper.unmount();
  });

  it("falls back to the message of a thrown Error", () => {
    const { api, wrapper } = mountControl();
    api.toggleListening();

    capturedOnError(new Error("not-allowed"));

    expect(api.statusMessage.value).toBe("Error: Microphone access denied.");
    wrapper.unmount();
  });

  it("treats a null error as unknown", () => {
    const { api, wrapper } = mountControl();
    api.toggleListening();

    capturedOnError(null);

    expect(api.statusMessage.value).toBe("An unknown error occurred.");
    wrapper.unmount();
  });
});

describe("useRaceControl - runCommand", () => {
  it("returns the not-recognized message for an empty command", async () => {
    const { api, wrapper } = mountControl();

    const message = await api.runCommand("");

    expect(message).toContain("not recognized");
    wrapper.unmount();
  });

  it("returns the not-recognized message for an unmapped command", async () => {
    const { api, wrapper } = mountControl();

    const message = await api.runCommand("teleport");

    expect(message).toContain("not recognized");
    wrapper.unmount();
  });

  it("runs a mapped action and publishes its message", async () => {
    const { api, wrapper } = mountControl();

    const message = await api.runCommand("startEngine");

    expect(message).toBe("Engine started.");
    expect(api.statusMessage.value).toBe("Engine started.");
    expect(api.engineStatus.value).toBe(true);
    wrapper.unmount();
  });

  it("reports a failure message when an action throws", async () => {
    const { api, wrapper } = mountControl();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Every announcement funnels through ttsService.speak; a rejection there
    // makes the underlying command action throw.
    ttsService.speak.mockRejectedValueOnce(new Error("synth offline"));

    const message = await api.runCommand("help");

    expect(message).toBe("Command failed, please try again.");
    expect(api.statusMessage.value).toBe("Command failed, please try again.");
    expect(warnSpy).toHaveBeenCalledWith(
      "Command action failed:",
      "help",
      expect.any(Error),
    );
    warnSpy.mockRestore();
    wrapper.unmount();
  });

  it("tracks the active AI command and clears it on reset", async () => {
    const { api, wrapper } = mountControl();

    await api.runCommand("aiMedium");
    expect(api.activeAiCommand.value).toBe("aiMedium");

    await api.runCommand("reset");
    expect(api.activeAiCommand.value).toBeNull();
    wrapper.unmount();
  });

  it("does not treat aiStatus or aiOff as a difficulty selection", async () => {
    const { api, wrapper } = mountControl();

    await api.runCommand("aiStatus");
    expect(api.activeAiCommand.value).toBeNull();

    await api.runCommand("aiOff");
    expect(api.activeAiCommand.value).toBeNull();
    wrapper.unmount();
  });
});

describe("useRaceControl - overtake countdown", () => {
  it("counts down from 100 while overtake is active", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { overtakeActive } = useCar();

    await api.runCommand("startEngine");
    await api.runCommand("overtake");
    expect(overtakeActive.value).toBe(true);
    expect(api.overtakeRemaining.value).toBe(100);

    vi.advanceTimersByTime(1000);
    expect(api.overtakeRemaining.value).toBeLessThan(100);
    expect(api.overtakeRemaining.value).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it("clears the countdown when the boost expires", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { overtakeActive, rpm } = useCar();

    await api.runCommand("startEngine");
    await api.runCommand("overtake");

    // Hold revs at idle: otherwise the simulation overheats and cuts overtake
    // long before its own expiry timeout fires.
    const ticks = CAR_SETTINGS.OVERTAKE_DURATION_MS / 100;
    for (let i = 0; i < ticks; i++) {
      rpm.value = CAR_SETTINGS.RPM_IDLE;
      vi.advanceTimersByTime(100);
    }

    // useCar clears the flag on its own expiry timeout; the countdown sees that
    // on the same tick and shuts its interval down near zero.
    expect(overtakeActive.value).toBe(false);
    const atExpiry = api.overtakeRemaining.value;
    expect(atExpiry).toBeGreaterThanOrEqual(0);
    expect(atExpiry).toBeLessThan(2);

    // Frozen afterwards: the interval is gone.
    vi.advanceTimersByTime(5000);
    expect(api.overtakeRemaining.value).toBe(atExpiry);
    wrapper.unmount();
  });

  it("halts the countdown as soon as overtake is no longer active", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { overtakeActive } = useCar();

    await api.runCommand("startEngine");
    await api.runCommand("overtake");

    overtakeActive.value = false;
    vi.advanceTimersByTime(100);
    const frozen = api.overtakeRemaining.value;

    vi.advanceTimersByTime(1000);
    expect(api.overtakeRemaining.value).toBe(frozen);
    wrapper.unmount();
  });

  it("restarts the countdown on a second successful overtake", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { overtakeActive, batteryLevel } = useCar();

    await api.runCommand("startEngine");
    await api.runCommand("overtake");
    vi.advanceTimersByTime(2000);
    expect(api.overtakeRemaining.value).toBeLessThan(100);

    // Re-arm: clear the flag and top up the battery so overtake succeeds again.
    overtakeActive.value = false;
    batteryLevel.value = 100;
    await api.runCommand("overtake");

    expect(api.overtakeRemaining.value).toBe(100);
    wrapper.unmount();
  });

  it("leaves the countdown untouched when overtake is refused", async () => {
    const { api, wrapper } = mountControl();

    // Engine off -> overtake is refused.
    const message = await api.runCommand("overtake");

    expect(message).toContain("engine is off");
    expect(api.overtakeRemaining.value).toBe(0);
    wrapper.unmount();
  });
});

describe("useRaceControl - relisten scheduling", () => {
  it("reopens the radio a beat after processing a command", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();

    api.toggleListening();
    speechService.startListening.mockClear();

    await capturedOnResult("start engine");
    await flush();
    expect(api.isListening.value).toBe(false);

    vi.advanceTimersByTime(500);
    expect(speechService.resetManualStop).toHaveBeenCalled();
    expect(speechService.startListening).toHaveBeenCalled();
    expect(api.isListening.value).toBe(true);
    wrapper.unmount();
  });

  it("records the transcript and reports unrecognized speech", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    api.toggleListening();

    await capturedOnResult("launch the rocket");
    await flush();

    expect(api.lastTranscript.value).toBe("launch the rocket");
    expect(api.statusMessage.value).toContain("launch the rocket");
    wrapper.unmount();
  });

  it("an explicit stop inside the window wins over the pending reopen", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();

    api.toggleListening();
    await capturedOnResult("start engine");
    await flush();

    // The user reopens manually, then stops before the timer fires.
    api.toggleListening(true);
    api.toggleListening();
    speechService.startListening.mockClear();

    vi.advanceTimersByTime(500);
    expect(speechService.startListening).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("skips the reopen when listening resumed in the meantime", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();

    api.toggleListening();
    await capturedOnResult("start engine");
    await flush();

    api.toggleListening(true); // already listening again
    speechService.startListening.mockClear();

    vi.advanceTimersByTime(500);
    expect(speechService.startListening).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("unmount cancels a pending reopen", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();

    api.toggleListening();
    await capturedOnResult("start engine");
    await flush();
    speechService.startListening.mockClear();

    wrapper.unmount();
    vi.advanceTimersByTime(2000);

    expect(speechService.startListening).not.toHaveBeenCalled();
  });

  it("unmount stops the recognition service", async () => {
    const { wrapper } = mountControl();
    wrapper.unmount();
    expect(speechService.stopListening).toHaveBeenCalled();
  });
});

describe("useRaceControl - gear flash", () => {
  it("flashes on an upshift and clears after the animation window", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { currentGear } = useCar();

    currentGear.value = 3;
    await nextTick();
    expect(api.gearFlash.value).toBe(true);

    vi.advanceTimersByTime(300);
    expect(api.gearFlash.value).toBe(false);
    wrapper.unmount();
  });

  it("does not flash when dropping to neutral", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { currentGear } = useCar();

    currentGear.value = 2;
    await nextTick();
    vi.advanceTimersByTime(300);

    currentGear.value = 0;
    await nextTick();
    expect(api.gearFlash.value).toBe(false);
    wrapper.unmount();
  });

  it("restarts the flash timer on a rapid second shift", async () => {
    vi.useFakeTimers();
    const { api, wrapper } = mountControl();
    const { currentGear } = useCar();

    currentGear.value = 2;
    await nextTick();
    vi.advanceTimersByTime(200);

    currentGear.value = 3;
    await nextTick();
    vi.advanceTimersByTime(200);
    // Still lit: the second shift reset the 300ms window.
    expect(api.gearFlash.value).toBe(true);

    vi.advanceTimersByTime(100);
    expect(api.gearFlash.value).toBe(false);
    wrapper.unmount();
  });
});

describe("useRaceControl - segment display", () => {
  const segmentAt = (progress) => {
    const { lapProgress } = useCar();
    lapProgress.value = progress;
  };

  it("labels the opening straight", () => {
    const { api, wrapper } = mountControl();
    segmentAt(0);
    expect(api.currentSegmentType.value).toBe("straight");
    expect(api.currentSegmentSpeed.value).toBeNull();
    expect(api.currentSegmentLabel.value).toBe("STRAIGHT");
    wrapper.unmount();
  });

  it.each([
    [160, "slow", "SLOW CORNER"],
    [280, "medium", "MED CORNER"],
    [430, "fast", "FAST CORNER"],
  ])("labels the corner at progress %i", (progress, speed, label) => {
    const { api, wrapper } = mountControl();
    segmentAt(progress);
    expect(api.currentSegmentType.value).toBe("corner");
    expect(api.currentSegmentSpeed.value).toBe(speed);
    expect(api.currentSegmentLabel.value).toBe(label);
    wrapper.unmount();
  });

  it("wraps progress beyond a full lap back onto the layout", () => {
    const { api, wrapper } = mountControl();
    segmentAt(CAR_SETTINGS.LAP_DISTANCE + 10);
    expect(api.currentSegmentType.value).toBe("straight");
    wrapper.unmount();
  });

  it("translates the segment label with the locale", () => {
    const { api, wrapper } = mountControl();
    segmentAt(160);
    setLocale("id");
    expect(api.currentSegmentLabel.value).toBe("TIKUNGAN LAMBAT");
    wrapper.unmount();
  });
});

describe("useRaceControl - position badge", () => {
  it("shows P1 and a solo gap with no rival", () => {
    const { api, wrapper } = mountControl();

    expect(api.positionLabel.value).toBe("P1");
    expect(api.gapText.value).toBe("Solo run");
    expect(api.trackAriaLabel.value).toBe("Track: P1, Solo run");
    wrapper.unmount();
  });

  it("reports a lead in laps ahead", async () => {
    const { api, wrapper } = mountControl();
    const { setAiDifficulty, currentLap, aiCurrentLap } = useCar();

    await setAiDifficulty("MEDIUM");
    currentLap.value = 5;
    aiCurrentLap.value = 2;

    expect(api.positionLabel.value).toBe("P1");
    expect(api.gapText.value).toBe("3.0 laps ahead");
    wrapper.unmount();
  });

  it("reports a deficit in laps behind", async () => {
    const { api, wrapper } = mountControl();
    const { setAiDifficulty, currentLap, aiCurrentLap } = useCar();

    await setAiDifficulty("HARD");
    currentLap.value = 2;
    aiCurrentLap.value = 5;

    expect(api.positionLabel.value).toBe("P2");
    expect(api.gapText.value).toBe("3.0 laps behind");
    wrapper.unmount();
  });
});

describe("useRaceControl - car selection", () => {
  it("selects a car, publishes the message and closes the modal", async () => {
    const { api, wrapper } = mountControl();
    api.showCarModal.value = true;

    await api.onCarSelect("speedster");

    expect(api.selectedCar.value.id).toBe("speedster");
    expect(api.statusMessage.value).toContain("Speedster");
    expect(api.showCarModal.value).toBe(false);
    wrapper.unmount();
  });

  it("closes the modal even when the selection is refused", async () => {
    const { api, wrapper } = mountControl();
    await api.runCommand("startEngine");
    api.showCarModal.value = true;

    await api.onCarSelect("endurance");

    expect(api.statusMessage.value).toContain("Stop the engine");
    expect(api.showCarModal.value).toBe(false);
    wrapper.unmount();
  });

  it("reports an unknown car id", async () => {
    const { api, wrapper } = mountControl();

    await api.onCarSelect("tractor");

    expect(api.statusMessage.value).toContain("Unknown car");
    wrapper.unmount();
  });
});

describe("useRaceControl - command action table", () => {
  // Each entry is a voice command wired in commandActions. Running them all
  // guards against a renamed useCar export silently unwiring a command.
  const commands = [
    "help",
    "pitStop",
    "startEngine",
    "stopEngine",
    "tireSoft",
    "tireMedium",
    "tireHard",
    "fuelMixLean",
    "fuelMixRich",
    "fuelMixStandard",
    "ersHotlap",
    "ersCharge",
    "ersBalanced",
    "activateDrs",
    "deactivateDrs",
    "lapStatus",
    "bestLap",
    "position",
    "tempStatus",
    "tireStatus",
    "fuelStatus",
    "batteryStatus",
    "damageStatus",
    "weatherStatus",
    "weatherDry",
    "weatherCloudy",
    "weatherWet",
    "weatherStorm",
    "aiEasy",
    "aiMedium",
    "aiHard",
    "aiRandom",
    "aiStatus",
    "aiOff",
    "carSpeedster",
    "carBalanced",
    "carGripmaster",
    "carEndurance",
    "startQualifying",
    "qualifyingStatus",
    "qualifyingBest",
    "tireTempStatus",
    "pitWindowStatus",
    "reset",
  ];

  it.each(commands)("%s returns a spoken message", async (command) => {
    const { api, wrapper } = mountControl();

    const message = await api.runCommand(command);

    expect(typeof message).toBe("string");
    expect(message.trim()).not.toBe("");
    expect(message).not.toContain("not recognized");
    expect(api.statusMessage.value).toBe(message);
    wrapper.unmount();
  });
});
