// src/composables/commandRouter.js

// Ordered list of command matchers. Order matters: more specific multi-word
// commands must come before broad single-word ones. Each entry maps a command
// key to the keywords that should trigger it.
export const COMMAND_MATCHERS = [
  { command: "help", keywords: ["help", "what can i say", "commands"] },
  { command: "pitStop", keywords: ["pit stop", "box box", "pit now"] },
  { command: "reset", keywords: ["reset", "new race", "restart"] },
  { command: "startEngine", keywords: ["start engine"] },
  { command: "stopEngine", keywords: ["stop engine", "shut down"] },
  // Tire compounds before the generic "tire" status query.
  { command: "tireSoft", keywords: ["soft tire", "soft tyre", "soft compound"] },
  {
    command: "tireMedium",
    keywords: ["medium tire", "medium tyre", "medium compound"],
  },
  { command: "tireHard", keywords: ["hard tire", "hard tyre", "hard compound"] },
  // Fuel mix before the generic "fuel" status query.
  { command: "fuelMixLean", keywords: ["lean mix", "lean mixture", "mix lean"] },
  { command: "fuelMixRich", keywords: ["rich mix", "rich mixture", "mix rich"] },
  {
    command: "fuelMixStandard",
    keywords: ["standard mix", "standard mixture", "mix standard", "normal mix"],
  },
  // ERS deployment modes.
  { command: "ersHotlap", keywords: ["hotlap", "hot lap", "ers hot"] },
  { command: "ersCharge", keywords: ["charge mode", "ers charge", "harvest"] },
  {
    command: "ersBalanced",
    keywords: ["balanced mode", "ers balanced", "balance ers"],
  },
  { command: "overtake", keywords: ["overtake", "over take"] },
  { command: "deactivateDrs", keywords: ["close drs", "disable drs", "drs off"] },
  { command: "activateDrs", keywords: ["drs"] },
  { command: "lapStatus", keywords: ["lap status", "what lap", "current lap", "lap"] },
  {
    command: "tempStatus",
    keywords: ["temperature", "engine temp", "temp status", "temp"],
  },
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
