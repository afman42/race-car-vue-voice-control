// src/i18n.js

import { ref, computed } from "vue";

export const SUPPORTED_LOCALES = {
  en: { label: "English", speechLang: "en-US" },
  id: { label: "Bahasa Indonesia", speechLang: "id-ID" },
};

const STORAGE_KEY = "race-control-locale";

const detectInitialLocale = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES[saved]) return saved;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const short = navigator.language.slice(0, 2).toLowerCase();
    if (SUPPORTED_LOCALES[short]) return short;
  }
  return "en";
};

// Shared reactive locale (singleton across the app).
const locale = ref(detectInitialLocale());

// --- MESSAGE DICTIONARIES ---
// Values may be functions receiving a params object for interpolation.
const messages = {
  en: {
    // UI labels
    "ui.title": "Race Car Voice Control",
    "ui.openRadio": "Open Radio Channel",
    "ui.stopRadio": "Stop Radio",
    "ui.radioOpen": "Radio Open: Listening...",
    "ui.radioClosed": "Radio Channel Closed",
    "ui.language": "Language",
    "ui.manualControls": "Manual Controls",
    "ui.lastCommand": "Last Command Heard:",
    "ui.lap": ({ lap, total }) => `Lap ${lap} / ${total}`,
    "ui.raceComplete": "Race Complete",
    "ui.engine": "Engine",
    "ui.drs": "DRS",
    "ui.overtake": "Overtake",
    "ui.tires": "Tires",
    "ui.fuelLevel": "Fuel Level",
    "ui.battery": "Battery",
    "ui.fuelMix": "Fuel Mix",
    "ui.ersMode": "ERS Mode",
    "ui.engineTemp": "Engine Temp",
    "ui.on": "ON",
    "ui.off": "OFF",
    "ui.enabled": "ENABLED",
    "ui.disabled": "DISABLED",
    "ui.active": "ACTIVE",
    "ui.ready": "READY",
    // Manual control button labels
    "btn.startEngine": "Start Engine",
    "btn.stopEngine": "Stop Engine",
    "btn.drsOn": "DRS On",
    "btn.drsOff": "DRS Off",
    "btn.overtake": "Overtake",
    "btn.pitStop": "Pit Stop",
    "btn.mixLean": "Mix Lean",
    "btn.mixStandard": "Mix Standard",
    "btn.mixRich": "Mix Rich",
    "btn.ersHotlap": "ERS Hotlap",
    "btn.ersBalanced": "ERS Balanced",
    "btn.ersCharge": "ERS Charge",
    "btn.tireSoft": "Soft Tires",
    "btn.tireMedium": "Medium Tires",
    "btn.tireHard": "Hard Tires",
    "btn.lapStatus": "Lap Status",
    "btn.tempStatus": "Temp Status",
    "btn.reset": "Reset",
    // Spoken / status messages
    "msg.engineAlreadyRunning": "The engine is already running.",
    "msg.tankEmpty": "Cannot start engine. The fuel tank is empty.",
    "msg.engineStarted": "Engine started.",
    "msg.engineAlreadyOff": "The engine is already off.",
    "msg.engineStopped": "Engine stopped.",
    "msg.drsEngineOff": "Cannot activate DRS. The engine is off.",
    "msg.drsAlreadyActive": "DRS is already active.",
    "msg.drsEnabled": "DRS enabled.",
    "msg.drsAlreadyDisabled": "DRS is already disabled.",
    "msg.drsDisabled": "DRS disabled.",
    "msg.overtakeAlreadyActive": "Overtake is already active.",
    "msg.overtakeEngineOff": "Cannot activate overtake, engine is off.",
    "msg.overtakeOverheating":
      "Cannot activate overtake, engine is overheating.",
    "msg.overtakeLowBattery": "Not enough battery for overtake.",
    "msg.overtakeActivated": "Overtake mode activated.",
    "msg.overtakeFinished": "Overtake finished.",
    "msg.unknownFuelMix": ({ mode }) => `Unknown fuel mix: ${mode}.`,
    "msg.fuelMixSet": ({ label }) => `Fuel mix set to ${label}.`,
    "msg.unknownErsMode": ({ mode }) => `Unknown ERS mode: ${mode}.`,
    "msg.ersModeSet": ({ label }) => `ERS mode set to ${label}.`,
    "msg.unknownCompound": ({ compound }) =>
      `Unknown tire compound: ${compound}.`,
    "msg.compoundPitFirst": "Pit the car before changing tire compound.",
    "msg.compoundFitted": ({ label }) => `${label} tires fitted.`,
    "msg.tireStatus": ({ compound, status, life }) =>
      `${compound} tires are ${status} at ${life} percent.`,
    "msg.fuelStatus": ({ level }) => `Fuel level is at ${level} percent.`,
    "msg.batteryCritical": ({ level }) =>
      `Battery level critical at ${level} percent.`,
    "msg.batteryStatus": ({ level }) => `Battery is at ${level} percent.`,
    "msg.tempStatus": ({ temp, status }) =>
      `Engine temperature is ${temp} degrees, ${status}.`,
    "msg.lapStatus": ({ lap, total }) => `On lap ${lap} of ${total}.`,
    "msg.raceComplete": "Race complete.",
    "msg.help":
      "Available commands: start engine, stop engine, D R S, overtake, " +
      "fuel mix, E R S mode, tire compound, pit stop, lap status, " +
      "temperature, fuel, battery, and reset.",
    "msg.pitComplete": "Pit stop complete. Car serviced.",
    "msg.raceReset": "Race reset. All systems nominal.",
    "msg.warnFuel": "Warning. Fuel level critical.",
    "msg.warnBattery": "Warning. Battery level critical.",
    "msg.warnTemp": "Warning. Engine temperature high.",
    "msg.stalling": "Out of fuel. Engine stalling.",
    "msg.overheatCut": "Engine overheating. Cutting power.",
    "msg.lapAnnounce": ({ lap }) => `Lap ${lap}.`,
    "msg.checkeredFlag": "Checkered flag. Race complete.",
    "msg.notRecognized": ({ transcript }) =>
      `Command not recognized: "${transcript}". Please repeat.`,
    // Status words used inside spoken sentences
    "status.cold": "cold",
    "status.optimal": "optimal",
    "status.used": "used",
    "status.worn": "worn",
    "status.hot": "hot",
    "status.critical": "critical",
    // Speech recognition errors
    "err.micDenied": "Error: Microphone access denied.",
    "err.notSupported": "Error: Speech recognition not supported.",
    "err.noSpeech": "Copy that, standing by.",
    "err.network": "Network error with radio signal.",
    "err.unknown": "An unknown error occurred.",
  },
  id: {
    // UI labels
    "ui.title": "Kendali Suara Mobil Balap",
    "ui.openRadio": "Buka Saluran Radio",
    "ui.stopRadio": "Hentikan Radio",
    "ui.radioOpen": "Radio Aktif: Mendengarkan...",
    "ui.radioClosed": "Saluran Radio Ditutup",
    "ui.language": "Bahasa",
    "ui.manualControls": "Kontrol Manual",
    "ui.lastCommand": "Perintah Terakhir:",
    "ui.lap": ({ lap, total }) => `Lap ${lap} / ${total}`,
    "ui.raceComplete": "Balapan Selesai",
    "ui.engine": "Mesin",
    "ui.drs": "DRS",
    "ui.overtake": "Salip",
    "ui.tires": "Ban",
    "ui.fuelLevel": "Bahan Bakar",
    "ui.battery": "Baterai",
    "ui.fuelMix": "Campuran BBM",
    "ui.ersMode": "Mode ERS",
    "ui.engineTemp": "Suhu Mesin",
    "ui.on": "HIDUP",
    "ui.off": "MATI",
    "ui.enabled": "AKTIF",
    "ui.disabled": "NONAKTIF",
    "ui.active": "AKTIF",
    "ui.ready": "SIAP",
    // Manual control button labels
    "btn.startEngine": "Nyalakan Mesin",
    "btn.stopEngine": "Matikan Mesin",
    "btn.drsOn": "DRS Nyala",
    "btn.drsOff": "DRS Mati",
    "btn.overtake": "Salip",
    "btn.pitStop": "Pit Stop",
    "btn.mixLean": "Campuran Irit",
    "btn.mixStandard": "Campuran Standar",
    "btn.mixRich": "Campuran Kaya",
    "btn.ersHotlap": "ERS Hotlap",
    "btn.ersBalanced": "ERS Seimbang",
    "btn.ersCharge": "ERS Isi",
    "btn.tireSoft": "Ban Lunak",
    "btn.tireMedium": "Ban Sedang",
    "btn.tireHard": "Ban Keras",
    "btn.lapStatus": "Status Lap",
    "btn.tempStatus": "Status Suhu",
    "btn.reset": "Atur Ulang",
    // Spoken / status messages
    "msg.engineAlreadyRunning": "Mesin sudah menyala.",
    "msg.tankEmpty": "Tidak bisa menyalakan mesin. Tangki bahan bakar kosong.",
    "msg.engineStarted": "Mesin dinyalakan.",
    "msg.engineAlreadyOff": "Mesin sudah mati.",
    "msg.engineStopped": "Mesin dimatikan.",
    "msg.drsEngineOff": "Tidak bisa mengaktifkan DRS. Mesin mati.",
    "msg.drsAlreadyActive": "DRS sudah aktif.",
    "msg.drsEnabled": "DRS diaktifkan.",
    "msg.drsAlreadyDisabled": "DRS sudah nonaktif.",
    "msg.drsDisabled": "DRS dinonaktifkan.",
    "msg.overtakeAlreadyActive": "Mode salip sudah aktif.",
    "msg.overtakeEngineOff": "Tidak bisa mengaktifkan salip, mesin mati.",
    "msg.overtakeOverheating":
      "Tidak bisa mengaktifkan salip, mesin terlalu panas.",
    "msg.overtakeLowBattery": "Baterai tidak cukup untuk menyalip.",
    "msg.overtakeActivated": "Mode salip diaktifkan.",
    "msg.overtakeFinished": "Mode salip selesai.",
    "msg.unknownFuelMix": ({ mode }) => `Campuran bahan bakar tidak dikenal: ${mode}.`,
    "msg.fuelMixSet": ({ label }) => `Campuran bahan bakar diatur ke ${label}.`,
    "msg.unknownErsMode": ({ mode }) => `Mode ERS tidak dikenal: ${mode}.`,
    "msg.ersModeSet": ({ label }) => `Mode ERS diatur ke ${label}.`,
    "msg.unknownCompound": ({ compound }) =>
      `Jenis ban tidak dikenal: ${compound}.`,
    "msg.compoundPitFirst": "Masuk pit dulu sebelum mengganti jenis ban.",
    "msg.compoundFitted": ({ label }) => `Ban ${label} dipasang.`,
    "msg.tireStatus": ({ compound, status, life }) =>
      `Ban ${compound} dalam kondisi ${status} di ${life} persen.`,
    "msg.fuelStatus": ({ level }) => `Bahan bakar berada di ${level} persen.`,
    "msg.batteryCritical": ({ level }) =>
      `Baterai kritis di ${level} persen.`,
    "msg.batteryStatus": ({ level }) => `Baterai di ${level} persen.`,
    "msg.tempStatus": ({ temp, status }) =>
      `Suhu mesin ${temp} derajat, ${status}.`,
    "msg.lapStatus": ({ lap, total }) => `Lap ${lap} dari ${total}.`,
    "msg.raceComplete": "Balapan selesai.",
    "msg.help":
      "Perintah tersedia: nyalakan mesin, matikan mesin, D R S, salip, " +
      "campuran bahan bakar, mode E R S, jenis ban, pit stop, status lap, " +
      "suhu, bahan bakar, baterai, dan atur ulang.",
    "msg.pitComplete": "Pit stop selesai. Mobil telah diservis.",
    "msg.raceReset": "Balapan diatur ulang. Semua sistem normal.",
    "msg.warnFuel": "Peringatan. Bahan bakar kritis.",
    "msg.warnBattery": "Peringatan. Baterai kritis.",
    "msg.warnTemp": "Peringatan. Suhu mesin tinggi.",
    "msg.stalling": "Kehabisan bahan bakar. Mesin mati.",
    "msg.overheatCut": "Mesin terlalu panas. Memotong tenaga.",
    "msg.lapAnnounce": ({ lap }) => `Lap ${lap}.`,
    "msg.checkeredFlag": "Bendera kotak-kotak. Balapan selesai.",
    "msg.notRecognized": ({ transcript }) =>
      `Perintah tidak dikenal: "${transcript}". Mohon ulangi.`,
    // Status words used inside spoken sentences
    "status.cold": "dingin",
    "status.optimal": "optimal",
    "status.used": "terpakai",
    "status.worn": "aus",
    "status.hot": "panas",
    "status.critical": "kritis",
    // Speech recognition errors
    "err.micDenied": "Kesalahan: Akses mikrofon ditolak.",
    "err.notSupported": "Kesalahan: Pengenalan suara tidak didukung.",
    "err.noSpeech": "Diterima, menunggu.",
    "err.network": "Kesalahan jaringan pada sinyal radio.",
    "err.unknown": "Terjadi kesalahan yang tidak diketahui.",
  },
};

/**
 * Translate a key for the current locale, with optional interpolation params.
 * Falls back to English, then to the key itself.
 * @param {string} key
 * @param {object} [params]
 * @returns {string}
 */
export function t(key, params) {
  const dict = messages[locale.value] || messages.en;
  const entry = dict[key] ?? messages.en[key];
  if (entry === undefined) return key;
  return typeof entry === "function" ? entry(params || {}) : entry;
}

/**
 * Change the active locale. Persists to localStorage when available.
 * @param {string} next - a supported locale code.
 */
export function setLocale(next) {
  if (!SUPPORTED_LOCALES[next]) return;
  locale.value = next;
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
}

export function useI18n() {
  return {
    locale,
    speechLang: computed(
      () => SUPPORTED_LOCALES[locale.value]?.speechLang || "en-US",
    ),
    t,
    setLocale,
    SUPPORTED_LOCALES,
  };
}
