// src/components/RpmGauge.spec.js

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import RpmGauge from "./RpmGauge.vue";
import { CAR_SETTINGS } from "@/config";
import { setLocale } from "@/i18n";

// jsdom implements no SVG geometry (and no SVGPathElement at all — path nodes
// are plain SVGElement), so getTotalLength has to be stubbed on SVGElement for
// the needle-offset path to run.
const GAUGE_LENGTH = 126;
const hadGetTotalLength = "getTotalLength" in SVGElement.prototype;

beforeEach(() => {
  setLocale("en");
  SVGElement.prototype.getTotalLength = function getTotalLength() {
    return GAUGE_LENGTH;
  };
});

afterEach(() => {
  if (!hadGetTotalLength) delete SVGElement.prototype.getTotalLength;
});

// onMounted measures the arc and writes a ref, so the dash attributes only
// appear after the follow-up render.
const mountGauge = async (rpm) => {
  const wrapper = mount(RpmGauge, { props: { rpm } });
  await nextTick();
  return wrapper;
};

const offsetOf = (wrapper) => {
  const style = wrapper.get(".gauge-needle").attributes("style");
  return Number(style.match(/stroke-dashoffset:\s*([\d.]+)/)[1]);
};

describe("RpmGauge", () => {
  it("renders the rpm value and a static label", async () => {
    const wrapper = await mountGauge(6250.4);
    expect(wrapper.get(".rpm-text").text()).toBe("6250");
    expect(wrapper.get(".rpm-label").text()).toBe("RPM");
  });

  it("exposes the rpm through an accessible image label", async () => {
    const wrapper = await mountGauge(4200);
    expect(wrapper.get("svg").attributes("aria-label")).toBe(
      "Engine RPM 4200",
    );
  });

  it("translates the accessible label with the locale", async () => {
    const wrapper = await mountGauge(4200);
    setLocale("id");
    await nextTick();
    expect(wrapper.get("svg").attributes("aria-label")).toContain("4200");
  });

  it("measures the arc on mount and fully hides the needle at 0 rpm", async () => {
    const wrapper = await mountGauge(0);
    expect(wrapper.get(".gauge-needle").attributes("style")).toContain(
      `stroke-dasharray: ${GAUGE_LENGTH}`,
    );
    expect(offsetOf(wrapper)).toBe(GAUGE_LENGTH);
  });

  it("fully reveals the needle at max rpm", async () => {
    const wrapper = await mountGauge(CAR_SETTINGS.RPM_MAX);
    expect(offsetOf(wrapper)).toBe(0);
  });

  it("reveals half the arc at half rpm", async () => {
    const wrapper = await mountGauge(CAR_SETTINGS.RPM_MAX / 2);
    expect(offsetOf(wrapper)).toBeCloseTo(GAUGE_LENGTH / 2);
  });

  it("clamps rpm above the redline instead of overshooting the arc", async () => {
    const wrapper = await mountGauge(CAR_SETTINGS.RPM_MAX * 3);
    expect(offsetOf(wrapper)).toBe(0);
  });

  it("clamps negative rpm to an empty needle", async () => {
    const wrapper = await mountGauge(-2000);
    expect(offsetOf(wrapper)).toBe(GAUGE_LENGTH);
  });

  it("updates the needle reactively as rpm climbs", async () => {
    const wrapper = await mountGauge(1000);
    const before = offsetOf(wrapper);

    await wrapper.setProps({ rpm: 7000 });

    expect(offsetOf(wrapper)).toBeLessThan(before);
  });

  it("degrades to a zero-length arc when SVG geometry is unavailable", async () => {
    delete SVGElement.prototype.getTotalLength;

    const wrapper = await mountGauge(5000);

    // No measurement means no dash animation, but the gauge still renders.
    expect(offsetOf(wrapper)).toBe(0);
    expect(wrapper.get(".rpm-text").text()).toBe("5000");
  });
});
