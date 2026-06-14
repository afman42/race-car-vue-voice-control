// src/components/RaceControl.spec.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import RaceControl from "./RaceControl.vue";
import { useCar } from "@/composables/useCar";
import speechService from "@/services/speechRecognitionService";

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
    isManuallyStopped: vi.fn(() => true),
  },
}));

const flush = async () => {
  await Promise.resolve();
  await nextTick();
};

describe("RaceControl.vue", () => {
  beforeEach(async () => {
    const { resetRace } = useCar();
    await resetRace();
    vi.clearAllMocks();
    capturedOnResult = null;
  });

  it("renders the dashboard with initial state", () => {
    const wrapper = mount(RaceControl);
    const text = wrapper.text();
    expect(text).toContain("Race Car Voice Control");
    expect(text).toContain("OFF"); // engine
    expect(text).toContain("Standard"); // fuel mix tile
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
});
