// src/services/voiceAction.js
//
// Shared speak-and-return helper for voice command actions.
// Centralizes the t(key, params) -> speak -> return message triplet
// previously duplicated across useCar, useQualifying, and useAiRival.

import { t } from "@/i18n";
import ttsService from "@/services/textToSpeechService";
import audioService from "@/services/audioService";

/**
 * Localize a message, speak it, await playback, and return the text.
 * @param {string} key - i18n message key.
 * @param {object} [params] - interpolation params.
 * @returns {Promise<string>} spoken message.
 */
export async function voiceSay(key, params) {
  const msg = t(key, params);
  await ttsService.speak(msg);
  return msg;
}

/**
 * Localize a message, speak it without awaiting, and return the text.
 * Use for fire-and-forget announcements inside the sim tick.
 * @param {string} key - i18n message key.
 * @param {object} [params] - interpolation params.
 * @returns {string} spoken message.
 */
export function voiceSaySync(key, params) {
  const msg = t(key, params);
  ttsService.speak(msg);
  return msg;
}

/**
 * Speak pre-localized text without awaiting. Use when the caller already
 * ran t(key, params) (e.g. endSession / lap announcements).
 * @param {string} text - localized message text.
 * @returns {string} same text.
 */
export function voiceSayRaw(text) {
  if (text) ttsService.speak(text);
  return text;
}

/**
 * Play a sound effect, then localize + speak a message and return its text.
 * Covers the engine/DRS/overtake actions that interleave audioService
 * playback with TTS (previously a repeated 4-line block in useCar).
 * @param {string|null} sound - audioService sound name, or null to skip.
 * @param {string} key - i18n message key.
 * @param {object} [params] - interpolation params.
 * @returns {Promise<string>} spoken message.
 */
export async function voiceSayWithSound(sound, key, params) {
  const msg = t(key, params);
  if (sound) await audioService.playSound(sound);
  await ttsService.speak(msg);
  return msg;
}
