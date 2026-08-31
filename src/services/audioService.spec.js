// src/services/audioService.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// vitest.setup.js mocks this module globally, so every test pulls in the real
// implementation with vi.importActual and a stub window.Audio installed.

const createFakeAudio = () => {
  const instances = [];
  function FakeAudio(src) {
    this.src = src;
    this.preload = "none";
    this.currentTime = 0;
    this.listeners = {};
    this.playResult = Promise.resolve();
    this.addEventListener = vi.fn((type, handler) => {
      (this.listeners[type] ||= []).push(handler);
    });
    this.removeEventListener = vi.fn((type, handler) => {
      this.listeners[type] = (this.listeners[type] || []).filter(
        (h) => h !== handler,
      );
    });
    this.emit = (type) => {
      for (const handler of [...(this.listeners[type] || [])]) handler();
    };
    this.play = vi.fn(() => this.playResult);
    instances.push(this);
  }
  FakeAudio.instances = instances;
  return FakeAudio;
};

const loadService = async () => {
  vi.resetModules();
  const mod = await vi.importActual("@/services/audioService");
  return mod.default;
};

let warnSpy;
// jsdom ships a real window.Audio, so the "unavailable" cases must stub it out
// explicitly and restore the original afterwards.
const originalAudio = window.Audio;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.Audio = originalAudio;
});

describe("audioService.loadSounds", () => {
  it("warns and skips preloading when the Audio API is missing", async () => {
    window.Audio = undefined;
    const service = await loadService();
    service.loadSounds();
    expect(warnSpy).toHaveBeenCalledWith(
      "Audio API not available; skipping sound preload.",
    );
  });

  it("creates one element per distinct file path", async () => {
    const FakeAudio = createFakeAudio();
    window.Audio = FakeAudio;

    const service = await loadService();
    service.loadSounds();

    // 5 sound names, but drsOn/drsOff share beep.mp3 -> 4 elements.
    expect(FakeAudio.instances).toHaveLength(4);
    expect(FakeAudio.instances.map((a) => a.src)).toEqual([
      "/audio/engine-start.mp3",
      "/audio/engine-stop.mp3",
      "/audio/beep.mp3",
      "/audio/overtake-on.mp3",
    ]);
  });

  it("sets preload to auto for instant playback", async () => {
    const FakeAudio = createFakeAudio();
    window.Audio = FakeAudio;

    const service = await loadService();
    service.loadSounds();

    for (const audio of FakeAudio.instances) {
      expect(audio.preload).toBe("auto");
    }
  });

  it("is idempotent: a second call creates no new elements", async () => {
    const FakeAudio = createFakeAudio();
    window.Audio = FakeAudio;

    const service = await loadService();
    service.loadSounds();
    service.loadSounds();

    expect(FakeAudio.instances).toHaveLength(4);
  });

  it("warns once per shared element when the file fails to load", async () => {
    const FakeAudio = createFakeAudio();
    window.Audio = FakeAudio;

    const service = await loadService();
    service.loadSounds();

    const beep = FakeAudio.instances.find((a) => a.src === "/audio/beep.mp3");
    beep.emit("error");

    expect(warnSpy).toHaveBeenCalledWith("Audio load failed: /audio/beep.mp3");
  });
});

describe("audioService.playSound", () => {
  const withSounds = async () => {
    const FakeAudio = createFakeAudio();
    window.Audio = FakeAudio;
    const service = await loadService();
    service.loadSounds();
    return { service, FakeAudio };
  };

  it("resolves immediately when the Audio API is unavailable", async () => {
    window.Audio = undefined;
    const service = await loadService();
    await expect(service.playSound("engineStart")).resolves.toBeUndefined();
  });

  it("resolves immediately for an unknown sound name", async () => {
    const { service } = await withSounds();
    await expect(service.playSound("nope")).resolves.toBeUndefined();
  });

  it("resolves immediately when sounds were never preloaded", async () => {
    const FakeAudio = createFakeAudio();
    window.Audio = FakeAudio;
    const service = await loadService();

    await expect(service.playSound("engineStart")).resolves.toBeUndefined();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("rewinds and plays, resolving when the clip ends", async () => {
    const { service, FakeAudio } = await withSounds();
    const audio = FakeAudio.instances[0];
    audio.currentTime = 12;

    const promise = service.playSound("engineStart");
    expect(audio.play).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);

    audio.emit("ended");
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves on a media error instead of hanging", async () => {
    const { service, FakeAudio } = await withSounds();
    const audio = FakeAudio.instances[0];
    // A never-settling play() promise mimics a stuck media element.
    audio.playResult = new Promise(() => {});

    const promise = service.playSound("engineStart");
    audio.emit("error");

    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves and warns when play() is rejected by the browser", async () => {
    const { service, FakeAudio } = await withSounds();
    const audio = FakeAudio.instances[0];
    audio.playResult = Promise.reject(new Error("autoplay blocked"));

    await expect(service.playSound("engineStart")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Audio play failed: "engineStart" — browser may have blocked playback',
    );
  });

  it("removes both listeners after resolving so replays do not stack", async () => {
    const { service, FakeAudio } = await withSounds();
    const audio = FakeAudio.instances[0];

    const promise = service.playSound("engineStart");
    audio.emit("ended");
    await promise;

    expect(audio.listeners.ended).toHaveLength(0);
    // The load-error listener registered by loadSounds() stays attached.
    expect(audio.listeners.error).toHaveLength(1);
  });

  it("shares one element between drsOn and drsOff", async () => {
    const { service, FakeAudio } = await withSounds();
    const beep = FakeAudio.instances.find((a) => a.src === "/audio/beep.mp3");

    const first = service.playSound("drsOn");
    beep.emit("ended");
    await first;

    const second = service.playSound("drsOff");
    beep.emit("ended");
    await second;

    expect(beep.play).toHaveBeenCalledTimes(2);
  });

  it("replays the same sound back to back", async () => {
    const { service, FakeAudio } = await withSounds();
    const audio = FakeAudio.instances[0];

    const first = service.playSound("engineStart");
    audio.emit("ended");
    await first;

    audio.currentTime = 5;
    const second = service.playSound("engineStart");
    expect(audio.currentTime).toBe(0);
    audio.emit("ended");
    await expect(second).resolves.toBeUndefined();
  });
});
