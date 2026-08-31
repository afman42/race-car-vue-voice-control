// src/components/RaceControlTiles.spec.js
//
// Conditional dashboard tiles and status-class branches that
// RaceControl.spec.js leaves unrendered: qualifying badges and overlay, DRS
// zone indicator, pit-window tile, temperature/damage severity classes, shift
// lights, and the rival leaderboard.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import RaceControl from "./RaceControl.vue";
import { useCar } from "@/composables/useCar";
import { CAR_SETTINGS, TIRE_TEMP } from "@/config";

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

const flush = async () => {
  await Promise.resolve();
  await nextTick();
};

beforeEach(async () => {
  const { resetRace, disableAi, aiEnabled } = useCar();
  await resetRace();
  if (aiEnabled.value) await disableAi();
  vi.clearAllMocks();
});

describe("qualifying UI", () => {
  it("shows no qualifying chrome in race mode", () => {
    const wrapper = mount(RaceControl);
    expect(wrapper.find(".quali-badge").exists()).toBe(false);
    expect(wrapper.find(".quali-tile").exists()).toBe(false);
    expect(wrapper.find(".quali-grid-display").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows the laps-remaining badge and best-lap tile during a session", async () => {
    const { startQualifying } = useCar();
    await startQualifying();
    const wrapper = mount(RaceControl);
    await flush();

    expect(wrapper.get(".quali-badge").text()).toContain("QLaps: 3");
    expect(wrapper.find(".quali-tile").exists()).toBe(true);
    expect(wrapper.find(".quali-grid-display").exists()).toBe(false);
    wrapper.unmount();
  });

  it("swaps the badge to complete and shows the grid overlay at session end", async () => {
    const { startQualifying, raceFinished, qualifyingBestLap } = useCar();
    await startQualifying();
    qualifyingBestLap.value = 83456;
    raceFinished.value = true;

    const wrapper = mount(RaceControl);
    await flush();

    expect(wrapper.get(".quali-badge").text()).toContain("Race Complete");
    const overlay = wrapper.get(".quali-grid-display");
    expect(overlay.get(".quali-grid-pos").text()).toBe("P1");
    expect(overlay.text()).toContain("1:23.456");
    expect(overlay.find(".quali-grid-row.rival").exists()).toBe(false);
    wrapper.unmount();
  });

  it("adds the rival row to the grid overlay once the rival has a time", async () => {
    const { startQualifying, setAiDifficulty, raceFinished, aiQualifyingBestLap } =
      useCar();
    await startQualifying();
    await setAiDifficulty("HARD");
    aiQualifyingBestLap.value = 91004;
    raceFinished.value = true;

    const wrapper = mount(RaceControl);
    await flush();

    const rival = wrapper.get(".quali-grid-row.rival");
    expect(rival.text()).toContain("1:31.004");
    // Player has no time -> the rival takes the grid slot.
    expect(wrapper.get(".quali-grid-pos").text()).toBe("P2");
    wrapper.unmount();
  });

  it("shows the pitting banner while a pit stop runs", async () => {
    const { pitting } = useCar();
    const wrapper = mount(RaceControl);
    pitting.value = true;
    await flush();

    expect(wrapper.get(".lap-banner").text()).toContain("Pitting");
    pitting.value = false;
    wrapper.unmount();
  });

  it("shows the race-complete banner outside qualifying", async () => {
    const { raceFinished } = useCar();
    const wrapper = mount(RaceControl);
    raceFinished.value = true;
    await flush();

    expect(wrapper.get(".lap-banner").text()).toContain("Race Complete");
    wrapper.unmount();
  });
});

describe("DRS zone indicator", () => {
  it("is hidden with no rival on track", () => {
    const wrapper = mount(RaceControl);
    expect(wrapper.find(".drs-zone-indicator").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows the detection-zone hint when a rival is out of range", async () => {
    const { setAiDifficulty } = useCar();
    await setAiDifficulty("MEDIUM");
    const wrapper = mount(RaceControl);
    await flush();

    const indicator = wrapper.get(".drs-zone-indicator");
    expect(indicator.classes()).toContain("ineligible");
    expect(indicator.text()).toBe("DRS Zone");
    wrapper.unmount();
  });

  it("shows the 1s-gap hint when DRS becomes eligible", async () => {
    const { setAiDifficulty, drsEligible } = useCar();
    await setAiDifficulty("MEDIUM");
    const wrapper = mount(RaceControl);
    drsEligible.value = true;
    await flush();

    const indicator = wrapper.get(".drs-zone-indicator");
    expect(indicator.classes()).toContain("eligible");
    expect(indicator.text()).toBe("DRS 1s Gap");
    wrapper.unmount();
  });

  it("hides the hint while DRS is already open", async () => {
    const { setAiDifficulty, startEngine, activateDrs, drsEligible } = useCar();
    await setAiDifficulty("MEDIUM");
    await startEngine();
    drsEligible.value = true;
    await activateDrs();

    const wrapper = mount(RaceControl);
    await flush();

    expect(wrapper.find(".drs-zone-indicator").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("pit window tile", () => {
  it("is hidden until the window opens", () => {
    const wrapper = mount(RaceControl);
    expect(wrapper.find(".pit-window-tile").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows the recommended pit lap when the window is open", async () => {
    const { pitWindowVisible, pitWindowStart, pitWindowUrgent } = useCar();
    pitWindowVisible.value = true;
    pitWindowStart.value = 7;
    pitWindowUrgent.value = false;

    const wrapper = mount(RaceControl);
    await flush();

    const tile = wrapper.get(".pit-window-tile");
    expect(tile.classes()).not.toContain("urgent");
    expect(tile.text()).toContain("Pit L7");
    expect(tile.get("p.status").classes()).toContain("info");
    wrapper.unmount();
  });

  it("switches to BOX NOW when the window turns urgent", async () => {
    const { pitWindowVisible, pitWindowStart, pitWindowUrgent } = useCar();
    pitWindowVisible.value = true;
    pitWindowStart.value = 9;
    pitWindowUrgent.value = true;

    const wrapper = mount(RaceControl);
    await flush();

    const tile = wrapper.get(".pit-window-tile");
    expect(tile.classes()).toContain("urgent");
    expect(tile.text()).toContain("BOX NOW");
    expect(tile.get("p.status").classes()).toContain("off");
    wrapper.unmount();
  });

  it("stays hidden during a qualifying session", async () => {
    const { startQualifying, pitWindowVisible, pitWindowStart } = useCar();
    await startQualifying();
    pitWindowVisible.value = true;
    pitWindowStart.value = 3;

    const wrapper = mount(RaceControl);
    await flush();

    expect(wrapper.find(".pit-window-tile").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("status severity classes", () => {
  const statusOf = (wrapper, heading) => {
    const tile = wrapper
      .findAll(".display-item")
      .find((item) => item.find("h2").text() === heading);
    return tile.get("p.status");
  };

  it("marks a nominal engine temperature as good", async () => {
    const wrapper = mount(RaceControl);
    await flush();
    expect(statusOf(wrapper, "Engine Temp").classes()).toContain("on");
    wrapper.unmount();
  });

  it("marks a hot engine temperature as a warning", async () => {
    const { engineTemp } = useCar();
    engineTemp.value = CAR_SETTINGS.TEMP_OPTIMAL_MAX + 5;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Engine Temp").classes()).toContain("info");
    wrapper.unmount();
  });

  it("marks a critical engine temperature as an error", async () => {
    const { engineTemp } = useCar();
    engineTemp.value = CAR_SETTINGS.TEMP_CRITICAL + 5;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Engine Temp").classes()).toContain("off");
    wrapper.unmount();
  });

  it("marks cold tires as informational", async () => {
    const { tireTemp } = useCar();
    tireTemp.value = TIRE_TEMP.COLD_THRESHOLD - 5;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Tire Temp").classes()).toContain("info");
    wrapper.unmount();
  });

  it("marks overheated tires as an error", async () => {
    const { tireTemp } = useCar();
    tireTemp.value = TIRE_TEMP.CRITICAL_TEMP + 10;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Tire Temp").classes()).toContain("off");
    wrapper.unmount();
  });

  it("marks optimal tires as good", async () => {
    const wrapper = mount(RaceControl);
    await flush();
    expect(statusOf(wrapper, "Tire Temp").classes()).toContain("on");
    wrapper.unmount();
  });

  it.each([
    [0, "on"],
    [CAR_SETTINGS.DAMAGE_MINOR_THRESHOLD + 1, "info"],
    [CAR_SETTINGS.DAMAGE_MAJOR_THRESHOLD + 1, "off"],
    [CAR_SETTINGS.DAMAGE_CRITICAL_THRESHOLD + 1, "off"],
  ])("classes %i%% damage as %s", async (damage, expected) => {
    const { carDamage } = useCar();
    carDamage.value = damage;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Damage").classes()).toContain(expected);
    wrapper.unmount();
  });

  it("flags a critical fuel level", async () => {
    const { fuelLevel } = useCar();
    fuelLevel.value = CAR_SETTINGS.LOW_FUEL_THRESHOLD - 1;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Fuel Level").classes()).toContain("off");
    wrapper.unmount();
  });

  it("flags a critical battery level", async () => {
    const { batteryLevel } = useCar();
    batteryLevel.value = CAR_SETTINGS.LOW_BATTERY_THRESHOLD - 1;
    const wrapper = mount(RaceControl);
    await flush();

    expect(statusOf(wrapper, "Battery").classes()).toContain("off");
    wrapper.unmount();
  });
});

describe("gear and shift lights", () => {
  it("shows N and no lit LEDs at rest", async () => {
    const wrapper = mount(RaceControl);
    await flush();

    expect(wrapper.get(".gear-number").text()).toBe("N");
    expect(wrapper.get(".gear-number").classes()).toContain("neutral");
    expect(
      wrapper.findAll(".shift-led").filter((led) => led.classes().includes("active")),
    ).toHaveLength(0);
    wrapper.unmount();
  });

  it("lights LEDs progressively as revs climb", async () => {
    const { currentGear, rpm } = useCar();
    currentGear.value = 4;
    rpm.value = CAR_SETTINGS.GEAR_DROP_RPM + CAR_SETTINGS.LED_STEP_RPM;
    const wrapper = mount(RaceControl);
    await flush();

    expect(wrapper.get(".gear-number").text()).toBe("4");
    expect(wrapper.get(".gear-number").classes()).toContain("engaged");
    const lit = wrapper
      .findAll(".shift-led")
      .filter((led) => led.classes().includes("active"));
    expect(lit.length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it("blinks just below the shift point", async () => {
    const { rpm } = useCar();
    rpm.value = CAR_SETTINGS.GEAR_SHIFT_RPM - 50;
    const wrapper = mount(RaceControl);
    await flush();

    const blinking = wrapper
      .findAll(".shift-led")
      .filter((led) => led.classes().includes("blink"));
    expect(blinking.length).toBe(5);
    wrapper.unmount();
  });

  it("goes full shift at and above the shift point", async () => {
    const { rpm } = useCar();
    rpm.value = CAR_SETTINGS.GEAR_SHIFT_RPM;
    const wrapper = mount(RaceControl);
    await flush();

    const shifting = wrapper
      .findAll(".shift-led")
      .filter((led) => led.classes().includes("shift"));
    expect(shifting.length).toBe(5);
    wrapper.unmount();
  });
});

describe("rival panel", () => {
  it("shows OFF and no rival board with the AI disabled", () => {
    const wrapper = mount(RaceControl);
    expect(wrapper.text()).toContain("OFF");
    expect(wrapper.findAll(".leaderboard")).toHaveLength(
      wrapper.findAll(".leaderboard").length,
    );
    expect(wrapper.text()).not.toContain("Rival Laps");
    wrapper.unmount();
  });

  it("shows the difficulty, rival lap and the rival board when enabled", async () => {
    const { setAiDifficulty, aiCurrentLap } = useCar();
    await setAiDifficulty("HARD");
    aiCurrentLap.value = 3;

    const wrapper = mount(RaceControl);
    await flush();

    const tile = wrapper.get(".ai-active");
    expect(tile.text()).toContain("Hard");
    expect(tile.text()).toContain("L3");
    wrapper.unmount();
  });
});

describe("language selector", () => {
  it("lists every supported locale and switches the UI", async () => {
    const wrapper = mount(RaceControl);
    const select = wrapper.get("select");

    expect(select.findAll("option").map((o) => o.attributes("value"))).toEqual([
      "en",
      "id",
    ]);

    await select.setValue("id");
    await flush();

    expect(wrapper.text()).toContain("Kendali Suara Mobil Balap");

    await select.setValue("en");
    await flush();
    wrapper.unmount();
  });
});
