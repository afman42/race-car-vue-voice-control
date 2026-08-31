// src/components/TrackMap.spec.js

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import TrackMap from "./TrackMap.vue";
import { CAR_SETTINGS } from "@/config";
import { setLocale } from "@/i18n";

// jsdom has no SVG geometry, so the path measurement/lookup used to place the
// car markers has to be stubbed. The fake maps a length back to a point so the
// tests can assert positions deterministically.
const TRACK_LENGTH = 200;
const hadGeometry = "getTotalLength" in SVGElement.prototype;

beforeEach(() => {
  setLocale("en");
  SVGElement.prototype.getTotalLength = function getTotalLength() {
    return TRACK_LENGTH;
  };
  SVGElement.prototype.getPointAtLength = function getPointAtLength(length) {
    return { x: length, y: length / 2 };
  };
});

afterEach(() => {
  if (!hadGeometry) {
    delete SVGElement.prototype.getTotalLength;
    delete SVGElement.prototype.getPointAtLength;
  }
});

const mountMap = async (props = {}) => {
  const wrapper = mount(TrackMap, {
    props: {
      playerLoopPos: 0,
      rivalLoopPos: 0,
      aiEnabled: false,
      ariaLabel: "Track: P1, Solo run",
      ...props,
    },
  });
  // onMounted measures the path; markers only settle on the next render.
  await nextTick();
  return wrapper;
};

describe("TrackMap rendering", () => {
  it("exposes the supplied aria label on the image", async () => {
    const wrapper = await mountMap();
    expect(wrapper.get("svg").attributes("aria-label")).toBe(
      "Track: P1, Solo run",
    );
    expect(wrapper.get("svg").attributes("role")).toBe("img");
  });

  it("renders a visually hidden heading translated with the locale", async () => {
    const wrapper = await mountMap();
    expect(wrapper.get(".visually-hidden").text()).toBe("Track");

    setLocale("id");
    await nextTick();
    expect(wrapper.get(".visually-hidden").text()).toBe("Lintasan");
  });

  it("hides the rival marker when the AI is off", async () => {
    const wrapper = await mountMap({ aiEnabled: false });
    expect(wrapper.find(".track-marker.rival").exists()).toBe(false);
    expect(wrapper.find(".track-marker.player").exists()).toBe(true);
  });

  it("shows the rival marker when the AI is on", async () => {
    const wrapper = await mountMap({ aiEnabled: true });
    expect(wrapper.find(".track-marker.rival").exists()).toBe(true);
  });

  it("renders a four-entry legend", async () => {
    const wrapper = await mountMap();
    expect(wrapper.findAll(".legend-dot")).toHaveLength(4);
    expect(wrapper.get(".map-legend").text()).toContain("STRAIGHT");
  });
});

describe("TrackMap markers", () => {
  it("places the player marker at the measured point for its lap fraction", async () => {
    const wrapper = await mountMap({ playerLoopPos: 0.25 });
    const marker = wrapper.get(".track-marker.player");

    // pointAt(0.25) -> getPointAtLength(0.25 * 200) = { x: 50, y: 25 }
    expect(marker.attributes("cx")).toBe("50");
    expect(marker.attributes("cy")).toBe("25");
  });

  it("moves the marker as the lap fraction advances", async () => {
    const wrapper = await mountMap({ playerLoopPos: 0.1 });
    const before = wrapper.get(".track-marker.player").attributes("cx");

    await wrapper.setProps({ playerLoopPos: 0.9 });

    expect(wrapper.get(".track-marker.player").attributes("cx")).not.toBe(
      before,
    );
  });

  it("tracks player and rival independently", async () => {
    const wrapper = await mountMap({
      playerLoopPos: 0.2,
      rivalLoopPos: 0.8,
      aiEnabled: true,
    });

    expect(wrapper.get(".track-marker.player").attributes("cx")).toBe("40");
    expect(wrapper.get(".track-marker.rival").attributes("cx")).toBe("160");
  });

  it("falls back to a fixed point when SVG geometry is unavailable", async () => {
    delete SVGElement.prototype.getTotalLength;
    delete SVGElement.prototype.getPointAtLength;

    const wrapper = await mountMap({ playerLoopPos: 0.5 });
    const marker = wrapper.get(".track-marker.player");

    expect(marker.attributes("cx")).toBe("50");
    expect(marker.attributes("cy")).toBe("10");
  });

  it("falls back when the path can be measured but not sampled", async () => {
    delete SVGElement.prototype.getPointAtLength;

    const wrapper = await mountMap({ playerLoopPos: 0.5 });

    expect(wrapper.get(".track-marker.player").attributes("cx")).toBe("50");
  });
});

describe("TrackMap segment boundaries", () => {
  it("renders one boundary marker per track segment", async () => {
    const wrapper = await mountMap();
    expect(wrapper.findAll(".seg-boundary")).toHaveLength(
      CAR_SETTINGS.TRACK_LAYOUT.length,
    );
  });

  it("classes each marker by the segment type and corner speed", async () => {
    const wrapper = await mountMap();
    const markers = wrapper.findAll(".seg-boundary");

    CAR_SETTINGS.TRACK_LAYOUT.forEach((segment, i) => {
      const classes = markers[i].classes();
      if (segment.type === "corner") {
        expect(classes).toContain("corner");
        expect(classes).toContain(`speed-${segment.speed}`);
      } else {
        expect(classes).toContain("straight");
      }
    });
  });

  it("places the boundary markers at cumulative lap fractions", async () => {
    const wrapper = await mountMap();
    const markers = wrapper.findAll(".seg-boundary");

    let accumulated = 0;
    CAR_SETTINGS.TRACK_LAYOUT.forEach((segment, i) => {
      accumulated += segment.length;
      const expectedX =
        (accumulated / CAR_SETTINGS.LAP_DISTANCE) * TRACK_LENGTH;
      expect(Number(markers[i].attributes("cx"))).toBeCloseTo(expectedX);
    });
  });

  it("anchors the start-finish line to the first boundary marker", async () => {
    const wrapper = await mountMap();
    const first = wrapper.findAll(".seg-boundary")[0];
    const line = wrapper.get(".start-finish");

    expect(line.attributes("x1")).toBe(first.attributes("cx"));
    expect(Number(line.attributes("y1"))).toBe(
      Number(first.attributes("cy")) - 4,
    );
    expect(Number(line.attributes("y2"))).toBe(
      Number(first.attributes("cy")) + 4,
    );
  });
});
