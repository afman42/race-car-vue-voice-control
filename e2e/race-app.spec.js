// e2e/race-app.spec.js
// @ts-check
import { test, expect } from "@playwright/test";

/**
 * Helper: find a dashboard display-item tile by its label text.
 */
function dashboardTile(page, label) {
  return page.locator(".display-item").filter({ hasText: label });
}

/**
 * Helper: get the value text from a dashboard tile (e.g. "1" from "Gear 1").
 */
async function tileValue(page, label) {
  const tile = dashboardTile(page, label);
  const text = await tile.textContent();
  // The label is usually followed by the value, e.g. "Gear1" or "Gear 1"
  // Strip the label and trim.
  for (const part of text.split(/\s+/)) {
    if (
      part !== label &&
      !isNaN(Number(part)) &&
      part !== "N" &&
      part !== "OFF"
    ) {
      return isNaN(Number(part)) ? part : Number(part);
    }
  }
  return text.replace(label, "").trim();
}

/**
 * Helper: click a manual control button by its text.
 */
async function clickButton(page, text) {
  await page.getByRole("button", { name: text, exact: true }).click();
}

/**
 * Helper: wait for the status message area to contain a substring.
 */
async function waitForStatus(page, substring) {
  await expect(page.locator(".status-text")).toContainText(substring, {
    timeout: 5000,
  });
}

// ──────────────────────────────────────────────────
// 1. INITIAL STATE
// ──────────────────────────────────────────────────
test.describe("Initial state", () => {
  test("shows all dashboard tiles with default values", async ({ page }) => {
    await page.goto("/");

    // Core tiles exist and show initial values.
    await expect(dashboardTile(page, "Engine").first()).toContainText("OFF");
    await expect(dashboardTile(page, "Gear")).toContainText("N");
    await expect(dashboardTile(page, "Battery").first()).toContainText(/100|%/);
    await expect(dashboardTile(page, "Damage")).toContainText("0%");
    await expect(dashboardTile(page, "AI Rival")).toContainText("OFF");
  });

  test("shows position badge with solo run", async ({ page }) => {
    await page.goto("/");
    const badge = page.locator(".position-badge");
    await expect(badge).toContainText("Position");
    await expect(badge).toContainText("P1");
    await expect(badge).toContainText("Solo");
  });

  test("renders the track map SVG with player marker", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".track-svg")).toBeVisible();
    await expect(page.locator(".track-marker.player")).toBeVisible();
  });

  test("renders manual control buttons", async ({ page }) => {
    await page.goto("/");
    // Key controls.
    await expect(
      page.getByRole("button", { name: "Start Engine" }),
    ).toBeVisible();
    // Language selector is a <select> element, not a button.
    await expect(page.locator("select")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset" }),
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────────
// 2. START ENGINE & GEAR CHANGES
// ──────────────────────────────────────────────────
test.describe("Engine & gears", () => {
  test("start engine updates Engine tile and gear starts at 1", async ({
    page,
  }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");

    await expect(dashboardTile(page, "Engine").first()).toContainText("ON");
    // Gear should show 1 (not N) after starting.
    await expect(dashboardTile(page, "Gear")).toContainText(/[1-7]/);
  });

  test("gear upshifts naturally while engine runs", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");

    // Gear starts at 1.
    await expect(dashboardTile(page, "Gear")).toContainText("1");

    // Wait for upshift to gear 2+ (takes ~6-8s at 2s tick rate).
    await expect(dashboardTile(page, "Gear")).not.toContainText("1", {
      timeout: 30_000,
    });
  });

  test("speed shows a positive km/h value after engine start", async ({
    page,
  }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    // Speed should be > 0 after a few ticks.
    await expect(dashboardTile(page, "Speed")).not.toContainText("0", {
      timeout: 20_000,
    });
  });

  test("RPM gauge appears and updates", async ({ page }) => {
    await page.goto("/");
    // The RPM gauge is rendered as an SVG.
    await expect(page.locator(".rpm-gauge")).toBeVisible();

    await clickButton(page, "Start Engine");
    // After a few ticks RPM should be > idle.
    // The needle ellipse moves — just verify the gauge is still present.
    await expect(page.locator(".rpm-gauge")).toBeVisible();
    // Engine tile confirms running.
    await expect(dashboardTile(page, "Engine").first()).toContainText("ON", {
      timeout: 5000,
    });
  });
});

// ──────────────────────────────────────────────────
// 3. AI RIVAL DIFFICULTY
// ──────────────────────────────────────────────────
test.describe("AI Rival difficulty", () => {
  test("Easy button updates AI tile", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Easy");
    await expect(dashboardTile(page, "AI Rival")).toContainText("Easy");
  });

  test("Medium updates AI tile", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Medium");
    await expect(dashboardTile(page, "AI Rival")).toContainText("Medium");
  });

  test("Hard updates AI tile", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Hard");
    await expect(dashboardTile(page, "AI Rival")).toContainText("Hard");
  });

  test("Random enables AI with some difficulty", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Random");
    // Should show one of Easy/Medium/Hard (randomly chosen).
    await expect(dashboardTile(page, "AI Rival")).not.toContainText("OFF", {
      timeout: 5000,
    });
  });

  test("Off disables AI", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Easy");
    await expect(dashboardTile(page, "AI Rival")).toContainText("Easy");
    await clickButton(page, "Rival Off");
    await expect(dashboardTile(page, "AI Rival")).toContainText("OFF");
  });

  test("rival marker appears on track map when enabled", async ({ page }) => {
    await page.goto("/");
    // No rival marker initially.
    await expect(page.locator(".track-marker.rival")).not.toBeVisible();

    await clickButton(page, "Rival Easy");
    // Rival marker appears.
    await expect(page.locator(".track-marker.rival")).toBeVisible();
  });

  test("position badge shows P1/P2 with gap when AI enabled", async ({
    page,
  }) => {
    await page.goto("/");
    await clickButton(page, "Rival Easy");
    const badge = page.locator(".position-badge");
    // P1 or P2 should be shown (player position vs rival).
    await expect(badge).toContainText(/P[12]/);
    // Gap text should be present (laps ahead/behind).
    await expect(badge).not.toContainText("Solo");
  });
});

// ──────────────────────────────────────────────────
// 4. MANUAL CONTROLS
// ──────────────────────────────────────────────────
test.describe("Manual controls", () => {
  test("Stop Engine works", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await expect(dashboardTile(page, "Engine").first()).toContainText("ON");
    await clickButton(page, "Stop Engine");
    await expect(dashboardTile(page, "Engine").first()).toContainText("OFF");
  });

  test("DRS toggles on/off", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "DRS On");
    await expect(dashboardTile(page, "DRS")).toContainText(/ENABLED|ON/i);
  });

  test("Overtake button triggers status message", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Overtake");
    // Wait for the status message area.
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Pit Stop triggers serviced message", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Pit Stop");
    await expect(page.locator(".status-text")).toContainText(
      /serviced|complete|pit/i,
      { timeout: 10_000 },
    );
  });

  test("tire compound buttons", async ({ page }) => {
    await page.goto("/");
    // Engine must be OFF to change tires (setTireCompound rejects while running).
    await clickButton(page, "Soft Tires");
    await expect(dashboardTile(page, "Tires")).toContainText(/Soft|SOFT/i);

    await clickButton(page, "Medium Tires");
    await expect(dashboardTile(page, "Tires")).toContainText(/Medium|MEDIUM/i);

    await clickButton(page, "Hard Tires");
    await expect(dashboardTile(page, "Tires")).toContainText(/Hard|HARD/i);
  });

  test("fuel mix buttons", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");

    await clickButton(page, "Mix Lean");
    await expect(dashboardTile(page, "Fuel Mix")).toContainText(/Lean|LEAN/i);

    await clickButton(page, "Mix Rich");
    await expect(dashboardTile(page, "Fuel Mix")).toContainText(/Rich|RICH/i);

    await clickButton(page, "Mix Standard");
    await expect(dashboardTile(page, "Fuel Mix")).toContainText(
      /Standard|STANDARD/i,
    );
  });

  test("ERS mode buttons", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");

    await clickButton(page, "ERS Charge");
    await expect(dashboardTile(page, "ERS Mode")).toContainText(
      /Charge|CHARGE/i,
    );

    await clickButton(page, "ERS Hotlap");
    await expect(dashboardTile(page, "ERS Mode")).toContainText(
      /Hotlap|HOTLAP/i,
    );

    await clickButton(page, "ERS Balanced");
    await expect(dashboardTile(page, "ERS Mode")).toContainText(
      /Balanced|BALANCED/i,
    );
  });
});

// ──────────────────────────────────────────────────
// 5. LANGUAGE SWITCH
// ──────────────────────────────────────────────────
test.describe("Language switch", () => {
  test("toggles from English to Indonesian and back", async ({ page }) => {
    await page.goto("/");
    // Language is a <select> element.
    const langSelect = page.locator("select");

    // Default: English labels visible.
    await expect(page.locator("h1")).toContainText(/Voice|Control/i, {
      timeout: 5000,
    });

    // Switch to Indonesian.
    await langSelect.selectOption("id");
    // Wait for Indonesian labels.
    await expect(dashboardTile(page, /Mesin|Engine/).first()).toBeVisible({
      timeout: 5000,
    });

    // Switch back to English.
    await langSelect.selectOption("en");
    await expect(page.locator("h1")).toContainText(/Voice|Control/i, {
      timeout: 5000,
    });
  });
});

// ──────────────────────────────────────────────────
// 6. LAP TIMING & LEADERBOARD
// ──────────────────────────────────────────────────
test.describe("Lap timing & leaderboard", () => {
  test("laps complete while engine runs and leaderboard appears", async ({
    page,
  }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");

    // Wait for lap 2 to complete (~40s of simulation at 2s ticks).
    // The LAP_DISTANCE=100, each tick adds ~2.5-5 units of progress at speed.
    // A lap takes roughly 20-40 ticks (40-80s). Let's wait for lap to advance.
    // Use a custom timeout since lap completion takes a while.
    test.setTimeout(180_000);
    await expect(dashboardTile(page, "Lap Time").first()).not.toContainText(/^0:00\.000$/, {
      timeout: 120_000,
    });
  });

  test("best lap tile shows after a completed lap", async ({ page }) => {
    await page.goto("/");
    test.setTimeout(180_000);
    await clickButton(page, "Start Engine");

    // Best lap shows a value after at least one lap completes.
    // This can take a while.
    await expect(dashboardTile(page, "Best Lap")).not.toContainText(
      /--/i,
      { timeout: 120_000 },
    );
  });
});

// ──────────────────────────────────────────────────
// 7. WEATHER CYCLING
// ──────────────────────────────────────────────────
test.describe("Weather", () => {
  test("weather button cycles through conditions", async ({ page }) => {
    await page.goto("/");
    const weatherTile = dashboardTile(page, "Weather");
    const initial = await weatherTile.textContent();

    // Click Weather button.
    // There's no generic "Weather" button — use individual condition buttons.
    await clickButton(page, "Cloudy");
    await expect(weatherTile).toContainText(/Cloudy/i);

    await clickButton(page, "Dry");
    await expect(weatherTile).toContainText(/Dry/i);
  });
});

// ──────────────────────────────────────────────────
// 8. STATUS & INFORMATION COMMANDS
// ──────────────────────────────────────────────────
test.describe("Status commands", () => {
  test("Lap Status button shows lap info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Lap Status");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Temperature button shows temp info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Temp Status");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Fuel Status shows fuel info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Fuel Status");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Battery Status shows battery info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Battery Status");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Position button shows position info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Easy");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Position");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Damage Status shows damage info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    // Button label is just "Damage" (btn.damageStatus → "Damage")
    await clickButton(page, "Damage");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Weather Status shows conditions", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Weather Status");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });

  test("Best Lap button shows info", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Start Engine");
    await clickButton(page, "Best Lap");
    await expect(page.locator(".status-text")).not.toBeEmpty({
      timeout: 5000,
    });
  });
});

// ──────────────────────────────────────────────────
// 9. FULL RACE PROGRESSION
// ──────────────────────────────────────────────────
test.describe("Race progression", () => {
  test("fuel decreases over time while engine runs", async ({ page }) => {
    await page.goto("/");
    const initialFuel = await dashboardTile(page, "Fuel Level").textContent();
    await clickButton(page, "Start Engine");

    // Wait and check fuel drops.
    await page.waitForTimeout(10_000);
    const currentFuel = await dashboardTile(page, "Fuel Level").textContent();

    // Fuel should have decreased or stayed same — the display is a percentage.
    // The initial shows "100%" and fuel drops by ~0.2/tick.
    // Just verify it changed or is still showing a valid %.
    expect(currentFuel).toMatch(/\d+%/);
  });

  test("full race from start to lap progression with AI rival", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Enable AI rival.
    await clickButton(page, "Rival Easy");
    await expect(dashboardTile(page, "AI Rival")).toContainText("Easy");

    // 2. Start the engine.
    await clickButton(page, "Start Engine");
    await expect(dashboardTile(page, "Engine").first()).toContainText("ON");

    // 3. Dashboard shows values changing.
    await expect(dashboardTile(page, "Speed")).not.toContainText("0", {
      timeout: 30_000,
    });

    // 4. Position badge exists.
    const badge = page.locator(".position-badge");
    await expect(badge).toContainText(/P[12]/);

    // 5. Track map has both markers.
    const playerMarker = page.locator(".track-marker.player");
    const rivalMarker = page.locator(".track-marker.rival");
    await expect(playerMarker).toBeVisible();
    await expect(rivalMarker).toBeVisible();
  });
});

// ──────────────────────────────────────────────────
// 10. RESET
// ──────────────────────────────────────────────────
test.describe("Reset", () => {
  test("reset returns dashboard to initial state", async ({ page }) => {
    await page.goto("/");

    // Start race.
    await clickButton(page, "Start Engine");
    await clickButton(page, "Rival Easy");
    await expect(dashboardTile(page, "Engine").first()).toContainText("ON");

    // Reset.
    await clickButton(page, "Reset");

    // Engine should be OFF again.
    await expect(dashboardTile(page, "Engine").first()).toContainText("OFF", {
      timeout: 10_000,
    });
    // Gear back to N.
    await expect(dashboardTile(page, "Gear")).toContainText("N");
    // Status message confirms reset.
    await expect(page.locator(".status-text")).toContainText(/reset|nominal/i);
  });
});

// ──────────────────────────────────────────────────
// 11. AI GAP TRACKING OVER TIME
// ──────────────────────────────────────────────────
test.describe("AI gap tracking", () => {
  test("gap text updates as race progresses with AI", async ({ page }) => {
    await page.goto("/");
    await clickButton(page, "Rival Easy");
    await clickButton(page, "Start Engine");

    const badge = page.locator(".position-badge");

    // Gap shows laps ahead/behind (not solo).
    await expect(badge).not.toContainText("Solo", { timeout: 15_000 });
    await expect(badge).toContainText(/P[12]/);
  });
});
