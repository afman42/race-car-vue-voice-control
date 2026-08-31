// src/App.spec.js

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "./App.vue";
import { useCar } from "@/composables/useCar";

// audioService and textToSpeechService are mocked globally in vitest.setup.js.
vi.mock("@/services/speechRecognitionService", () => ({
  default: {
    startListening: vi.fn(() => true),
    stopListening: vi.fn(),
    resetManualStop: vi.fn(),
    setLanguage: vi.fn(),
    isManuallyStopped: vi.fn(() => false),
  },
}));

beforeEach(async () => {
  const { resetRace, disableAi, aiEnabled } = useCar();
  await resetRace();
  if (aiEnabled.value) await disableAi();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("App.vue", () => {
  it("wraps the dashboard in a main landmark", () => {
    const wrapper = mount(App);
    expect(wrapper.find("main").exists()).toBe(true);
    wrapper.unmount();
  });

  it("renders the race control dashboard", () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain("Race Car Voice Control");
    wrapper.unmount();
  });
});
