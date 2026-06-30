<template>
  <div class="manual-controls">
    <h3>{{ t("ui.manualControls") }}</h3>
    <div class="button-grid">
      <button
        v-for="ctrl in manualControls"
        :key="ctrl.command"
        class="ctrl-button"
        :class="{ 'active-difficulty': ctrl.command === activeAiCommand }"
        @click="$emit('command', ctrl.command)"
      >
        {{ t(ctrl.labelKey) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "@/i18n";

defineProps({
  activeAiCommand: { type: String, default: null },
});

defineEmits(["command"]);

const { t } = useI18n();

const manualControls = [
  { labelKey: "btn.startEngine", command: "startEngine" },
  { labelKey: "btn.stopEngine", command: "stopEngine" },
  { labelKey: "btn.drsOn", command: "activateDrs" },
  { labelKey: "btn.drsOff", command: "deactivateDrs" },
  { labelKey: "btn.overtake", command: "overtake" },
  { labelKey: "btn.pitStop", command: "pitStop" },
  { labelKey: "btn.mixLean", command: "fuelMixLean" },
  { labelKey: "btn.mixStandard", command: "fuelMixStandard" },
  { labelKey: "btn.mixRich", command: "fuelMixRich" },
  { labelKey: "btn.ersHotlap", command: "ersHotlap" },
  { labelKey: "btn.ersBalanced", command: "ersBalanced" },
  { labelKey: "btn.ersCharge", command: "ersCharge" },
  { labelKey: "btn.tireSoft", command: "tireSoft" },
  { labelKey: "btn.tireMedium", command: "tireMedium" },
  { labelKey: "btn.tireHard", command: "tireHard" },
  { labelKey: "btn.lapStatus", command: "lapStatus" },
  { labelKey: "btn.position", command: "position" },
  { labelKey: "btn.tempStatus", command: "tempStatus" },
  { labelKey: "btn.fuelStatus", command: "fuelStatus" },
  { labelKey: "btn.batteryStatus", command: "batteryStatus" },
  { labelKey: "btn.weatherStatus", command: "weatherStatus" },
  { labelKey: "btn.bestLap", command: "bestLap" },
  { labelKey: "btn.tireTempStatus", command: "tireTempStatus" },
  { labelKey: "btn.pitWindowStatus", command: "pitWindowStatus" },
  { labelKey: "btn.damageStatus", command: "damageStatus" },
  { labelKey: "btn.weatherDry", command: "weatherDry" },
  { labelKey: "btn.weatherCloudy", command: "weatherCloudy" },
  { labelKey: "btn.weatherWet", command: "weatherWet" },
  { labelKey: "btn.weatherStorm", command: "weatherStorm" },
  { labelKey: "btn.aiEasy", command: "aiEasy" },
  { labelKey: "btn.aiMedium", command: "aiMedium" },
  { labelKey: "btn.aiHard", command: "aiHard" },
  { labelKey: "btn.aiRandom", command: "aiRandom" },
  { labelKey: "btn.aiOff", command: "aiOff" },
  { labelKey: "btn.carSpeedster", command: "carSpeedster" },
  { labelKey: "btn.carBalanced", command: "carBalanced" },
  { labelKey: "btn.carGripmaster", command: "carGripmaster" },
  { labelKey: "btn.carEndurance", command: "carEndurance" },
  { labelKey: "btn.qualiStart", command: "startQualifying" },
  { labelKey: "btn.qualiStatus", command: "qualifyingStatus" },
  { labelKey: "btn.qualiBest", command: "qualifyingBest" },
  { labelKey: "btn.reset", command: "reset" },
];
</script>

<style scoped>
.manual-controls {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
}
.manual-controls h3 {
  color: #aaa;
  font-size: 0.9rem;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 1rem;
}
.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.5rem;
}
.ctrl-button {
  padding: 8px;
  font-size: 0.8rem;
  font-family: "Orbitron", sans-serif;
  color: #e0e0e0;
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}
.ctrl-button:hover {
  background-color: #333;
  border-color: #00ffff;
  color: #00ffff;
}
.ctrl-button.active-difficulty {
  border-color: #ff851b;
  background-color: rgba(255, 133, 27, 0.15);
  color: #ff851b;
}
</style>
