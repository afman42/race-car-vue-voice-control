// src/composables/commandRouter.spec.js

import { describe, it, expect } from "vitest";
import { matchCommand } from "./commandRouter";

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

  it("does not misfire on single stray letters", () => {
    // Previously 't' matched tire and 'dr' matched DRS.
    expect(matchCommand("t")).toBeNull();
    expect(matchCommand("dr")).toBeNull();
  });
});
