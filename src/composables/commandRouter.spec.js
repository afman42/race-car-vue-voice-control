// src/composables/commandRouter.spec.js

import { describe, it, expect } from "vitest";
import { matchCommand, levenshtein } from "./commandRouter";

describe("matchCommand", () => {
  it("returns null for empty or unmatched input", () => {
    expect(matchCommand("")).toBeNull();
    expect(matchCommand(null)).toBeNull();
    expect(matchCommand("make me a sandwich")).toBeNull();
  });

  it("matches engine commands", () => {
    expect(matchCommand("start engine")).toBe("startEngine");
    expect(matchCommand("please stop engine now")).toBe("stopEngine");
    expect(matchCommand("shut down")).toBe("stopEngine");
  });

  it("prioritizes pit stop over other words", () => {
    expect(matchCommand("box box pit stop")).toBe("pitStop");
  });

  it("matches reset variants", () => {
    expect(matchCommand("reset")).toBe("reset");
    expect(matchCommand("new race")).toBe("reset");
    expect(matchCommand("restart")).toBe("reset");
  });

  it("matches fuel mix commands before generic fuel", () => {
    expect(matchCommand("lean mix")).toBe("fuelMixLean");
    expect(matchCommand("go rich mixture")).toBe("fuelMixRich");
    expect(matchCommand("standard mix")).toBe("fuelMixStandard");
  });

  it("distinguishes DRS on from DRS off", () => {
    expect(matchCommand("activate drs")).toBe("activateDrs");
    expect(matchCommand("drs off")).toBe("deactivateDrs");
    expect(matchCommand("close drs")).toBe("deactivateDrs");
  });

  it("matches overtake including the spaced variant", () => {
    expect(matchCommand("overtake")).toBe("overtake");
    expect(matchCommand("over take now")).toBe("overtake");
  });

  it("matches status queries", () => {
    expect(matchCommand("tire status")).toBe("tireStatus");
    expect(matchCommand("check the tyre")).toBe("tireStatus");
    expect(matchCommand("fuel status")).toBe("fuelStatus");
    expect(matchCommand("how is the gas")).toBe("fuelStatus");
    expect(matchCommand("battery status")).toBe("batteryStatus");
  });

  it("matches help", () => {
    expect(matchCommand("help")).toBe("help");
    expect(matchCommand("what can i say")).toBe("help");
  });

  it("matches tire compounds before the generic tire query", () => {
    expect(matchCommand("soft tire")).toBe("tireSoft");
    expect(matchCommand("fit medium compound")).toBe("tireMedium");
    expect(matchCommand("hard tyre")).toBe("tireHard");
  });

  it("matches ERS modes", () => {
    expect(matchCommand("hotlap")).toBe("ersHotlap");
    expect(matchCommand("ers charge")).toBe("ersCharge");
    expect(matchCommand("balanced mode")).toBe("ersBalanced");
  });

  it("matches lap and temperature queries", () => {
    expect(matchCommand("what lap")).toBe("lapStatus");
    expect(matchCommand("lap status")).toBe("lapStatus");
    expect(matchCommand("engine temperature")).toBe("tempStatus");
    expect(matchCommand("temp status")).toBe("tempStatus");
  });

  it("matches race position queries without shadowing lap status", () => {
    expect(matchCommand("my position")).toBe("position");
    expect(matchCommand("position")).toBe("position");
    expect(matchCommand("where am i")).toBe("position");
    expect(matchCommand("posisi saya", "id")).toBe("position");
    expect(matchCommand("peringkat saya", "id")).toBe("position");
    // The bare "lap" queries must still resolve to lapStatus.
    expect(matchCommand("lap status")).toBe("lapStatus");
    expect(matchCommand("what lap")).toBe("lapStatus");
  });

  it("does not misfire on single stray letters", () => {
    // Previously 't' matched tire and 'dr' matched DRS.
    expect(matchCommand("t")).toBeNull();
    expect(matchCommand("dr")).toBeNull();
  });

  describe("locale-specific matching", () => {
    it("matches Indonesian keywords when locale is 'id'", () => {
      expect(matchCommand("nyalakan mesin", "id")).toBe("startEngine");
      expect(matchCommand("matikan mesin", "id")).toBe("stopEngine");
      expect(matchCommand("bantuan", "id")).toBe("help");
      expect(matchCommand("ban lunak", "id")).toBe("tireSoft");
      expect(matchCommand("salip", "id")).toBe("overtake");
      expect(matchCommand("atur ulang", "id")).toBe("reset");
    });

    it("falls back to English keywords for Indonesian locale", () => {
      // English keywords should still work when locale is Indonesian.
      expect(matchCommand("start engine", "id")).toBe("startEngine");
      expect(matchCommand("help", "id")).toBe("help");
      expect(matchCommand("drs", "id")).toBe("activateDrs");
      expect(matchCommand("reset", "id")).toBe("reset");
    });

    it("falls back to English for unknown locale codes", () => {
      expect(matchCommand("start engine", "fr")).toBe("startEngine");
      expect(matchCommand("help", "de")).toBe("help");
    });

    it("returns null for unrecognized Indonesian input", () => {
      expect(matchCommand("makan nasi goreng", "id")).toBeNull();
    });
  });

  describe("new commands", () => {
    it("matches best lap before the generic lap query", () => {
      expect(matchCommand("best lap")).toBe("bestLap");
      expect(matchCommand("what is my fastest lap")).toBe("bestLap");
      expect(matchCommand("lap record")).toBe("bestLap");
    });

    it("matches weather conditions", () => {
      expect(matchCommand("set dry")).toBe("weatherDry");
      expect(matchCommand("cloudy weather")).toBe("weatherCloudy");
      expect(matchCommand("wet track")).toBe("weatherWet");
      expect(matchCommand("it is raining")).toBe("weatherWet");
      expect(matchCommand("storm")).toBe("weatherStorm");
    });

    it("matches weather and damage status queries", () => {
      expect(matchCommand("weather status")).toBe("weatherStatus");
      expect(matchCommand("car damage")).toBe("damageStatus");
    });

    it("matches Indonesian weather and damage keywords", () => {
      expect(matchCommand("hujan", "id")).toBe("weatherWet");
      expect(matchCommand("badai", "id")).toBe("weatherStorm");
      expect(matchCommand("kerusakan", "id")).toBe("damageStatus");
      expect(matchCommand("lap tercepat", "id")).toBe("bestLap");
    });

    it("matches AI rival difficulty commands", () => {
      expect(matchCommand("easy mode")).toBe("aiEasy");
      expect(matchCommand("rival medium")).toBe("aiMedium");
      expect(matchCommand("hard difficulty")).toBe("aiHard");
      expect(matchCommand("random rival")).toBe("aiRandom");
      expect(matchCommand("surprise me")).toBe("aiRandom");
    });

    it("matches rival off before the difficulty levels and status", () => {
      expect(matchCommand("rival off")).toBe("aiOff");
      expect(matchCommand("disable rival")).toBe("aiOff");
      expect(matchCommand("no rival")).toBe("aiOff");
    });

    it("matches AI rival status query", () => {
      expect(matchCommand("rival status")).toBe("aiStatus");
      expect(matchCommand("ai status")).toBe("aiStatus");
      expect(matchCommand("opponent")).toBe("aiStatus");
    });

    it("matches Indonesian AI rival keywords", () => {
      expect(matchCommand("mode mudah", "id")).toBe("aiEasy");
      expect(matchCommand("lawan sulit", "id")).toBe("aiHard");
      expect(matchCommand("lawan acak", "id")).toBe("aiRandom");
      expect(matchCommand("matikan lawan", "id")).toBe("aiOff");
      expect(matchCommand("status lawan", "id")).toBe("aiStatus");
    });

    it("matches car selection commands", () => {
      expect(matchCommand("speedster")).toBe("carSpeedster");
      expect(matchCommand("car balanced")).toBe("carBalanced");
      expect(matchCommand("select grip")).toBe("carGripmaster");
      expect(matchCommand("endurance")).toBe("carEndurance");
    });

    it("matches Indonesian car keywords", () => {
      expect(matchCommand("mobil speedster", "id")).toBe("carSpeedster");
      expect(matchCommand("mobil seimbang", "id")).toBe("carBalanced");
      expect(matchCommand("mobil endurance", "id")).toBe("carEndurance");
    });
  });

  describe("fuzzy matching", () => {
    it("tolerates minor speech-recognition slips", () => {
      // "engin" -> "engine", "ovrtake" -> "overtake"
      expect(matchCommand("start engin")).toBe("startEngine");
      expect(matchCommand("ovrtake")).toBe("overtake");
    });

    it("matches multi-word commands with a single mangled word", () => {
      expect(matchCommand("pit stp")).toBe("pitStop");
      expect(matchCommand("soft tire")).toBe("tireSoft");
    });

    it("does not fuzzy-match very short keywords", () => {
      // "drs" is short, so a stray near-miss should not trigger it.
      expect(matchCommand("dgs")).toBeNull();
    });

    it("still returns null for genuinely unrelated input", () => {
      expect(matchCommand("make me a sandwich")).toBeNull();
      expect(matchCommand("xyzzy plugh")).toBeNull();
    });
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("engine", "engine")).toBe(0);
  });

  it("returns the length when one string is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("counts single-character edits", () => {
    expect(levenshtein("engin", "engine")).toBe(1); // insertion
    expect(levenshtein("overtake", "ovrtake")).toBe(1); // deletion
    expect(levenshtein("soft", "saft")).toBe(1); // substitution
  });
});
