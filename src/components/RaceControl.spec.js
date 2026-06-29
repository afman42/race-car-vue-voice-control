// src/components/RaceControl.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import RaceControl from "./RaceControl.vue";
import { useCar } from "@/composables/useCar";
import speechService from "@/services/speechRecognitionService";
import { CAR_SETTINGS } from "@/config";

// audioService and textToSpeechService are mocked globally in vitest.setup.js

// Capture the callback the component registers so we can simulate a transcript.
let capturedOnResult = null;

vi.mock("@/services/speechRecognitionService", () => ({
  default: {
    startListening: vi.fn((onResult) => {
      capturedOnResult = onResult;
      return true;
    }),
    stopListening: vi.fn(),
    resetManualStop: vi.fn(),
    setLanguage: vi.fn(),
    isManuallyStopped: vi.fn(() => false),
  },
}));

const flush = async () => {
  await Promise.resolve();
  await nextTick();
};

describe("RaceControl.vue", () => {
  beforeEach(async () => {
    const { resetRace, disableAi, aiEnabled } = useCar();
    await resetRace();
    if (aiEnabled.value) await disableAi();
    vi.clearAllMocks();
    capturedOnResult = null;
  });

  it("renders the dashboard with initial state", () => {
    const wrapper = mount(RaceControl);
    const text = wrapper.text();
    expect(text).toContain("Race Car Voice Control");
    expect(text).toContain("OFF"); // engine
    expect(text).toContain("Standard"); // fuel mix tile
    expect(text).toContain("Balanced"); // ERS mode tile
    expect(text).toContain("Medium"); // tire compound
    expect(text).toContain(`Lap 1 / ${CAR_SETTINGS.TOTAL_LAPS}`); // lap banner
  });

  it("toggling the radio starts listening and sets aria-pressed", async () => {
    const wrapper = mount(RaceControl);
    const button = wrapper.get(".control-button");

    expect(button.attributes("aria-pressed")).toBe("false");

    await button.trigger("click");

    expect(speechService.startListening).toHaveBeenCalled();
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(wrapper.get(".status-text").text()).toContain("Listening");
  });

  it("routes a start engine command to the composable", async () => {
    const wrapper = mount(RaceControl);
    const { engineStatus } = useCar();

    await wrapper.get(".control-button").trigger("click");
    await capturedOnResult("start engine");
    await flush();

    expect(engineStatus.value).toBe(true);
    expect(wrapper.text()).toContain("ON");
  });

  it("changes fuel mix via voice command", async () => {
    const wrapper = mount(RaceControl);
    const { fuelMix } = useCar();

    await wrapper.get(".control-button").trigger("click");
    await capturedOnResult("rich mix");
    await flush();

    expect(fuelMix.value).toBe("Rich");
    expect(wrapper.text()).toContain("Rich");
  });

  it("reports unrecognized commands back to the user", async () => {
    const wrapper = mount(RaceControl);

    await wrapper.get(".control-button").trigger("click");
    await capturedOnResult("do a barrel roll");
    await flush();

    const status = wrapper.get(".status-text").text();
    expect(status).toContain("Command not recognized");
    expect(status).toContain("do a barrel roll");
  });

  it("shows the overtake countdown bar when overtake is active", async () => {
    const wrapper = mount(RaceControl);

    // Engine must be running with battery to allow overtake.
    await wrapper.get(".control-button").trigger("click");
    await capturedOnResult("start engine");
    await flush();

    await capturedOnResult("overtake");
    await flush();

    expect(wrapper.find(".countdown-bar").exists()).toBe(true);
  });

  it("stops listening on unmount", () => {
    const wrapper = mount(RaceControl);
    wrapper.unmount();
    expect(speechService.stopListening).toHaveBeenCalled();
  });

  describe("manual controls (keyboard fallback)", () => {
    it("renders a button grid", () => {
      const wrapper = mount(RaceControl);
      const buttons = wrapper.findAll(".ctrl-button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("starting the engine via a manual button works without voice", async () => {
      const wrapper = mount(RaceControl);
      const { engineStatus } = useCar();

      const startButton = wrapper
        .findAll(".ctrl-button")
        .find((b) => b.text() === "Start Engine");
      await startButton.trigger("click");
      await flush();

      expect(engineStatus.value).toBe(true);
      // speech recognition was never engaged
      expect(speechService.startListening).not.toHaveBeenCalled();
    });

    it("changes ERS mode via a manual button", async () => {
      const wrapper = mount(RaceControl);
      const { ersMode } = useCar();

      const chargeButton = wrapper
        .findAll(".ctrl-button")
        .find((b) => b.text() === "ERS Charge");
      await chargeButton.trigger("click");
      await flush();

      expect(ersMode.value).toBe("Charge");
      expect(wrapper.text()).toContain("Charge");
    });

    it("changes the weather via a manual button", async () => {
      const wrapper = mount(RaceControl);
      const { weather } = useCar();

      const wetButton = wrapper
        .findAll(".ctrl-button")
        .find((b) => b.text() === "Wet");
      await wetButton.trigger("click");
      await flush();

      expect(weather.value).toBe("Wet");
      expect(wrapper.text()).toContain("Wet");
    });
  });

  describe("new dashboard tiles", () => {
    it("renders weather, damage and best lap tiles", () => {
      const wrapper = mount(RaceControl);
      const text = wrapper.text();
      expect(text).toContain("Dry"); // default weather
      expect(text).toContain("Weather");
      expect(text).toContain("Damage");
      expect(text).toContain("Best Lap");
      expect(text).toContain("--:--"); // no lap time yet
    });

    it("hides the leaderboard until a lap is posted", async () => {
      const wrapper = mount(RaceControl);
      expect(wrapper.find(".leaderboard").exists()).toBe(false);

      const { leaderboard } = useCar();
      leaderboard.value = [{ lap: 1, time: 12345 }];
      await flush();

      expect(wrapper.find(".leaderboard").exists()).toBe(true);
    });
  });

  describe("race standings", () => {
    it("renders the position badge and track map", () => {
      const wrapper = mount(RaceControl);
      const badge = wrapper.get(".position-badge");
      expect(badge.text()).toContain("Position");
      expect(badge.text()).toContain("P1");
      expect(wrapper.find(".track-svg").exists()).toBe(true);
      expect(wrapper.find(".track-marker.player").exists()).toBe(true);
      expect(wrapper.find(".track-marker.rival").exists()).toBe(false);
    });

    it("renders the start/finish line on the track map", () => {
      const wrapper = mount(RaceControl);
      expect(wrapper.find(".start-finish").exists()).toBe(true);
    });

    it("renders segment boundary markers on the track map", () => {
      const wrapper = mount(RaceControl);
      const markers = wrapper.findAll(".seg-boundary");
      expect(markers.length).toBe(CAR_SETTINGS.TRACK_LAYOUT.length);
    });

    it("announces position via the manual Position button", async () => {
      const wrapper = mount(RaceControl);

      const posButton = wrapper
        .findAll(".ctrl-button")
        .find((b) => b.text() === "Position");
      expect(posButton).toBeTruthy();
      await posButton.trigger("click");
      await flush();

      // Solo run: status message reflects the spoken position callout.
      expect(wrapper.get(".status-text").text()).toMatch(/solo/i);
    });
  });

  describe("track segments", () => {
    it("renders the segment display in the dashboard", () => {
      const wrapper = mount(RaceControl);
      const segDisplay = wrapper.find(".segment-display");
      expect(segDisplay.exists()).toBe(true);
      expect(segDisplay.text()).toContain("Track");
      expect(segDisplay.text()).toContain("STRAIGHT");
    });

    it("displays a corner segment when lapProgress enters the first corner", async () => {
      const { lapProgress } = useCar();
      lapProgress.value = 170;
      await flush();

      const wrapper = mount(RaceControl);
      const badge = wrapper.find(".segment-badge");
      expect(badge.text()).toContain("SLOW");
      expect(badge.classes()).toContain("corner");
      expect(badge.classes()).toContain("speed-slow");
    });

    it("displays a medium corner at the right position", async () => {
      const { lapProgress } = useCar();
      lapProgress.value = 300; // In the medium corner (150+48+72=270 to 270+60=330)
      await flush();

      const wrapper = mount(RaceControl);
      const badge = wrapper.find(".segment-badge");
      expect(badge.text()).toContain("MED");
      expect(badge.classes()).toContain("speed-medium");
    });

    it("displays a fast corner at the right position", async () => {
      const { lapProgress } = useCar();
      lapProgress.value = 450; // In the fast corner (330+90=420 to 420+60=480)
      await flush();

      const wrapper = mount(RaceControl);
      const badge = wrapper.find(".segment-badge");
      expect(badge.text()).toContain("FAST");
      expect(badge.classes()).toContain("speed-fast");
    });

    it("first segment boundary marker is a straight (green)", () => {
      const wrapper = mount(RaceControl);
      const markers = wrapper.findAll(".seg-boundary");
      expect(markers[0].classes()).toContain("straight");
    });

    it("second segment boundary marker is a slow corner (red)", () => {
      const wrapper = mount(RaceControl);
      const markers = wrapper.findAll(".seg-boundary");
      expect(markers[1].classes()).toContain("corner");
      expect(markers[1].classes()).toContain("speed-slow");
    });

    it("fourth marker is a medium corner (yellow)", () => {
      const wrapper = mount(RaceControl);
      const markers = wrapper.findAll(".seg-boundary");
      expect(markers[3].classes()).toContain("corner");
      expect(markers[3].classes()).toContain("speed-medium");
    });

    it("sixth marker is a fast corner (orange)", () => {
      const wrapper = mount(RaceControl);
      const markers = wrapper.findAll(".seg-boundary");
      expect(markers[5].classes()).toContain("corner");
      expect(markers[5].classes()).toContain("speed-fast");
    });
  });
});
