<template>
  <div class="race-control-panel">
    <div class="header-row">
      <h1>{{ t("ui.title") }}</h1>
      <label class="lang-select">
        <span class="visually-hidden">{{ t("ui.language") }}</span>
        <select
          :value="locale"
          @change="onLocaleChange"
          :aria-label="t('ui.language')"
        >
          <option
            v-for="(meta, code) in SUPPORTED_LOCALES"
            :key="code"
            :value="code"
          >
            {{ meta.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="status-panel">
      <div
        :class="['light', { active: isListening }]"
        role="status"
        :aria-label="isListening ? t('ui.radioOpen') : t('ui.radioClosed')"
      ></div>
      <p class="status-text" role="status" aria-live="polite">
        {{ statusMessage }}
      </p>
    </div>

    <button
      @click="toggleListening"
      class="control-button"
      :aria-pressed="isListening"
    >
      {{ isListening ? t("ui.stopRadio") : t("ui.openRadio") }}
    </button>

    <button
      @click="showCarModal = true"
      class="car-select-button"
      :disabled="engineStatus"
    >
      {{ selectedCar.label }} ▸ {{ t("ui.selectCar") }}
    </button>

    <CarSelectModal
      :show="showCarModal"
      :selected-id="selectedCar.id"
      @select="onCarSelect"
      @close="showCarModal = false"
    />

    <div class="lap-banner" role="status" aria-live="polite">
      <span v-if="raceMode === 'qualifying' && !raceFinished" class="quali-badge">
        {{ t("ui.qualiMode") }} ·
        {{ t("ui.qualiLapsRemaining", { remaining: qualifyingLapsRemaining }) }}
      </span>
      <span v-else-if="raceMode === 'qualifying' && raceFinished" class="quali-badge">
        {{ t("ui.qualiMode") }} · {{ t("ui.raceComplete") }}
      </span>
      <span v-else-if="pitting">{{ t("ui.pitting") }}</span>
      <span v-else-if="raceFinished">{{ t("ui.raceComplete") }}</span>
      <span v-else>{{
        t("ui.lap", { lap: currentLap, total: CAR_SETTINGS.TOTAL_LAPS })
      }}</span>
    </div>

    <div class="position-badge" role="status" aria-live="polite">
      <span class="pos-label">{{ t("ui.position") }}</span>
      <span class="pos-value">{{ positionLabel }}</span>
      <span class="pos-gap">{{ gapText }}</span>
    </div>

    <!-- Qualifying grid position overlay when session ends -->
    <div
      v-if="raceMode === 'qualifying' && raceFinished"
      class="quali-grid-display"
      role="status"
      aria-live="assertive"
    >
      <span class="quali-grid-label">{{ t("ui.qualiGrid") }}</span>
      <span class="quali-grid-pos">P{{ qualifyingPosition }}</span>
      <div class="quali-grid-times">
        <div class="quali-grid-row player">
          <span class="qg-name">You</span>
          <span class="qg-time">{{ formatLapTime(qualifyingBestLap) }}</span>
        </div>
        <div v-if="aiQualifyingBestLap !== null" class="quali-grid-row rival">
          <span class="qg-name">Rival</span>
          <span class="qg-time">{{ formatLapTime(aiQualifyingBestLap) }}</span>
        </div>
      </div>
    </div>

    <TrackMap
      :player-loop-pos="playerLoopPos"
      :rival-loop-pos="rivalLoopPos"
      :ai-enabled="aiEnabled"
      :aria-label="trackAriaLabel"
    />

    <RpmGauge :rpm="rpm" />

    <div class="dashboard">
      <div class="display-item">
        <h2>{{ t("ui.engine") }}</h2>
        <p :class="['status', engineStatus ? 'on' : 'off']">
          {{ engineStatus ? t("ui.on") : t("ui.off") }}
        </p>
      </div>
      <div class="display-item gear-display">
        <h2>{{ t("ui.gear") }}</h2>
        <div class="gear-indicator" :class="{ shifting: gearFlash }">
          <span class="gear-number" :class="currentGear > 0 ? 'engaged' : 'neutral'">
            {{ currentGear > 0 ? currentGear : 'N' }}
          </span>
        </div>
        <div class="shift-lights">
          <span
            v-for="i in 5"
            :key="i"
            class="shift-led"
            :class="{
              active: rpm > CAR_SETTINGS.GEAR_DROP_RPM - 200 + (i - 1) * 600,
              blink: rpm >= CAR_SETTINGS.GEAR_SHIFT_RPM - 200 && rpm < CAR_SETTINGS.GEAR_SHIFT_RPM,
              shift: rpm >= CAR_SETTINGS.GEAR_SHIFT_RPM,
            }"
          ></span>
        </div>
      </div>
      <div class="display-item segment-display">
        <h2>{{ t("ui.segment") }}</h2>
        <p
          class="segment-badge"
          :class="[
            currentSegmentType,
            currentSegmentSpeed ? `speed-${currentSegmentSpeed}` : '',
          ]"
        >
          {{ currentSegmentLabel }}
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.drs") }}</h2>
        <p :class="['status', drsStatus ? 'on' : 'off']">
          {{ drsStatus ? t("ui.enabled") : t("ui.disabled") }}
        </p>
        <p
          v-if="aiEnabled && !drsStatus"
          class="drs-zone-indicator"
          :class="drsEligible ? 'eligible' : 'ineligible'"
        >
          {{ drsEligible ? t('ui.drsEligible') : t('ui.drsNotEligible') }}
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.overtake") }}</h2>
        <p :class="['status', overtakeActive ? 'on' : 'off']">
          {{ overtakeActive ? t("ui.active") : t("ui.ready") }}
        </p>
        <div
          v-if="overtakeActive"
          class="countdown-bar"
          role="progressbar"
          :aria-valuenow="Math.round(overtakeRemaining)"
          aria-valuemin="0"
          :aria-valuemax="100"
          :aria-label="t('ui.overtake')"
        >
          <div
            class="countdown-fill"
            :style="{ width: `${overtakeRemaining}%` }"
          ></div>
        </div>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.tires") }}</h2>
        <p class="status info">
          {{ tireCompound }} - {{ tireStatus }} ({{ tireLife.toFixed(0) }}%)
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.fuelLevel") }}</h2>
        <p :class="['status', isLowFuel ? 'off' : 'info']">
          {{ fuelLevel.toFixed(1) }}%
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.battery") }}</h2>
        <p :class="['status', !isLowBattery ? 'on' : 'off']">
          {{ batteryLevel.toFixed(1) }}%
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.fuelMix") }}</h2>
        <p class="status info">{{ fuelMix }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.ersMode") }}</h2>
        <p class="status info">{{ ersMode }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.speed") }}</h2>
        <p class="status on">{{ speedKmh }} <span class="unit-label">km/h</span></p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.currentLapTime") }}</h2>
        <p class="status info lap-time">{{ formatLapTime(currentLapTime) }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.engineTemp") }}</h2>
        <p
          :class="[
            'status',
            tempStatus === 'Critical'
              ? 'off'
              : tempStatus === 'Hot'
                ? 'info'
                : 'on',
          ]"
        >
          {{ engineTemp.toFixed(0) }}&deg;C
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.weather") }}</h2>
        <p class="status info">{{ weather }}</p>
      </div>
      <!-- Tire Temperature tile -->
      <div class="display-item">
        <h2>{{ t("ui.tireTemp") }}</h2>
        <p
          :class="[
            'status',
            tireTempDisplayStatus === 'Overheated' || tireTempDisplayStatus === 'Hot'
              ? 'off'
              : tireTempDisplayStatus === 'Cold'
                ? 'info'
                : 'on',
          ]"
        >
          {{ tireTemp.toFixed(0) }}&deg;C
        </p>
      </div>
      <!-- Pit Window tile -->
      <div
        v-if="pitWindowInfo"
        class="display-item pit-window-tile"
        :class="{ urgent: pitWindowUrgent }"
      >
        <h2>{{ t("ui.pitWindow") }}</h2>
        <p :class="['status', pitWindowUrgent ? 'off' : 'info']">
          <template v-if="pitWindowUrgent">
            {{ t("ui.boxNow") }}
          </template>
          <template v-else>
            {{ t("ui.pitLap", { lap: pitWindowInfo.startLap }) }}
          </template>
        </p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.damage") }}</h2>
        <p
          :class="[
            'status',
            damageStatus === 'Critical' || damageStatus === 'Major'
              ? 'off'
              : damageStatus === 'Minor'
                ? 'info'
                : 'on',
          ]"
        >
          {{ carDamage.toFixed(0) }}%
        </p>
      </div>
      <div class="display-item car-tile" :style="{ borderColor: selectedCar.markerColor }">
        <h2>{{ t("ui.selectCar") }}</h2>
        <p class="status info">{{ selectedCar.label }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.lastLap") }}</h2>
        <p class="status info">{{ formatLapTime(lastLapTime) }}</p>
      </div>
      <div class="display-item">
        <h2>{{ t("ui.bestLap") }}</h2>
        <p class="status info">{{ formatLapTime(bestLapTime) }}</p>
      </div>
      <!-- Qualifying best lap tile -->
      <div v-if="raceMode === 'qualifying'" class="display-item quali-tile">
        <h2>{{ t("ui.qualiBestLap") }}</h2>
        <p class="status info">
          {{ formatLapTime(qualifyingBestLap) }}
        </p>
      </div>

      <div class="display-item" :class="{ 'ai-active': aiEnabled }">
        <h2>{{ t("ui.aiRival") }}</h2>
        <p :class="['status', aiEnabled ? 'on' : 'off']">
          <template v-if="aiEnabled">
            {{ aiDifficulty }}
            <span class="ai-sub">
              {{ t("ui.lapShort", { lap: aiCurrentLap }) }} ·
              {{ formatLapTime(aiBestLapTime) }}
            </span>
          </template>
          <template v-else>{{ t("ui.aiOff") }}</template>
        </p>
      </div>
    </div>

    <Leaderboard
      :entries="leaderboard"
      :title="t('ui.leaderboard')"
    />
    <Leaderboard
      v-if="aiEnabled"
      :entries="aiLeaderboard"
      :title="t('ui.aiBoard')"
      ai-board
    />

    <ManualControls
      :active-ai-command="activeAiCommand"
      @command="runCommand"
    />

    <div class="transcript-log">
      <h3>{{ t("ui.lastCommand") }}</h3>
      <p aria-live="polite">{{ lastTranscript }}</p>
    </div>
  </div>
</template>

<script setup>
import { CAR_SETTINGS } from "@/config";
import { useRaceControl } from "@/composables/useRaceControl";
import TrackMap from "./TrackMap.vue";
import RpmGauge from "./RpmGauge.vue";
import Leaderboard from "./Leaderboard.vue";
import ManualControls from "./ManualControls.vue";
import CarSelectModal from "./CarSelectModal.vue";

const {
  engineStatus,
  rpm,
  currentGear,
  drsStatus,
  overtakeActive,
  tireStatus,
  tireLife,
  tireCompound,
  fuelLevel,
  batteryLevel,
  fuelMix,
  ersMode,
  engineTemp,
  tempStatus,
  currentLap,
  lapProgress,
  raceFinished,
  pitting,
  isLowBattery,
  isLowFuel,
  bestLapTime,
  lastLapTime,
  currentLapTime,
  leaderboard,
  weather,
  carDamage,
  damageStatus,
  aiEnabled,
  aiDifficulty,
  aiCurrentLap,
  aiBestLapTime,
  aiLeaderboard,
  playerLoopPos,
  rivalLoopPos,
  speedKmh,
  selectedCar,
  raceMode,
  qualifyingLapsRemaining,
  qualifyingBestLap,
  qualifyingPosition,
  qualifyingInfo,
  aiQualifyingBestLap,
  aiQualifyingFinished,
  tireTemp,
  tireTempDisplayStatus,
  drsEligible,
  pitWindowInfo,
  pitWindowVisible,
  pitWindowUrgent,
  formatLapTime,
  t,
  locale,
  SUPPORTED_LOCALES,
  onLocaleChange,
  isListening,
  statusMessage,
  lastTranscript,
  showCarModal,
  onCarSelect,
  overtakeRemaining,
  activeAiCommand,
  gearFlash,
  currentSegmentType,
  currentSegmentSpeed,
  currentSegmentLabel,
  positionLabel,
  gapText,
  trackAriaLabel,
  runCommand,
  toggleListening,
} = useRaceControl();
</script>

<style src="./RaceControl.css" scoped></style>
