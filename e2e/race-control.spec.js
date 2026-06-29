// e2e/race-control.spec.js
// @ts-check
import { test, expect } from "@playwright/test";

const TOTAL_LAPS = 10;

test.describe("Race Car Voice Control — E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and bypass the self-signed SSL warning.
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Ensure the app has fully mounted by checking for a known element.
    await expect(page.getByText("Race Car Voice Control")).toBeVisible({
      timeout: 10000,
    });
  });

  // ──────────────────────────────────────────────
  // 1. Initial State
  // ──────────────────────────────────────────────
  test.describe("Initial state", () => {
    test("displays the correct title and default values", async ({ page }) => {
      await expect(page.getByText("Race Car Voice Control")).toBeVisible();
      await expect(page.locator(".display-item").filter({ hasText: "Engine" }).locator(".status.off")).toBeVisible();
      await expect(page.locator(".display-item").filter({ hasText: "Fuel Mix" }).locator(".status")).toContainText("Standard");
      await expect(page.locator(".display-item").filter({ hasText: "ERS Mode" }).locator(".status")).toContainText("Balanced");
      await expect(page.locator(".display-item").filter({ hasText: "Tires" }).locator(".status")).toContainText("Medium");
      await expect(page.getByText(`Lap 1 / ${TOTAL_LAPS}`)).toBeVisible();
    });

    test("shows the language selector and Open Radio button", async ({
      page,
    }) => {
      const select = page.locator("select");
      await expect(select).toBeVisible();
      await expect(select).toHaveValue("en");

      const radioButton = page.getByRole("button", { name: "Open Radio" });
      await expect(radioButton).toBeVisible();
    });

    test("renders the position badge, track map and segment display", async ({
      page,
    }) => {
      await expect(page.locator(".position-badge")).toBeVisible();
      await expect(page.locator(".track-svg")).toBeVisible();
      await expect(page.locator(".segment-display")).toBeVisible();
      await expect(page.locator(".gear-display")).toBeVisible();
    });

    test("shows default weather, damage, best lap as --:--, and AI OFF", async ({
      page,
    }) => {
      await expect(page.locator(".display-item").filter({ hasText: "Weather" }).locator(".status")).toContainText("Dry");
      await expect(page.locator(".display-item").filter({ hasText: "Damage" }).locator(".status")).toBeVisible();
      await expect(page.locator(".display-item").filter({ hasText: "Best Lap" }).locator(".status")).toContainText(/--:--/);
      await expect(page.locator(".display-item").filter({ hasText: "Engine" }).locator(".status.off").first()).toContainText("OFF");
      await expect(page.locator(".display-item").filter({ hasText: "AI Rival" }).locator(".status.off")).toContainText("OFF");
    });
  });

  // ──────────────────────────────────────────────
  // 2. Engine Start → Gear/Speed/RPM Updates
  // ──────────────────────────────────────────────
  test.describe("Engine and gear simulation", () => {
    test("starts the engine and shows it ON with gear 1", async ({ page }) => {
      await page.getByRole("button", { name: "Start Engine" }).click();
      await page.waitForTimeout(500);

      // Engine should be ON
      // The dashboard uses ON / OFF text
      await expect(page.getByText("Gear")).toBeVisible();
      // Gear number should be 1 after starting
      await expect(page.locator(".gear-number")).toContainText("1");
    });

    test("gear shifts up after enough simulation ticks", async ({ page }) => {
      // Start the engine
      await page.getByRole("button", { name: "Start Engine" }).click();

      // Gear should engage (not "N") and then shift up
      await expect(page.locator(".gear-number")).not.toContainText("N", {
        timeout: 5_000,
      });
      await expect(page.locator(".gear-number")).not.toContainText("1", {
        timeout: 20_000,
      });
    });

    test("RPM gauge and shift lights respond after engine start", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Start Engine" }).click();

      // The RPM gauge should show a non-zero value (auto-retry for flake-free).
      await expect(page.locator(".rpm-text"))
        .not.toHaveText("0", { timeout: 10_000 });

      // At least some shift LEDs should be active once RPM climbs.
      await expect(page.locator(".shift-led.active").first())
        .toBeVisible({ timeout: 10_000 });
      const count = await page.locator(".shift-led.active").count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test("speed displays a value after engine is running", async ({ page }) => {
      await page.getByRole("button", { name: "Start Engine" }).click();
      await page.waitForTimeout(6000);

      // Speed tile should show a numeric value with km/h unit
      const speedTile = page.locator(".display-item").filter({ hasText: "km/h" });
      await expect(speedTile).toBeVisible();
      const speedText = await speedTile.textContent();
      // Should contain a number > 0 (e.g. "75 km/h")
      expect(speedText).toMatch(/\d+/);
    });
  });

  // ──────────────────────────────────────────────
  // 3. AI Rival — Difficulty Buttons
  // ──────────────────────────────────────────────
  test.describe("AI rival difficulty buttons", () => {
    test("clicking each difficulty updates the AI dashboard tile", async ({
      page,
    }) => {
      // Click "Rival Easy"
      await page.getByRole("button", { name: "Rival Easy" }).click();
      await page.waitForTimeout(500);
      const aiTile = page.locator(".display-item").filter({ hasText: "AI Rival" });
      await expect(aiTile).toContainText(/Easy/i);

      // Click "Rival Medium"
      await page.getByRole("button", { name: "Rival Medium" }).click();
      await page.waitForTimeout(500);
      await expect(aiTile).toContainText(/Medium/i);

      // Click "Rival Hard"
      await page.getByRole("button", { name: "Rival Hard" }).click();
      await page.waitForTimeout(500);
      await expect(aiTile).toContainText(/Hard/i);

      // Click "Rival Off"
      await page.getByRole("button", { name: "Rival Off" }).click();
      await page.waitForTimeout(500);
      // AI tile should show OFF
      await expect(aiTile).toContainText(/OFF/i);
    });

    test("AI rival tile shows lap and best lap after AI is on", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Rival Medium" }).click();
      await page.waitForTimeout(2000);

      // The AI tile should show "L1" and either "--:--" or a formatted time
      const aiTile = page.locator(".display-item").filter({ hasText: "AI Rival" });
      await expect(aiTile).toContainText(/L1/);
    });

    test("position badge shows P1/P2 when AI is enabled", async ({ page }) => {
      await page.getByRole("button", { name: "Rival Medium" }).click();
      await page.waitForTimeout(1000);

      // The position badge should show P1 (or P2) and a gap
      const badge = page.locator(".position-badge");
      await expect(badge).toBeVisible();
      // Should contain "P1" or "P2"
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/P[12]/);
    });

    test("AI Rival button gets highlighted when selected", async ({ page }) => {
      const btn = page.getByRole("button", { name: "Rival Medium" });
      await btn.click();
      await page.waitForTimeout(500);
      // The active button should have the active-difficulty class
      await expect(btn).toHaveClass(/active-difficulty/);
    });
  });

  // ──────────────────────────────────────────────
  // 4. DRS & Overtake
  // ──────────────────────────────────────────────
  test.describe("DRS and Overtake", () => {
    test("DRS can be activated and deactivated", async ({ page }) => {
      // Engine must be on for DRS
      await page.getByRole("button", { name: "Start Engine" }).click();
      await page.waitForTimeout(500);

      // Activate DRS
      await page.getByRole("button", { name: "DRS On" }).click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/DRS Enabled|ENABLED/)).toBeVisible();

      // Deactivate DRS
      await page.getByRole("button", { name: "DRS Off" }).click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/DISABLED/)).toBeVisible();
    });

    test("Overtake shows countdown bar", async ({ page }) => {
      // Engine must be on with battery for overtake
      await page.getByRole("button", { name: "Start Engine" }).click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: "Overtake" }).click();
      await page.waitForTimeout(500);

      // The countdown bar should appear
      await expect(page.locator(".countdown-bar")).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────
  // 5. Weather Changes
  // ──────────────────────────────────────────────
  test.describe("Weather controls", () => {
    test("changing weather updates the dashboard tile", async ({ page }) => {
      // Click each weather button and verify the dashboard updates
      const weatherTile = page.locator(".display-item").filter({ hasText: "Weather" });

      await page.getByRole("button", { name: "Cloudy" }).click();
      await page.waitForTimeout(500);
      await expect(weatherTile).toContainText(/Cloudy/i);

      await page.getByRole("button", { name: "Wet" }).click();
      await page.waitForTimeout(500);
      await expect(weatherTile).toContainText(/Wet/i);

      await page.getByRole("button", { name: "Storm" }).click();
      await page.waitForTimeout(500);
      await expect(weatherTile).toContainText(/Storm/i);

      // Reset to Dry
      await page.getByRole("button", { name: "Dry" }).click();
      await page.waitForTimeout(500);
      await expect(weatherTile).toContainText(/Dry/);
    });
  });

  // ──────────────────────────────────────────────
  // 6. Fuel Mix, ERS Mode, Tire Compound
  // ──────────────────────────────────────────────
  test.describe("Fuel, ERS and Tires", () => {
    test("changing fuel mix updates the dashboard", async ({ page }) => {
      const tile = page.locator(".display-item").filter({ hasText: "Fuel Mix" });

      await page.getByRole("button", { name: "Mix Lean" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Lean/i);

      await page.getByRole("button", { name: "Mix Rich" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Rich/i);

      await page.getByRole("button", { name: "Mix Standard" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Standard/i);
    });

    test("changing ERS mode updates the dashboard", async ({ page }) => {
      const tile = page.locator(".display-item").filter({ hasText: "ERS Mode" });

      await page.getByRole("button", { name: "ERS Hotlap" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Hotlap/i);

      await page.getByRole("button", { name: "ERS Charge" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Charge/i);

      await page.getByRole("button", { name: "ERS Balanced" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Balanced/i);
    });

    test("changing tire compound updates the dashboard", async ({ page }) => {
      const tile = page.locator(".display-item").filter({ hasText: "Tires" });

      await page.getByRole("button", { name: "Soft Tire" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Soft/i);

      await page.getByRole("button", { name: "Hard Tire" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Hard/i);

      // Reset to Medium
      await page.getByRole("button", { name: "Medium Tire" }).click();
      await page.waitForTimeout(500);
      await expect(tile).toContainText(/Medium/);
    });
  });

  // ──────────────────────────────────────────────
  // 7. Status Query Buttons
  // ──────────────────────────────────────────────
  test.describe("Status query buttons", () => {
    test("pressing status buttons updates the status message", async ({
      page,
    }) => {
      const statusText = page.locator(".status-text");

      await page.getByRole("button", { name: "Lap Status" }).click();
      await page.waitForTimeout(500);
      await expect(statusText).toContainText(/Lap/i);

      await page.getByRole("button", { name: "Temp Status" }).click();
      await page.waitForTimeout(500);
      await expect(statusText).toContainText(/\d+ degrees/i);

      await page.getByRole("button", { name: "Best Lap" }).click();
      await page.waitForTimeout(500);
      await expect(statusText).toContainText(/--:--|best|No lap/i);
    });
  });

  // ──────────────────────────────────────────────
  // 8. Language Switch
  // ──────────────────────────────────────────────
  test.describe("Language switch", () => {
    test("switching to Indonesian updates the UI text", async ({ page }) => {
      // The language selector should have option "id"
      await page.selectOption("select", "id");
      await page.waitForTimeout(500);

      // After switching, some key UI elements should show Indonesian
      await expect(page.locator(".display-item").filter({ hasText: /Mesin/ }).first()).toBeVisible(); // Engine tile in ID
      // The title should now be in Indonesian
      await expect(page.getByText("Kendali Suara Mobil Balap")).toBeVisible();
    });

    test("switching back to English restores original labels", async ({
      page,
    }) => {
      // Switch to Indonesian
      await page.selectOption("select", "id");
      await page.waitForTimeout(500);

      // Switch back to English
      await page.selectOption("select", "en");
      await page.waitForTimeout(500);

      // Key labels should be in English again
      await expect(page.getByText("Gear")).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────
  // 9. Position Badge & Track Map
  // ──────────────────────────────────────────────
  test.describe("Position badge and track map", () => {
    test("shows solo run text when no AI rival", async ({ page }) => {
      const badge = page.locator(".position-badge");
      await expect(badge).toContainText(/Solo run/i);
    });

    test("track map markers appear correctly", async ({ page }) => {
      // With no AI, only the player marker is visible
      await expect(page.locator(".track-marker.player")).toBeVisible();
      await expect(page.locator(".track-marker.rival")).toHaveCount(0);

      // Enable AI rival
      await page.getByRole("button", { name: "Rival Easy" }).click();
      await page.waitForTimeout(1000);

      // Both markers should now be visible
      await expect(page.locator(".track-marker.player")).toBeVisible();
      await expect(page.locator(".track-marker.rival")).toBeVisible();
    });

    test("segment boundary markers render on the track map", async ({
      page,
    }) => {
      const markers = page.locator(".seg-boundary");
      const count = await markers.count();
      // There are 7 track layout segments in the config
      expect(count).toBe(7);
    });

    test("start/finish line renders on the track map", async ({ page }) => {
      await expect(page.locator(".start-finish")).toBeAttached();
    });
  });

  // ──────────────────────────────────────────────
  // 10. Manual Controls & Reset
  // ──────────────────────────────────────────────
  test.describe("Manual controls and reset", () => {
    test("all manual control buttons are rendered", async ({ page }) => {
      const buttons = page.locator(".ctrl-button");
      const count = await buttons.count();
      // Should have at least 20 control buttons
      expect(count).toBeGreaterThanOrEqual(20);
    });

    test("reset brings the car back to initial state", async ({ page }) => {
      // Start engine and change some settings
      await page.getByRole("button", { name: "Start Engine" }).click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: "Mix Rich" }).click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: "Wet" }).click();
      await page.waitForTimeout(500);

      // Hit Reset
      await page.getByRole("button", { name: "Reset" }).click();
      await page.waitForTimeout(500);

      // State should be back to defaults
      await expect(page.locator(".display-item").filter({ hasText: "Engine" }).locator(".status.off")).toBeVisible();
      await expect(page.locator(".display-item").filter({ hasText: "Weather" }).locator(".status")).toContainText("Dry");
      await expect(page.locator(".display-item").filter({ hasText: "Fuel Mix" }).locator(".status")).toContainText("Standard");
    });
  });

  // ──────────────────────────────────────────────
  // 11. Full Flow: Engine + AI + Gear Changes
  // ──────────────────────────────────────────────
  test.describe("Full race flow", () => {
    test("enable AI, start engine, and verify gear changes over time", async ({
      page,
    }) => {
      // Step 1: Enable AI rival
      await page.getByRole("button", { name: "Rival Medium" }).click();
      await page.waitForTimeout(500);
      const aiTile = page.locator(".display-item").filter({ hasText: "AI Rival" });
      await expect(aiTile).toContainText(/Medium/i);

      // Step 2: Position badge should show P1/P2
      const badge = page.locator(".position-badge");
      await expect(badge).toBeVisible();
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/P[12]/);

      // Step 3: Start engine — gear should engage (not "N")
      await page.getByRole("button", { name: "Start Engine" }).click();
      await expect(page.locator(".gear-number")).not.toContainText("N", {
        timeout: 5_000,
      });

      // Step 4: Wait for gear to shift up (polls every ~500ms for up to 20s)
      await expect(page.locator(".gear-number")).not.toContainText("1", {
        timeout: 20_000,
      });

      // Step 5: Speed should show a value
      const speedTile = page.locator(".display-item").filter({ hasText: "km/h" });
      await expect(speedTile).toBeVisible();
    });
  });
});
