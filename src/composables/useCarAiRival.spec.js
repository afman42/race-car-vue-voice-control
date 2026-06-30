// src/composables/useCarAiRival.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCar } from "./useCar";
import { CAR_SETTINGS, AI_DIFFICULTY } from "@/config";
import ttsService from "@/services/textToSpeechService";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

describe("useCar - AI rival", () => {
  beforeEach(async () => {
    const { resetRace, disableAi } = useCar();
    await resetRace();
    await disableAi().catch(() => {});
    await resetRace();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("enabling / difficulty", () => {
    it("starts with the AI rival disabled", () => {
      const { aiEnabled, aiLeaderboard, aiBestLapTime } = useCar();
      expect(aiEnabled.value).toBe(false);
      expect(aiLeaderboard.value).toEqual([]);
      expect(aiBestLapTime.value).toBeNull();
    });

    it("enables the rival at a chosen difficulty", async () => {
      const { setAiDifficulty, aiEnabled, aiDifficulty } = useCar();

      const message = await setAiDifficulty("HARD");

      expect(message).toBe("AI rival enabled on Hard difficulty.");
      expect(aiEnabled.value).toBe(true);
      expect(aiDifficulty.value).toBe(AI_DIFFICULTY.HARD.label);
    });

    it("accepts lowercase difficulty input", async () => {
      const { setAiDifficulty, aiDifficulty } = useCar();
      await setAiDifficulty("easy");
      expect(aiDifficulty.value).toBe(AI_DIFFICULTY.EASY.label);
    });

    it("rejects an unknown difficulty", async () => {
      const { setAiDifficulty, aiEnabled } = useCar();
      const message = await setAiDifficulty("insane");
      expect(message).toBe("Unknown difficulty: insane.");
      expect(aiEnabled.value).toBe(false);
    });

    it("RANDOM resolves to a concrete difficulty level", async () => {
      const { setAiDifficulty, aiEnabled, aiDifficulty } = useCar();
      const labels = Object.values(AI_DIFFICULTY).map((d) => d.label);

      await setAiDifficulty("RANDOM");

      expect(aiEnabled.value).toBe(true);
      expect(labels).toContain(aiDifficulty.value);
    });

    it("disables the rival and clears its progress", async () => {
      const { setAiDifficulty, disableAi, aiEnabled, aiLeaderboard } = useCar();
      await setAiDifficulty("MEDIUM");

      const message = await disableAi();

      expect(message).toBe("AI rival disabled.");
      expect(aiEnabled.value).toBe(false);
      expect(aiLeaderboard.value).toEqual([]);
    });

    it("reports when disabling an already-off rival", async () => {
      const { disableAi } = useCar();
      const message = await disableAi();
      expect(message).toBe("The AI rival is already off.");
    });
  });

  describe("lap generation", () => {
    it("posts laps onto the rival board as the simulation runs", () => {
      const { setAiDifficulty, runSimulationTick, aiLeaderboard, aiBestLapTime } =
        useCar();
      setAiDifficulty("MEDIUM");

      // Enough ticks to complete at least one AI lap at the base pace.
      for (let i = 0; i < 100; i++) runSimulationTick();

      expect(aiLeaderboard.value.length).toBeGreaterThan(0);
      expect(aiBestLapTime.value).not.toBeNull();
    });

    it("advances even when the player's engine is off", () => {
      const { setAiDifficulty, runSimulationTick, aiCurrentLap, engineStatus } =
        useCar();
      setAiDifficulty("HARD");
      expect(engineStatus.value).toBe(false);

      const startLap = aiCurrentLap.value;
      for (let i = 0; i < 100; i++) runSimulationTick();

      expect(aiCurrentLap.value).toBeGreaterThan(startLap);
    });

    it("a harder rival posts faster laps than an easier one", () => {
      // Remove variance from the equation so the comparison is deterministic.
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const car = useCar();
      const { setAiDifficulty, runSimulationTick, aiBestLapTime } = car;

      setAiDifficulty("EASY");
      for (let i = 0; i < 100; i++) runSimulationTick();
      const easyBest = aiBestLapTime.value;

      setAiDifficulty("HARD"); // resets AI progress
      for (let i = 0; i < 100; i++) runSimulationTick();
      const hardBest = aiBestLapTime.value;

      expect(hardBest).toBeLessThan(easyBest);
    });

    it("keeps the rival board capped and sorted fastest-first", () => {
      const { setAiDifficulty, runSimulationTick, aiLeaderboard } = useCar();
      setAiDifficulty("MEDIUM");

      for (let i = 0; i < 500; i++) runSimulationTick();

      const times = aiLeaderboard.value.map((e) => e.time);
      const sorted = [...times].sort((a, b) => a - b);
      expect(times).toEqual(sorted);
      expect(aiLeaderboard.value.length).toBeLessThanOrEqual(
        CAR_SETTINGS.LEADERBOARD_SIZE,
      );
    });

    it("finishes the rival's race after the final lap", () => {
      const { setAiDifficulty, runSimulationTick, aiFinished } = useCar();
      setAiDifficulty("HARD");

      for (let i = 0; i < 1200 && !aiFinished.value; i++) runSimulationTick();

      expect(aiFinished.value).toBe(true);
      expect(ttsService.speak).toHaveBeenCalledWith(
        "The AI rival has finished the race.",
      );
    });
  });

  describe("status query", () => {
    it("reports no rival when disabled", async () => {
      const { getAiStatus } = useCar();
      const message = await getAiStatus();
      expect(message).toBe("No AI rival in this race.");
    });

    it("reports the rival's lap before any lap is posted", async () => {
      const { setAiDifficulty, getAiStatus } = useCar();
      await setAiDifficulty("MEDIUM");
      const message = await getAiStatus();
      expect(message).toContain("Medium rival is on lap 1");
    });
  });

  describe("reset", () => {
    it("clears AI race progress but keeps difficulty selected", async () => {
      const { setAiDifficulty, runSimulationTick, resetRace, aiEnabled, aiCurrentLap, aiLeaderboard, aiDifficulty } =
        useCar();
      await setAiDifficulty("HARD");
      for (let i = 0; i < 40; i++) runSimulationTick();

      await resetRace();

      expect(aiEnabled.value).toBe(true);
      expect(aiDifficulty.value).toBe(AI_DIFFICULTY.HARD.label);
      expect(aiCurrentLap.value).toBe(1);
      expect(aiLeaderboard.value).toEqual([]);
    });
  });

  describe("qualifying mode", () => {
    it("AI has no qualifying best lap initially", () => {
      const { aiQualifyingBestLap } = useCar();
      expect(aiQualifyingBestLap.value).toBeNull();
    });

    it("AI is not qualifying-finished initially", () => {
      const { aiQualifyingFinished } = useCar();
      expect(aiQualifyingFinished.value).toBe(false);
    });

    it("AI tracks qualifying laps when qualifying mode is on", async () => {
      const { startQualifying, setAiDifficulty, runSimulationTick, aiQualifyingBestLap, aiQualifyingFinished } = useCar();
      await startQualifying();
      await setAiDifficulty("HARD");

      // Run enough ticks for AI to complete qualifying laps
      for (let i = 0; i < 300 && !aiQualifyingFinished.value; i++) {
        runSimulationTick();
      }

      expect(aiQualifyingBestLap.value).not.toBeNull();
      expect(aiQualifyingFinished.value).toBe(true);
    });

    it("AI does not track qualifying laps in normal race mode", async () => {
      const { setAiDifficulty, runSimulationTick, aiQualifyingBestLap, aiQualifyingFinished } = useCar();
      await setAiDifficulty("HARD");

      for (let i = 0; i < 100; i++) runSimulationTick();

      // In normal race mode, should not have qualifying data
      expect(aiQualifyingBestLap.value).toBeNull();
      expect(aiQualifyingFinished.value).toBe(false);
    });

    it("resetRace clears AI qualifying state", async () => {
      const { startQualifying, setAiDifficulty, runSimulationTick, resetRace, aiQualifyingBestLap, aiQualifyingFinished } = useCar();
      await startQualifying();
      await setAiDifficulty("HARD");

      for (let i = 0; i < 300; i++) runSimulationTick();

      await resetRace();

      expect(aiQualifyingBestLap.value).toBeNull();
      expect(aiQualifyingFinished.value).toBe(false);
    });

    it("Normal race still finishes correctly after 10 laps despite qualifying feature", async () => {
      const { setAiDifficulty, runSimulationTick, aiFinished, aiCurrentLap } = useCar();
      await setAiDifficulty("HARD");

      for (let i = 0; i < 1200 && !aiFinished.value; i++) {
        runSimulationTick();
      }

      expect(aiFinished.value).toBe(true);
      expect(aiCurrentLap.value).toBeGreaterThanOrEqual(CAR_SETTINGS.TOTAL_LAPS);
    });
  });
});
