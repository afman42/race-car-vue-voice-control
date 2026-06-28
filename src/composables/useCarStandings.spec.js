// src/composables/useCarStandings.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCar } from "./useCar";
import { CAR_SETTINGS } from "@/config";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

describe("useCar - race standings", () => {
  beforeEach(async () => {
    const { resetRace, disableAi, aiEnabled } = useCar();
    await resetRace();
    if (aiEnabled.value) await disableAi();
    vi.clearAllMocks();
  });

  it("reports a solo P1 standing when no rival is enabled", () => {
    const { standings } = useCar();
    expect(standings.value.playerPosition).toBe(1);
    expect(standings.value.totalCars).toBe(1);
    expect(standings.value.leader).toBeNull();
    expect(standings.value.gap).toBe(0);
  });

  it("getPosition announces a solo run with no rival", async () => {
    const { getPosition } = useCar();
    const message = await getPosition();
    expect(message).toMatch(/solo/i);
  });

  it("tracks the player loop position within [0, 1)", () => {
    const { playerLoopPos, currentLap, lapProgress } = useCar();
    currentLap.value = 3;
    lapProgress.value = CAR_SETTINGS.LAP_DISTANCE / 2; // halfway through lap 3
    expect(playerLoopPos.value).toBeCloseTo(0.5);
    expect(playerLoopPos.value).toBeGreaterThanOrEqual(0);
    expect(playerLoopPos.value).toBeLessThan(1);
  });

  it("places the player ahead of a rival with less progress", async () => {
    const {
      setAiDifficulty,
      standings,
      currentLap,
      lapProgress,
      aiCurrentLap,
      aiLapProgress,
    } = useCar();
    await setAiDifficulty("MEDIUM");

    // Player on lap 5, rival on lap 2 -> player leads.
    currentLap.value = 5;
    lapProgress.value = 0;
    aiCurrentLap.value = 2;
    aiLapProgress.value = 0;

    expect(standings.value.totalCars).toBe(2);
    expect(standings.value.playerPosition).toBe(1);
    expect(standings.value.leader).toBe("player");
    expect(standings.value.gap).toBeCloseTo(3); // (5-1) - (2-1) = 3
  });

  it("places the player behind a rival with more progress", async () => {
    const {
      setAiDifficulty,
      standings,
      currentLap,
      aiCurrentLap,
    } = useCar();
    await setAiDifficulty("HARD");

    currentLap.value = 2;
    aiCurrentLap.value = 6;

    expect(standings.value.playerPosition).toBe(2);
    expect(standings.value.leader).toBe("rival");
    expect(standings.value.gap).toBeLessThan(0);
  });

  it("getPosition announces the formatted position when racing a rival", async () => {
    const { setAiDifficulty, getPosition, currentLap, aiCurrentLap } = useCar();
    await setAiDifficulty("MEDIUM");
    currentLap.value = 4;
    aiCurrentLap.value = 2;

    const message = await getPosition();
    expect(message).toContain("P1");
  });

  it("resets back to solo P1 after resetRace + disableAi", async () => {
    const { setAiDifficulty, disableAi, resetRace, standings } = useCar();
    await setAiDifficulty("EASY");
    await resetRace();
    await disableAi();
    expect(standings.value.leader).toBeNull();
    expect(standings.value.playerPosition).toBe(1);
  });
});
