// src/composables/useQualifying.spec.js
//
// Covers the qualifying paths useCar.spec.js does not reach: grid-position
// computation against the rival, the display info object, and the TTS status
// branches once a lap time exists.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import { QUALIFYING } from "@/config";

// audioService and textToSpeechService are mocked globally in vitest.setup.js.
vi.mock("@/services/engineAudioService", () => ({
  default: {
    start: vi.fn(() => Promise.resolve(true)),
    stop: vi.fn(),
    close: vi.fn(),
    setRpm: vi.fn(),
    onShiftUp: vi.fn(),
    onShiftDown: vi.fn(),
    isActive: false,
  },
}));

beforeEach(async () => {
  const { resetRace, disableAi, aiEnabled } = useCar();
  await resetRace();
  if (aiEnabled.value) await disableAi();
  vi.clearAllMocks();
});

describe("qualifying grid position", () => {
  it("is P1 in race mode regardless of lap times", () => {
    const { qualifyingPosition, raceMode } = useCar();
    expect(raceMode.value).toBe("race");
    expect(qualifyingPosition.value).toBe(1);
  });

  it("is P1 during qualifying when no rival set a time", async () => {
    const { startQualifying, qualifyingPosition } = useCar();
    await startQualifying();
    expect(qualifyingPosition.value).toBe(1);
  });

  it("is P2 when the rival has a time and the player does not", async () => {
    const { startQualifying, setAiDifficulty, qualifyingPosition, aiQualifyingBestLap } =
      useCar();
    await startQualifying();
    await setAiDifficulty("HARD");
    aiQualifyingBestLap.value = 31000;

    expect(qualifyingPosition.value).toBe(2);
  });

  it("is P1 when the player is faster than the rival", async () => {
    const {
      startQualifying,
      setAiDifficulty,
      qualifyingPosition,
      qualifyingBestLap,
      aiQualifyingBestLap,
    } = useCar();
    await startQualifying();
    await setAiDifficulty("HARD");
    aiQualifyingBestLap.value = 31000;
    qualifyingBestLap.value = 30500;

    expect(qualifyingPosition.value).toBe(1);
  });

  it("awards P1 to the player on an exact tie", async () => {
    const {
      startQualifying,
      setAiDifficulty,
      qualifyingPosition,
      qualifyingBestLap,
      aiQualifyingBestLap,
    } = useCar();
    await startQualifying();
    await setAiDifficulty("HARD");
    aiQualifyingBestLap.value = 31000;
    qualifyingBestLap.value = 31000;

    expect(qualifyingPosition.value).toBe(1);
  });

  it("is P2 when the rival is faster", async () => {
    const {
      startQualifying,
      setAiDifficulty,
      qualifyingPosition,
      qualifyingBestLap,
      aiQualifyingBestLap,
    } = useCar();
    await startQualifying();
    await setAiDifficulty("HARD");
    aiQualifyingBestLap.value = 30000;
    qualifyingBestLap.value = 31500;

    expect(qualifyingPosition.value).toBe(2);
  });
});

describe("qualifyingInfo display object", () => {
  it("is inactive in race mode", () => {
    const { qualifyingInfo } = useCar();
    expect(qualifyingInfo.value.active).toBe(false);
    expect(qualifyingInfo.value.sessionEnded).toBe(false);
  });

  it("reports an active session with the full lap allowance", async () => {
    const { startQualifying, qualifyingInfo } = useCar();
    await startQualifying();

    expect(qualifyingInfo.value).toMatchObject({
      active: true,
      lapsRemaining: QUALIFYING.LAPS,
      bestLap: null,
      aiBestLap: null,
      position: 1,
      sessionEnded: false,
    });
  });

  it("flips to sessionEnded once the session finishes", async () => {
    const { startQualifying, qualifyingInfo, raceFinished } = useCar();
    await startQualifying();
    raceFinished.value = true;

    expect(qualifyingInfo.value.active).toBe(false);
    expect(qualifyingInfo.value.sessionEnded).toBe(true);
  });

  it("surfaces both best laps once they are set", async () => {
    const {
      startQualifying,
      setAiDifficulty,
      qualifyingInfo,
      qualifyingBestLap,
      aiQualifyingBestLap,
    } = useCar();
    await startQualifying();
    await setAiDifficulty("MEDIUM");
    qualifyingBestLap.value = 30800;
    aiQualifyingBestLap.value = 31200;

    expect(qualifyingInfo.value.bestLap).toBe(30800);
    expect(qualifyingInfo.value.aiBestLap).toBe(31200);
    expect(qualifyingInfo.value.position).toBe(1);
  });
});

describe("startQualifying", () => {
  it("resets a stale session before arming a new one", async () => {
    const { startQualifying, stopEngine, qualifyingBestLap, qualifyingResults } =
      useCar();
    await startQualifying();
    qualifyingBestLap.value = 31000;
    qualifyingResults.value = [{ lap: 1, time: 31000 }];
    await stopEngine();

    await startQualifying();

    expect(qualifyingBestLap.value).toBeNull();
    expect(qualifyingResults.value).toEqual([]);
  });
});

describe("getQualifyingStatus", () => {
  it("reports not active in race mode", async () => {
    const { getQualifyingStatus } = useCar();
    expect(await getQualifyingStatus()).toBe("Qualifying is not active.");
  });

  it("reports remaining laps before any lap time", async () => {
    const { startQualifying, getQualifyingStatus } = useCar();
    await startQualifying();

    const message = await getQualifyingStatus();

    expect(message).toContain(`${QUALIFYING.LAPS} laps remaining`);
    expect(message).not.toContain("Best lap");
  });

  it("includes the formatted best lap once one is set", async () => {
    const { startQualifying, getQualifyingStatus, qualifyingBestLap } = useCar();
    await startQualifying();
    qualifyingBestLap.value = 83456;

    const message = await getQualifyingStatus();

    expect(message).toContain("Best lap: 1:23.456");
  });
});

describe("getQualifyingBestLap", () => {
  it("reports not active in race mode", async () => {
    const { getQualifyingBestLap } = useCar();
    expect(await getQualifyingBestLap()).toBe("Qualifying is not active.");
  });

  it("reports no lap yet at the start of a session", async () => {
    const { startQualifying, getQualifyingBestLap } = useCar();
    await startQualifying();

    expect(await getQualifyingBestLap()).toBe("No qualifying lap set yet.");
  });

  it("reports the formatted best lap once one is set", async () => {
    const { startQualifying, getQualifyingBestLap, qualifyingBestLap } = useCar();
    await startQualifying();
    qualifyingBestLap.value = 91004;

    expect(await getQualifyingBestLap()).toBe(
      "Best qualifying lap: 1:31.004.",
    );
  });
});
