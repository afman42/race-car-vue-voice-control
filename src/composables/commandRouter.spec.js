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

  it("does not misfire on single stray letters", () => {
    // Previously 't' matched tire and 'dr' matched DRS.
    expect(matchCommand("t")).toBeNull();
    expect(matchCommand("dr")).toBeNull();
  });
});
