// src/components/CarSelectModal.spec.js
//
// Focuses on the accessibility behaviour the RaceControl integration tests do
// not reach: focus capture/restore and the Tab/Escape key handling.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import CarSelectModal from "./CarSelectModal.vue";
import { CAR_PRESETS } from "@/config";
import { setLocale } from "@/i18n";

// The focus trap reads document.activeElement, so the component must be
// attached to the real document.
const mountModal = (props = {}) =>
  mount(CarSelectModal, {
    props: { show: true, selectedId: "balanced", ...props },
    attachTo: document.body,
  });

beforeEach(() => {
  setLocale("en");
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CarSelectModal rendering", () => {
  it("renders nothing while hidden", () => {
    const wrapper = mountModal({ show: false });
    expect(wrapper.find(".car-modal-overlay").exists()).toBe(false);
    wrapper.unmount();
  });

  it("renders a dialog with an accessible name", () => {
    const wrapper = mountModal();
    const panel = wrapper.get('[role="dialog"]');
    expect(panel.attributes("aria-modal")).toBe("true");
    expect(panel.attributes("aria-label")).toBe("Choose Your Car");
    wrapper.unmount();
  });

  it("renders one card per preset plus a cancel button", () => {
    const wrapper = mountModal();
    expect(wrapper.findAll(".car-card")).toHaveLength(CAR_PRESETS.length);
    expect(wrapper.find(".car-cancel").exists()).toBe(true);
    wrapper.unmount();
  });

  it("marks the selected card", () => {
    const wrapper = mountModal({ selectedId: "endurance" });
    const cards = wrapper.findAll(".car-card");
    const index = CAR_PRESETS.findIndex((c) => c.id === "endurance");
    expect(cards[index].classes()).toContain("selected");
    expect(cards.filter((c) => c.classes().includes("selected"))).toHaveLength(
      1,
    );
    wrapper.unmount();
  });

  it("renders five stat bars per card with widths inside 0-100%", () => {
    const wrapper = mountModal();
    const card = wrapper.findAll(".car-card")[0];
    const fills = card.findAll(".stat-fill");

    expect(fills).toHaveLength(5);
    for (const fill of fills) {
      const pct = Number(fill.attributes("style").match(/width:\s*([\d.]+)%/)[1]);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
    wrapper.unmount();
  });

  it("maps the neutral 1.0 multiplier to the middle of the bar", () => {
    const wrapper = mountModal();
    const index = CAR_PRESETS.findIndex((c) => c.id === "balanced");
    const fills = wrapper.findAll(".car-card")[index].findAll(".stat-fill");

    // (1.0 - 0.5) / 0.9 = 55.6% -> rounded to 56%.
    for (const fill of fills) {
      expect(fill.attributes("style")).toContain("width: 56%");
    }
    wrapper.unmount();
  });

  it("translates the dialog chrome with the locale", () => {
    const wrapper = mountModal();
    setLocale("id");
    return nextTick().then(() => {
      expect(wrapper.text()).toContain("Pilih Mobil");
      wrapper.unmount();
    });
  });
});

describe("CarSelectModal events", () => {
  it("emits select with the clicked car id", async () => {
    const wrapper = mountModal();
    await wrapper.findAll(".car-card")[0].trigger("click");
    expect(wrapper.emitted("select")).toEqual([[CAR_PRESETS[0].id]]);
    wrapper.unmount();
  });

  it("emits close from the cancel button", async () => {
    const wrapper = mountModal();
    await wrapper.get(".car-cancel").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
  });

  it("emits close when the backdrop itself is clicked", async () => {
    const wrapper = mountModal();
    await wrapper.get(".car-modal-overlay").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
  });

  it("does not close when the click starts inside the panel", async () => {
    const wrapper = mountModal();
    await wrapper.get(".car-modal").trigger("click");
    expect(wrapper.emitted("close")).toBeUndefined();
    wrapper.unmount();
  });

  it("emits close on Escape", async () => {
    const wrapper = mountModal();
    await wrapper.get(".car-modal-overlay").trigger("keydown", {
      key: "Escape",
    });
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
  });

  it("ignores unrelated keys", async () => {
    const wrapper = mountModal();
    await wrapper.get(".car-modal-overlay").trigger("keydown", { key: "a" });
    expect(wrapper.emitted("close")).toBeUndefined();
    wrapper.unmount();
  });
});

describe("CarSelectModal focus management", () => {
  it("focuses the panel when opened", async () => {
    const wrapper = mount(CarSelectModal, {
      props: { show: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ show: true });
    await nextTick();

    expect(document.activeElement).toBe(wrapper.get(".car-modal").element);
    wrapper.unmount();
  });

  it("restores focus to the opener when closed", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const wrapper = mount(CarSelectModal, {
      props: { show: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ show: true });
    await nextTick();
    expect(document.activeElement).not.toBe(opener);

    await wrapper.setProps({ show: false });
    await nextTick();

    expect(document.activeElement).toBe(opener);
    wrapper.unmount();
  });

  it("survives a close with no previously focused element", async () => {
    const wrapper = mount(CarSelectModal, {
      props: { show: false },
      attachTo: document.body,
    });

    await expect(wrapper.setProps({ show: false })).resolves.toBeUndefined();
    wrapper.unmount();
  });
});

describe("CarSelectModal focus trap", () => {
  const buttonsOf = (wrapper) =>
    Array.from(wrapper.get(".car-modal").element.querySelectorAll("button"));

  it("wraps Tab from the last button back to the first", async () => {
    const wrapper = mountModal();
    const buttons = buttonsOf(wrapper);
    const last = buttons[buttons.length - 1];
    last.focus();

    await wrapper.get(".car-modal-overlay").trigger("keydown", { key: "Tab" });

    expect(document.activeElement).toBe(buttons[0]);
    wrapper.unmount();
  });

  it("wraps Shift+Tab from the first button to the last", async () => {
    const wrapper = mountModal();
    const buttons = buttonsOf(wrapper);
    buttons[0].focus();

    await wrapper.get(".car-modal-overlay").trigger("keydown", {
      key: "Tab",
      shiftKey: true,
    });

    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    wrapper.unmount();
  });

  it("Shift+Tab from the panel itself lands on the last button", async () => {
    const wrapper = mountModal();
    const buttons = buttonsOf(wrapper);
    wrapper.get(".car-modal").element.focus();

    await wrapper.get(".car-modal-overlay").trigger("keydown", {
      key: "Tab",
      shiftKey: true,
    });

    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    wrapper.unmount();
  });

  it("pulls focus back inside when it escaped the dialog", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    const wrapper = mountModal();
    const buttons = buttonsOf(wrapper);
    outside.focus();

    await wrapper.get(".car-modal-overlay").trigger("keydown", { key: "Tab" });

    expect(document.activeElement).toBe(buttons[0]);
    wrapper.unmount();
  });

  it("pulls focus back to the last button on Shift+Tab from outside", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    const wrapper = mountModal();
    const buttons = buttonsOf(wrapper);
    outside.focus();

    await wrapper.get(".car-modal-overlay").trigger("keydown", {
      key: "Tab",
      shiftKey: true,
    });

    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    wrapper.unmount();
  });

  it("leaves mid-list Tab to the browser", async () => {
    const wrapper = mountModal();
    const buttons = buttonsOf(wrapper);
    buttons[1].focus();

    await wrapper.get(".car-modal-overlay").trigger("keydown", { key: "Tab" });

    // No wrap: focus is untouched, the default behaviour handles it.
    expect(document.activeElement).toBe(buttons[1]);
    wrapper.unmount();
  });
});
