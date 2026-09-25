<template>
  <div class="display-item">
    <h2>{{ title }}</h2>
    <p :class="['status', statusClass]">
      <slot />
    </p>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  statusClass: { type: String, default: "info" },
});
</script>

<style scoped>
.display-item h2 {
  color: #c9c9c9;
  font-size: 0.9rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.display-item .status {
  font-size: 1.5rem;
  font-weight: bold;
}
.status.on {
  color: #2ecc40;
}
.status.off {
  color: #ff4136;
}
.status.info {
  color: #ffdc00;
}
.lap-time {
  font-family: monospace;
}
@media (min-width: 1024px) {
  .display-item .status {
    font-size: 1.8rem;
  }
}
</style>
