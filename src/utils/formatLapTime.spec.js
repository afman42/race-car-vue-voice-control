// src/utils/formatLapTime.spec.js

import { describe, it, expect } from "vitest";
import { formatLapTime } from "./formatLapTime";

describe("formatLapTime", () => {
  it("returns a placeholder for null or undefined", () => {
    expect(formatLapTime(null)).toBe("--:--");
    expect(formatLapTime(undefined)).toBe("--:--");
  });

  it("formats sub-minute times with zero-padded seconds and millis", () => {
    expect(formatLapTime(0)).toBe("0:00.000");
    expect(formatLapTime(1500)).toBe("0:01.500");
    expect(formatLapTime(8009)).toBe("0:08.009");
  });

  it("formats times over a minute", () => {
    expect(formatLapTime(83456)).toBe("1:23.456");
    expect(formatLapTime(600000)).toBe("10:00.000");
  });

  it("rounds millisecond fractions", () => {
    expect(formatLapTime(1234.6)).toBe("0:01.235");
  });

  it("returns a placeholder for non-finite values", () => {
    expect(formatLapTime(NaN)).toBe("--:--");
    expect(formatLapTime(Infinity)).toBe("--:--");
    expect(formatLapTime(-Infinity)).toBe("--:--");
  });

  it("never renders a 4-digit millisecond field", () => {
    // 999.5ms rounds up to a whole second, not ".1000".
    expect(formatLapTime(59999.6)).toBe("1:00.000");
  });
});
