<template>
  <div
    v-if="entries.length"
    class="leaderboard"
    :class="{ 'ai-board': aiBoard }"
    role="region"
    :aria-label="title"
  >
    <h3>{{ title }}</h3>
    <ol>
      <li v-for="(entry, index) in entries" :key="`${entry.lap}-${index}`">
        <span class="lb-rank">{{ index + 1 }}</span>
        <span class="lb-lap">{{ t("ui.lapShort", { lap: entry.lap }) }}</span>
        <span class="lb-time">{{ formatLapTime(entry.time) }}</span>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { useI18n } from "@/i18n";
import { formatLapTime } from "@/utils/formatLapTime";

defineProps({
  entries: { type: Array, default: () => [] },
  title: { type: String, required: true },
  aiBoard: { type: Boolean, default: false },
});

const { t } = useI18n();
</script>

<style scoped>
.leaderboard {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #444;
}
.leaderboard h3 {
  color: #aaa;
  font-size: 0.9rem;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 1rem;
}
.leaderboard ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.leaderboard li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.6rem;
  background-color: #2a2a2a;
  border-radius: 6px;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}
.leaderboard li:first-child {
  border: 1px solid #00ffff;
}
.lb-rank {
  color: #00ffff;
  font-weight: bold;
  width: 1.5rem;
  text-align: center;
}
.lb-lap {
  color: #aaa;
  flex: 1;
}
.lb-time {
  color: #ffdc00;
  font-family: monospace;
}
.ai-board li:first-child {
  border-color: #ff851b;
}
.ai-board .lb-rank {
  color: #ff851b;
}
</style>
