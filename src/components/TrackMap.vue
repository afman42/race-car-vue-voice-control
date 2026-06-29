<template>
  <div class="track-map">
    <h3 class="visually-hidden">{{ t("ui.trackMap") }}</h3>
    <svg
      class="track-svg"
      viewBox="0 0 100 60"
      role="img"
      :aria-label="ariaLabel"
    >
      <path
        class="track-path"
        ref="trackPath"
        d="M 20 10 H 80 A 20 20 0 0 1 80 50 H 20 A 20 20 0 0 1 20 10 Z"
      ></path>
      <circle
        v-for="(m, i) in segmentMarkers"
        :key="`seg-${i}`"
        :cx="m.x"
        :cy="m.y"
        r="2.5"
        :class="[
          'seg-boundary',
          m.isCorner ? 'corner' : 'straight',
          m.speed ? `speed-${m.speed}` : '',
        ]"
      ></circle>
      <line
        class="start-finish"
        :x1="segmentMarkers.length > 0 ? segmentMarkers[0].x : 20"
        :y1="segmentMarkers.length > 0 ? segmentMarkers[0].y - 4 : 10"
        :x2="segmentMarkers.length > 0 ? segmentMarkers[0].x : 20"
        :y2="segmentMarkers.length > 0 ? segmentMarkers[0].y + 4 : 18"
      />
      <circle
        class="track-marker player"
        :cx="playerMarker.x"
        :cy="playerMarker.y"
        r="4"
      ></circle>
      <circle
        v-if="aiEnabled"
        class="track-marker rival"
        :cx="rivalMarker.x"
        :cy="rivalMarker.y"
        r="4"
      ></circle>
      <g class="map-legend">
        <circle cx="75" cy="7" r="2" class="legend-dot dot-straight" />
        <text x="79" y="10" class="legend-label">{{ t("ui.segStraight") }}</text>
        <circle cx="75" cy="15" r="2" class="legend-dot dot-corner-slow" />
        <text x="79" y="18" class="legend-label">{{ t("ui.segCornerSlow") }}</text>
        <circle cx="75" cy="23" r="2" class="legend-dot dot-corner-medium" />
        <text x="79" y="26" class="legend-label">{{ t("ui.segCornerMedium") }}</text>
        <circle cx="75" cy="31" r="2" class="legend-dot dot-corner-fast" />
        <text x="79" y="34" class="legend-label">{{ t("ui.segCornerFast") }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { CAR_SETTINGS } from "@/config";
import { useI18n } from "@/i18n";

const props = defineProps({
  playerLoopPos: { type: Number, required: true },
  rivalLoopPos: { type: Number, required: true },
  aiEnabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: "" },
});

const { t } = useI18n();

const trackPath = ref(null);
const trackLength = ref(0);

onMounted(() => {
  if (
    trackPath.value &&
    typeof trackPath.value.getTotalLength === "function"
  ) {
    trackLength.value = trackPath.value.getTotalLength();
  }
});

const pointAt = (fraction) => {
  const path = trackPath.value;
  if (
    !path ||
    trackLength.value === 0 ||
    typeof path.getPointAtLength !== "function"
  ) {
    return { x: 50, y: 10 };
  }
  const pt = path.getPointAtLength(fraction * trackLength.value);
  return { x: pt.x, y: pt.y };
};

const playerMarker = computed(() => pointAt(props.playerLoopPos));
const rivalMarker = computed(() => pointAt(props.rivalLoopPos));

const segmentBoundaries = computed(() => {
  let accumulated = 0;
  const boundaries = [];
  for (const seg of CAR_SETTINGS.TRACK_LAYOUT) {
    accumulated += seg.length;
    boundaries.push(accumulated / CAR_SETTINGS.LAP_DISTANCE);
  }
  return boundaries;
});

const segmentMarkers = computed(() => {
  return segmentBoundaries.value.map((frac, i) => {
    const seg = CAR_SETTINGS.TRACK_LAYOUT[i % CAR_SETTINGS.TRACK_LAYOUT.length];
    const isCorner = seg.type === "corner";
    return {
      frac,
      x: pointAt(frac).x,
      y: pointAt(frac).y,
      isCorner,
      speed: seg.speed || null,
    };
  });
});
</script>

<style scoped>
.track-map {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
  position: relative;
}
.track-svg {
  width: 70%;
  max-width: 280px;
}
.track-path {
  fill: none;
  stroke: #333;
  stroke-width: 3;
  stroke-linecap: round;
}
.track-marker {
  transition:
    cx 0.4s linear,
    cy 0.4s linear;
}
.track-marker.player {
  fill: #00ffff;
  filter: drop-shadow(0 0 3px #00ffff);
}
.track-marker.rival {
  fill: #ff851b;
  filter: drop-shadow(0 0 3px #ff851b);
}
.seg-boundary {
  stroke-width: 0;
}
.seg-boundary.straight {
  fill: #2ecc40;
}
.seg-boundary.corner.speed-slow {
  fill: #ff4136;
}
.seg-boundary.corner.speed-medium {
  fill: #ffdc00;
}
.seg-boundary.corner.speed-fast {
  fill: #ff851b;
}
.start-finish {
  stroke: #fff;
  stroke-width: 1.2;
  stroke-dasharray: 2 2;
  opacity: 0.7;
}
.map-legend {
  opacity: 0;
  transition: opacity 0.3s;
}
.track-svg:hover .map-legend {
  opacity: 0.8;
}
.legend-label {
  fill: #ccc;
  font-size: 2.5px;
  font-family: "Orbitron", sans-serif;
}
.legend-dot {
  stroke: none;
}
.legend-dot.dot-straight {
  fill: #2ecc40;
}
.legend-dot.dot-corner-slow {
  fill: #ff4136;
}
.legend-dot.dot-corner-medium {
  fill: #ffdc00;
}
.legend-dot.dot-corner-fast {
  fill: #ff851b;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
