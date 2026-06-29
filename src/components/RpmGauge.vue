<template>
  <div class="gauge-container">
    <svg
      class="rpm-gauge"
      viewBox="0 0 100 57"
      role="img"
      :aria-label="`Engine RPM ${rpm.toFixed(0)}`"
    >
      <path class="gauge-bg" d="M10 50 A 40 40 0 0 1 90 50"></path>
      <path
        class="gauge-needle"
        d="M10 50 A 40 40 0 0 1 90 50"
        ref="gaugeNeedlePath"
        :style="{
          strokeDasharray: gaugeCircumference,
          strokeDashoffset: rpmNeedleOffset,
        }"
      ></path>
      <text x="50" y="45" class="rpm-text">{{ rpm.toFixed(0) }}</text>
      <text x="50" y="55" class="rpm-label">RPM</text>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { CAR_SETTINGS } from "@/config";

const props = defineProps({
  rpm: { type: Number, required: true },
});

const gaugeNeedlePath = ref(null);
const gaugeCircumference = ref(0);

onMounted(() => {
  if (
    gaugeNeedlePath.value &&
    typeof gaugeNeedlePath.value.getTotalLength === "function"
  ) {
    gaugeCircumference.value = gaugeNeedlePath.value.getTotalLength();
  }
});

const rpmNeedleOffset = computed(() => {
  if (gaugeCircumference.value === 0) return gaugeCircumference.value;
  const rpmPercentage = props.rpm / CAR_SETTINGS.RPM_MAX;
  return gaugeCircumference.value * (1 - rpmPercentage);
});
</script>

<style scoped>
.gauge-container {
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
}
.rpm-gauge {
  width: 220px;
  transform: rotateX(180deg);
}
.gauge-bg,
.gauge-needle {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}
.gauge-bg {
  stroke: #333;
}
.gauge-needle {
  stroke: #00ffff;
  transition: stroke-dashoffset 0.8s cubic-bezier(0.6, 0, 0.2, 1);
}
.rpm-text,
.rpm-label {
  font-family: "Orbitron", sans-serif;
  text-anchor: middle;
  transform: rotateX(180deg);
}
.rpm-text {
  fill: #fff;
  font-size: 20px;
  font-weight: bold;
}
.rpm-label {
  fill: #888;
  font-size: 8px;
}
@media (min-width: 768px) {
  .rpm-gauge {
    width: 250px;
  }
}
@media (min-width: 1024px) {
  .rpm-gauge {
    width: 300px;
  }
}
</style>
