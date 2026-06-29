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

  describe("car selection", () => {
    it("renders the car select button with the default car name", () => {
      const wrapper = mount(RaceControl);
      const btn = wrapper.find(".car-select-button");
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toContain("Balanced");
    });

    it("renders the car tile on the dashboard", () => {
      const wrapper = mount(RaceControl);
      const tile = wrapper.find(".car-tile");
      expect(tile.exists()).toBe(true);
      expect(tile.text()).toContain("Balanced");
    });

    it("opens the car modal on button click", async () => {
      const wrapper = mount(RaceControl);
      await wrapper.find(".car-select-button").trigger("click");
      expect(wrapper.find(".car-modal").exists()).toBe(true);
    });

    it("selects a car via the modal", async () => {
      const wrapper = mount(RaceControl);
      const { selectedCar } = useCar();

      await wrapper.find(".car-select-button").trigger("click");
      const speedsterCard = wrapper.findAll(".car-card").find((c) =>
        c.text().includes("Speedster"),
      );
      await speedsterCard.trigger("click");
      await flush();

      expect(selectedCar.value.id).toBe("speedster");
      expect(wrapper.find(".car-modal").exists()).toBe(false);
    });

    it("disables the car select button while the engine runs", async () => {
      const wrapper = mount(RaceControl);
      const { startEngine } = useCar();
      await startEngine();
      await flush();

      const btn = wrapper.find(".car-select-button");
      expect(btn.attributes("disabled")).toBeDefined();
    });

    it("selects a car via voice command", async () => {
      const wrapper = mount(RaceControl);
      const { selectedCar } = useCar();

      await wrapper.get(".control-button").trigger("click");
      await capturedOnResult("endurance");
      await flush();

      expect(selectedCar.value.id).toBe("endurance");
    });

    it("selects a car via manual control button", async () => {
      const wrapper = mount(RaceControl);
      const { selectedCar } = useCar();

      const gripBtn = wrapper
        .findAll(".ctrl-button")
        .find((b) => b.text().includes("Grip Master"));
      await gripBtn.trigger("click");
      await flush();

      expect(selectedCar.value.id).toBe("gripmaster");
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

  describe("runCommand edge cases", () => {
    it("handles null or undefined command gracefully", async () => {
      const wrapper = mount(RaceControl);
      const { runCommand } = wrapper.vm;

      const msgNull = await runCommand(null);
      expect(msgNull).toContain("not recognized");

      const msgUndef = await runCommand(undefined);
      expect(msgUndef).toContain("not recognized");

      const msgUnknown = await runCommand("fly");
      expect(msgUnknown).toContain("Command not recognized");
    });

    it("starts overtake countdown when overtake command succeeds", async () => {
      const wrapper = mount(RaceControl);
      const { startEngine, overtakeActive } = useCar();
      await startEngine();

      const { runCommand } = wrapper.vm;
      await runCommand("overtake");

      expect(overtakeActive.value).toBe(true);
    });
  });

  describe("gear flash", () => {
    it("applies the shifting class when gear changes", async () => {
      const wrapper = mount(RaceControl);
      const { currentGear } = useCar();

      // Gear starts at 0 (N) — no shifting class.
      // The gear-indicator div uses :class="{ shifting: gearFlash }".
      const gearIndicator = wrapper.find(".gear-indicator");
      expect(gearIndicator.classes()).not.toContain("shifting");

      // Trigger a gear change.
      currentGear.value = 1;
      await flush();

      expect(gearIndicator.classes()).toContain("shifting");
    });
  });

  describe("segment wrapping", () => {
    it("wraps segment display when lapProgress exceeds LAP_DISTANCE", async () => {
      const wrapper = mount(RaceControl);
      const { lapProgress } = useCar();

      // Move past the first lap distance → wraps back to start of track.
      lapProgress.value = CAR_SETTINGS.LAP_DISTANCE + 50; // 650 → wraps to 50 (still in straight)
      await flush();

      const segDisplay = wrapper.find(".segment-display");
      expect(segDisplay.exists()).toBe(true);
      expect(segDisplay.text()).toContain("STRAIGHT");
    });

    it("transitions from last straight back to first corner after wrap", async () => {
      const wrapper = mount(RaceControl);
      const { lapProgress } = useCar();

      // Last segment is straight (length 120, starts at 480).
      // Wrap to first corner segment.
      lapProgress.value = CAR_SETTINGS.LAP_DISTANCE + 155; // 755 → wraps to 155 (in first corner)
      await flush();

      const segDisplay = wrapper.find(".segment-display");
      expect(segDisplay.text()).toContain("SLOW");
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
