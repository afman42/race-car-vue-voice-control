// src/main.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";

// main.js runs its side effects at import time, so each test re-imports it with
// createApp stubbed out.
const mount = vi.fn();
const createApp = vi.fn(() => ({ mount }));

vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return { ...actual, createApp };
});

vi.mock("@/services/speechRecognitionService", () => ({
  default: {
    startListening: vi.fn(() => true),
    stopListening: vi.fn(),
    resetManualStop: vi.fn(),
    setLanguage: vi.fn(),
    isManuallyStopped: vi.fn(() => false),
  },
}));

const loadMain = async () => {
  vi.resetModules();
  await import("./main.js");
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("main.js bootstrap", () => {
  it("mounts the app into #app", async () => {
    await loadMain();

    expect(createApp).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith("#app");
  });

  it("validates the config before mounting", async () => {
    vi.resetModules();
    vi.doMock("@/config", async () => {
      const actual = await vi.importActual("@/config");
      return {
        ...actual,
        validateConfig: () => {
          throw new Error("TRACK_LAYOUT lengths sum to 1");
        },
      };
    });

    try {
      await expect(import("./main.js")).rejects.toThrow(
        /TRACK_LAYOUT lengths sum to 1/,
      );
      expect(mount).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@/config");
    }
  });
});
