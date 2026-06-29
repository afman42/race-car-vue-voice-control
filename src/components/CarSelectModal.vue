<template>
  <div v-if="show" class="car-modal-overlay" @click.self="$emit('close')">
    <div class="car-modal" role="dialog" :aria-label="t('ui.carTitle')">
      <h2>{{ t("ui.carTitle") }}</h2>
      <div class="car-grid">
        <button
          v-for="car in cars"
          :key="car.id"
          :class="['car-card', { selected: car.id === selectedId }]"
          @click="$emit('select', car.id)"
        >
          <div class="car-marker-preview" :style="{ background: car.markerColor }"></div>
          <h3>{{ car.label }}</h3>
          <p class="car-desc">{{ car.desc }}</p>
          <div class="car-stats">
            <div class="stat-row">
              <span class="stat-label">{{ t("ui.carSpeed") }}</span>
              <div class="stat-bar">
                <div class="stat-fill" :style="{ width: statPercent(car.stats.speedMul) + '%' }"></div>
              </div>
            </div>
            <div class="stat-row">
              <span class="stat-label">{{ t("ui.carGrip") }}</span>
              <div class="stat-bar">
                <div class="stat-fill" :style="{ width: statPercent(car.stats.gripMul) + '%' }"></div>
              </div>
            </div>
            <div class="stat-row">
              <span class="stat-label">{{ t("ui.carWear") }}</span>
              <div class="stat-bar">
                <div class="stat-fill warn" :style="{ width: statPercent(car.stats.wearMul) + '%' }"></div>
              </div>
            </div>
            <div class="stat-row">
              <span class="stat-label">{{ t("ui.carFuel") }}</span>
              <div class="stat-bar">
                <div class="stat-fill warn" :style="{ width: statPercent(car.stats.fuelMul) + '%' }"></div>
              </div>
            </div>
            <div class="stat-row">
              <span class="stat-label">{{ t("ui.carTempo") }}</span>
              <div class="stat-bar">
                <div class="stat-fill" :style="{ width: statPercent(car.stats.tempoMul) + '%' }"></div>
              </div>
            </div>
          </div>
        </button>
      </div>
      <button class="car-cancel" @click="$emit('close')">
        {{ t("ui.carCancel") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "@/i18n";
import { CAR_PRESETS } from "@/config";

defineProps({
  show: { type: Boolean, default: false },
  selectedId: { type: String, default: "balanced" },
});

defineEmits(["select", "close"]);

const { t } = useI18n();
const cars = CAR_PRESETS;

// Map a multiplier (0.6–1.3) to a 0–100% bar width.
const statPercent = (mul) => Math.round(((mul - 0.5) / 0.9) * 100);
</script>

<style scoped>
.car-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.car-modal {
  background: #1e1e1e;
  border: 2px solid #00ffff;
  border-radius: 15px;
  padding: 1.5rem;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
}
.car-modal h2 {
  color: #00ffff;
  text-align: center;
  text-transform: uppercase;
  font-size: 1.3rem;
  margin-bottom: 1.5rem;
  font-family: "Orbitron", sans-serif;
}
.car-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.car-card {
  background: #2a2a2a;
  border: 2px solid #444;
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  text-align: center;
  font-family: "Orbitron", sans-serif;
  color: #e0e0e0;
}
.car-card:hover {
  border-color: #00ffff;
  background: #333;
}
.car-card.selected {
  border-color: #00ffff;
  background: rgba(0, 255, 255, 0.08);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.3);
}
.car-marker-preview {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin: 0 auto 0.5rem;
  filter: drop-shadow(0 0 4px currentColor);
}
.car-card h3 {
  color: #00ffff;
  font-size: 1rem;
  margin-bottom: 0.3rem;
}
.car-desc {
  font-size: 0.7rem;
  color: #aaa;
  margin-bottom: 0.75rem;
  min-height: 2.5em;
  line-height: 1.3;
}
.car-stats {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
}
.stat-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.stat-label {
  font-size: 0.6rem;
  color: #888;
  width: 60px;
  flex-shrink: 0;
  text-transform: uppercase;
}
.stat-bar {
  flex: 1;
  height: 6px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
}
.stat-fill {
  height: 100%;
  background: #2ecc40;
  border-radius: 3px;
  transition: width 0.3s;
}
.stat-fill.warn {
  background: #ff851b;
}
.car-cancel {
  display: block;
  width: 100%;
  padding: 10px;
  font-family: "Orbitron", sans-serif;
  font-size: 0.9rem;
  color: #e0e0e0;
  background: #333;
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.car-cancel:hover {
  background: #3a3a3a;
  border-color: #ff4136;
  color: #ff4136;
}
</style>
