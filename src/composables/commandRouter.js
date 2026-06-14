// src/composables/commandRouter.js

// Ordered list of command matchers. Order matters: more specific multi-word
// commands must come before broad single-word ones. Each entry maps a command
// key to the keywords that should trigger it.
export const COMMAND_MATCHERS = [
  { command: "pitStop", keywords: ["pit stop"] },
  { command: "reset", keywords: ["reset", "new race", "restart"] },
  { command: "startEngine", keywords: ["start engine"] },
  { command: "stopEngine", keywords: ["stop engine", "shut down"] },
  { command: "fuelMixLean", keywords: ["lean mix", "lean mixture", "mix lean"] },
  { command: "fuelMixRich", keywords: ["rich mix", "rich mixture", "mix rich"] },
  {
    command: "fuelMixStandard",
    keywords: ["standard mix", "standard mixture", "mix standard", "normal mix"],
  },
  { command: "overtake", keywords: ["overtake", "over take","ready"] },
  { command: "deactivateDrs", keywords: ["close drs", "disable drs", "drs off"] },
  { command: "activateDrs", keywords: ["drs"] },
  { command: "tireStatus", keywords: ["tire", "tyre"] },
  { command: "fuelStatus", keywords: ["fuel", "tank", "gas"] },
  { command: "batteryStatus", keywords: ["battery"] },
];

/**
 * Resolve a raw transcript into a known command key.
 * @param {string} transcript - lowercased speech transcript.
 * @returns {string|null} the matching command key, or null if none matched.
 */
export function matchCommand(transcript) {
  if (!transcript) return null;
  const normalized = transcript.trim().toLowerCase();

  for (const { command, keywords } of COMMAND_MATCHERS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return command;
    }
  }

  return null;
}
