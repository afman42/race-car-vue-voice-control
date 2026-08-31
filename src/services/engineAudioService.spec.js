// src/services/engineAudioService.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The service keeps module-level state (audioCtx, layers, isActive), so every
// test re-imports it fresh after installing a stub AudioContext.

const makeParam = (value = 0) => ({
  value,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
});

const makeFakeContext = ({ state = "running", resume } = {}) => {
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 48000,
    destination: { id: "destination" },
    closed: false,
    resume: resume ?? vi.fn(() => Promise.resolve()),
    close: vi.fn(function close() {
      ctx.closed = true;
    }),
    createGain: vi.fn(() => ({
      gain: makeParam(0.3),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: "sine",
      frequency: makeParam(0),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBuffer: vi.fn((channels, length) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
  };
  return ctx;
};

const loadService = async () => {
  vi.resetModules();
  const mod = await vi.importActual("@/services/engineAudioService");
  return mod.default;
};

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.AudioContext;
  delete window.webkitAudioContext;
});

describe("engineAudioService.start", () => {
  it("returns false when neither AudioContext constructor exists", async () => {
    const service = await loadService();
    await expect(service.start()).resolves.toBe(false);
    expect(service.isActive).toBe(false);
  });

  it("creates the oscillator layers and fades in on first start", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await expect(service.start(4000)).resolves.toBe(true);

    expect(service.isActive).toBe(true);
    // One gain per harmonic plus the master gain.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
    expect(ctx.createGain).toHaveBeenCalledTimes(5);
    const masterGain = ctx.createGain.mock.results[0].value;
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.3,
      0.2,
    );
  });

  it("falls back to webkitAudioContext when the standard one is missing", async () => {
    const ctx = makeFakeContext();
    window.webkitAudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await expect(service.start()).resolves.toBe(true);
    expect(window.webkitAudioContext).toHaveBeenCalled();
  });

  it("is idempotent: a second start resolves true without rebuilding nodes", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    ctx.createOscillator.mockClear();

    await expect(service.start()).resolves.toBe(true);
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("awaits resume() when the context starts suspended", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const ctx = makeFakeContext({ state: "suspended", resume });
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await expect(service.start()).resolves.toBe(true);
    expect(resume).toHaveBeenCalled();
  });

  it("returns false and tears down when resume() rejects", async () => {
    const ctx = makeFakeContext({
      state: "suspended",
      resume: vi.fn(() => Promise.reject(new Error("blocked"))),
    });
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await expect(service.start()).resolves.toBe(false);
    expect(service.isActive).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns false when node creation throws mid-setup", async () => {
    const ctx = makeFakeContext();
    ctx.createOscillator = vi.fn(() => {
      throw new Error("no oscillators");
    });
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await expect(service.start()).resolves.toBe(false);
    expect(service.isActive).toBe(false);
  });

  it("recovers on a later start after an initial failure", async () => {
    const badCtx = makeFakeContext();
    badCtx.createOscillator = vi.fn(() => {
      throw new Error("boom");
    });
    const goodCtx = makeFakeContext();
    window.AudioContext = vi
      .fn()
      .mockImplementationOnce(function () {
        return badCtx;
      })
      .mockImplementationOnce(function () {
        return goodCtx;
      });

    const service = await loadService();
    expect(await service.start()).toBe(false);
    expect(await service.start()).toBe(true);
    expect(service.isActive).toBe(true);
  });

  it("maps rpm to the harmonic base frequency at the low end", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start(0);

    // rpm 0 -> RPM_FREQ_MIN (35); fundamental has mult 1.0.
    const fundamental = ctx.createOscillator.mock.results[0].value;
    expect(fundamental.frequency.setValueAtTime).toHaveBeenLastCalledWith(35, 0);
  });

  it("clamps rpm above the redline to the max frequency", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start(99999);

    const fundamental = ctx.createOscillator.mock.results[0].value;
    expect(fundamental.frequency.setValueAtTime).toHaveBeenLastCalledWith(
      160,
      0,
    );
  });
});

describe("engineAudioService.setRpm", () => {
  it("does nothing while inactive", async () => {
    const service = await loadService();
    expect(() => service.setRpm(5000)).not.toThrow();
  });

  it("ramps every layer and the master gain toward the new rpm", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start(2000);
    const masterGain = ctx.createGain.mock.results[0].value;
    const fundamental = ctx.createOscillator.mock.results[0].value;

    service.setRpm(8000);

    // rpm 8000 -> 160 Hz fundamental; gain target 0.15 + 1 * 0.25 = 0.4.
    expect(fundamental.frequency.setTargetAtTime).toHaveBeenCalledWith(
      160,
      0,
      0.1,
    );
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.4, 0, 0.15);
  });

  it("treats negative rpm as idle rather than an inverted frequency", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start(4000);
    const fundamental = ctx.createOscillator.mock.results[0].value;

    service.setRpm(-500);

    expect(fundamental.frequency.setTargetAtTime).toHaveBeenCalledWith(
      35,
      0,
      0.1,
    );
  });
});

describe("engineAudioService shift blips", () => {
  it("ignores shift blips while inactive", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    service.onShiftUp();
    service.onShiftDown();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("plays a single rising-then-falling oscillator on upshift", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    ctx.createOscillator.mockClear();

    service.onShiftUp();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    const osc = ctx.createOscillator.mock.results[0].value;
    expect(osc.type).toBe("sine");
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 0);
    expect(osc.stop).toHaveBeenCalledWith(0.08);
  });

  it("plays the grumble, the noise burst and two pops on downshift", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    ctx.createOscillator.mockClear();

    service.onShiftDown();

    // Main grumble + 2 pop overtones.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
    // 120ms of noise at the stub sample rate.
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 5760, 48000);
  });

  it("warns instead of throwing when an upshift blip fails", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    ctx.createOscillator = vi.fn(() => {
      throw new Error("node limit");
    });

    expect(() => service.onShiftUp()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "Engine audio: shift-up blip failed",
      expect.any(Error),
    );
  });

  it("warns instead of throwing when a downshift blip fails", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    ctx.createOscillator = vi.fn(() => {
      throw new Error("node limit");
    });

    expect(() => service.onShiftDown()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "Engine audio: shift-down blip failed",
      expect.any(Error),
    );
  });
});

describe("engineAudioService.stop", () => {
  it("does nothing when playback never started", async () => {
    const service = await loadService();
    expect(() => service.stop()).not.toThrow();
    expect(service.isActive).toBe(false);
  });

  it("fades out, then disconnects nodes on a later tick", async () => {
    vi.useFakeTimers();
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    const masterGain = ctx.createGain.mock.results[0].value;
    const osc = ctx.createOscillator.mock.results[0].value;

    service.stop();

    expect(service.isActive).toBe(false);
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.001,
      0.3,
    );
    expect(osc.stop).toHaveBeenCalledWith(0.35);
    // Disconnect is deferred so the fade is audible.
    expect(masterGain.disconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(masterGain.disconnect).toHaveBeenCalled();
    expect(osc.disconnect).toHaveBeenCalled();
  });

  it("swallows disconnect errors during deferred cleanup", async () => {
    vi.useFakeTimers();
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    const masterGain = ctx.createGain.mock.results[0].value;
    masterGain.disconnect.mockImplementation(() => {
      throw new Error("already gone");
    });
    const osc = ctx.createOscillator.mock.results[0].value;
    osc.disconnect.mockImplementation(() => {
      throw new Error("already gone");
    });

    service.stop();
    expect(() => vi.advanceTimersByTime(400)).not.toThrow();
  });

  it("swallows oscillator stop errors", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    for (const result of ctx.createOscillator.mock.results) {
      result.value.stop.mockImplementation(() => {
        throw new Error("already stopped");
      });
    }

    expect(() => service.stop()).not.toThrow();
    expect(service.isActive).toBe(false);
  });

  it("a second stop is a no-op", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    service.stop();
    const masterGain = ctx.createGain.mock.results[0].value;
    masterGain.gain.setValueAtTime.mockClear();

    service.stop();
    expect(masterGain.gain.setValueAtTime).not.toHaveBeenCalled();
  });

  it("allows restarting after a stop", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    service.stop();
    expect(await service.start()).toBe(true);
    expect(service.isActive).toBe(true);
    // The same context is reused; only the nodes are rebuilt.
    expect(window.AudioContext).toHaveBeenCalledTimes(1);
  });
});

describe("engineAudioService.close", () => {
  it("is safe when playback never started", async () => {
    const service = await loadService();
    expect(() => service.close()).not.toThrow();
  });

  it("stops playback and closes the AudioContext", async () => {
    const ctx = makeFakeContext();
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    service.close();

    expect(service.isActive).toBe(false);
    expect(ctx.close).toHaveBeenCalled();
  });

  it("swallows a failing close() and still drops the context", async () => {
    const ctx = makeFakeContext();
    ctx.close = vi.fn(() => {
      throw new Error("already closed");
    });
    window.AudioContext = vi.fn(function () {
      return ctx;
    });

    const service = await loadService();
    await service.start();
    expect(() => service.close()).not.toThrow();

    // A fresh context is built on the next start.
    await service.start();
    expect(window.AudioContext).toHaveBeenCalledTimes(2);
  });
});
