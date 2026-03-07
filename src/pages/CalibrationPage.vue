<template>
  <div class="calibration-page">
    <h1>Calibration</h1>
    
    <!-- Clock Size Selection -->
    <section class="clock-size-section">
      <h2>Select Clock Size</h2>
      <div class="clock-size-buttons">
        <button
          v-for="size in clockSizes"
          :key="size.value"
          :class="['size-button', { active: clockSize === size.value }]"
          @click="selectClockSize(size.value)"
          :disabled="isCalibrating"
        >
          {{ size.label }}
        </button>
      </div>
    </section>

    <!-- Band-Pass Filter Settings -->
    <section class="filter-section">
      <h2>Band-Pass Filter</h2>
      <p class="filter-description">
        Adjust the frequency range used to detect ticks. Disable a cutoff to create
        a high-pass or low-pass filter instead of a band-pass filter.
      </p>
      <div class="filter-controls">
        <div class="filter-field">
          <label for="low-cutoff">Low Cut-off (High-pass)</label>
          <select
            id="low-cutoff"
            v-model.number="lowCutoff"
            :disabled="isCalibrating"
            class="filter-select"
          >
            <option :value="0">Off (no high-pass)</option>
            <option :value="100">100 Hz</option>
            <option :value="200">200 Hz</option>
            <option :value="500">500 Hz</option>
            <option :value="1000">1 kHz</option>
            <option :value="2000">2 kHz</option>
          </select>
        </div>
        <div class="filter-field">
          <label for="high-cutoff">High Cut-off (Low-pass)</label>
          <select
            id="high-cutoff"
            v-model.number="highCutoff"
            :disabled="isCalibrating"
            class="filter-select"
          >
            <option :value="0">Off (no low-pass)</option>
            <option :value="2000">2 kHz</option>
            <option :value="4000">4 kHz</option>
            <option :value="8000">8 kHz</option>
            <option :value="12000">12 kHz</option>
            <option :value="16000">16 kHz</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Input Boost Control -->
    <section class="input-boost-section">
      <h2>Input Boost</h2>
      <p class="input-boost-description">
        Amplify the microphone signal digitally. Increase this if the audio level bar shows
        almost no movement during calibration (common on phones with quiet built-in microphones).
        A value of 1× means no amplification.
      </p>
      <div class="input-boost-control">
        <label for="input-boost">Input Boost</label>
        <select
          id="input-boost"
          v-model.number="inputBoost"
          @change="handleInputBoostChange"
          class="filter-select"
        >
          <option :value="1">1× (no boost)</option>
          <option :value="2">2×</option>
          <option :value="4">4×</option>
          <option :value="8">8×</option>
          <option :value="16">16×</option>
          <option :value="32">32×</option>
        </select>
      </div>
    </section>

    <!-- Calibration Controls -->
    <section class="calibration-controls">
      <button
        v-if="!isCalibrating"
        class="start-button"
        @click="handleStartCalibration"
        :disabled="!canStartCalibration"
      >
        Start Calibration
      </button>
      <button
        v-else
        class="stop-button"
        @click="handleStopCalibration"
      >
        Stop Calibration
      </button>
    </section>

    <!-- Calibration Status -->
    <section class="calibration-status">
      <div v-if="isCalibrating" class="status-active">
        <div class="progress-indicator">
          <div class="spinner"></div>
          <p>Listening for ticks...</p>
        </div>

        <!-- Real-time audio level meter -->
        <div class="audio-level-meter">
          <div class="meter-label">Audio Level</div>
          <div class="meter-bar-track">
            <div
              class="meter-bar-fill"
              :class="{ 'tick-flash': tickFlash, 'level-loud': audioLevel > HIGH_MIC_LEVEL }"
              :style="{ width: audioLevelPercent + '%' }"
            ></div>
            <div
              class="meter-threshold-marker"
              :style="{ left: audioThresholdPercent + '%' }"
              title="Detection threshold"
            ></div>
          </div>
          <div class="meter-hint">
            <span>Quiet</span>
            <span class="threshold-label">▲ Threshold</span>
            <span>Loud</span>
          </div>
        </div>

        <!-- Microphone diagnostic hint -->
        <div v-if="micDiagnosticHint" class="mic-diagnostic-hint">
          {{ micDiagnosticHint }}
        </div>

        <div class="tick-count" :class="{ 'tick-flash': tickFlash }">
          <span class="count-label">Detected Ticks:</span>
          <span class="count-value">{{ calibrationProgress }}</span>
          <span class="count-required">/ {{ minTicksRequired }}</span>
        </div>
      </div>
      
      <div v-if="statusMessage" class="status-message" :class="statusMessageType">
        {{ statusMessage }}
      </div>
    </section>

    <!-- Navigation -->
    <section class="navigation-section">
      <button
        class="nav-button"
        @click="navigateToMeasurement"
        :disabled="!canNavigateToMeasurement"
      >
        Go to Measurement
      </button>
      <button
        class="nav-button secondary"
        @click="navigateToSettings"
      >
        Back to Settings
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCalibration } from '../composables/useCalibration';
import { useAudio } from '../composables/useAudio';
import type { ClockSize, TickEvent } from '../types';

const router = useRouter();

// Composables
const {
  clockSize,
  isCalibrating,
  calibrationProgress,
  hasEnoughSamples,
  isCalibrated,
  sensitivity,
  threshold,
  lowCutoff,
  highCutoff,
  setClockSize,
  startCalibration,
  stopCalibration,
  completeCalibration,
  recordTickSample,
  getExpectedFrequency
} = useCalibration();

const {
  isInitialized,
  permissionGranted,
  onTickDetected,
  onVolumeLevel,
  setCalibration,
  setInputGain,
  initializeWorklet,
  startProcessing,
  stopProcessing
} = useAudio();

// Local state
const statusMessage = ref<string>('');
const statusMessageType = ref<'info' | 'success' | 'warning' | 'error'>('info');
const timeoutId = ref<number | null>(null);
const audioLevel = ref<number>(0);
const audioThreshold = ref<number>(0.08);
const tickFlash = ref<boolean>(false);
let tickFlashTimeoutId: number | null = null;

// Input boost (digital pre-amp gain)
const inputBoost = ref<number>(1);

// Auto-calibration state
let workingThreshold = 0.005;
let workingSensitivity = 1.5;
let autoAdjustIntervalId: number | null = null;
let calibrationStartTime = 0;
let smoothedBackgroundLevel = 0;

// Local state for mic diagnostics
const micDiagnosticHint = ref<string>('');

// Constants
const minTicksRequired = 10;
const calibrationTimeout = 30000; // 30 seconds

// Auto-calibration constants
const CALIBRATION_START_THRESHOLD = 0.005;  // Start sensitive to catch quiet ticks
const CALIBRATION_START_SENSITIVITY = 1.5;  // Start with elevated sensitivity
const AUTO_ADJUST_INTERVAL_MS = 5000;       // Check every 5 seconds
const MIN_THRESHOLD = 0.001;               // Minimum allowed threshold
const MAX_THRESHOLD = 0.5;                 // Maximum allowed threshold (for too-loud case)
const MIN_SENSITIVITY = 0.1;              // Minimum allowed sensitivity (for too-loud case)
const MAX_SENSITIVITY = 2.0;              // Maximum allowed sensitivity
const THRESHOLD_ADJUST_FACTOR = 0.65;     // Reduce threshold by 35% per step (or raise by ÷0.65 ≈ 54%)
const SENSITIVITY_ADJUST_FACTOR = 1.3;    // Increase sensitivity by 30% per step
const TOO_MANY_TICKS_RATIO = 3.0;         // Raise threshold when actual ticks exceed 3× expected

// Auto-boost constants
const MAX_AUTO_BOOST = 16;                 // Never auto-boost beyond 16× to avoid runaway
const AUTO_BOOST_FACTOR = 2;              // Double the gain each step

// Microphone diagnostic thresholds (raw RMS amplitude)
const VERY_LOW_MIC_LEVEL = 0.0005;  // System-level gain too low (typical on phones with quiet mics)
const LOW_MIC_LEVEL = 0.002;        // Mic OK but clock signal is too weak (too far away)
const HIGH_MIC_LEVEL = 0.4;         // Signal too loud (risk of clipping / false positives)

// Clock size options
const clockSizes = [
  { value: 'small' as ClockSize, label: 'Small' },
  { value: 'medium' as ClockSize, label: 'Medium' },
  { value: 'large' as ClockSize, label: 'Large' }
];

// Computed
const canStartCalibration = computed(() => {
  return isInitialized.value && permissionGranted.value && !isCalibrating.value;
});

const canNavigateToMeasurement = computed(() => {
  return isCalibrated.value && !isCalibrating.value;
});

// Audio level bar: scale level to percentage, capped at 100%
// Use a non-linear scale so small signals are still visible
const audioLevelPercent = computed(() => {
  if (audioLevel.value <= 0) return 0;
  // Convert to dB-like scale: amplify small values
  const scaled = Math.min(1, audioLevel.value * 20);
  return Math.round(scaled * 100);
});

const audioThresholdPercent = computed(() => {
  if (audioThreshold.value <= 0) return 0;
  const scaled = Math.min(1, audioThreshold.value * 20);
  return Math.round(scaled * 100);
});

// Methods
const selectClockSize = (size: ClockSize) => {
  setClockSize(size);
  statusMessage.value = `Clock size set to ${size}`;
  statusMessageType.value = 'info';
};

const handleInputBoostChange = () => {
  setInputGain(inputBoost.value);
};

const clearTickFlash = () => {
  if (tickFlashTimeoutId !== null) {
    clearTimeout(tickFlashTimeoutId);
    tickFlashTimeoutId = null;
  }
  tickFlash.value = false;
};

const stopAutoAdjust = () => {
  if (autoAdjustIntervalId !== null) {
    clearInterval(autoAdjustIntervalId);
    autoAdjustIntervalId = null;
  }
};

const handleAutoAdjust = () => {
  if (!isCalibrating.value) {
    stopAutoAdjust();
    return;
  }

  const elapsedSeconds = (Date.now() - calibrationStartTime) / 1000;

  // Wait at least 5 seconds before adjusting so initial detection can settle
  if (elapsedSeconds < 5) {
    return;
  }

  const expectedTicks = getExpectedFrequency() * elapsedSeconds;
  const actualTicks = calibrationProgress.value;

  // Update microphone diagnostic hint based on measured background level
  updateMicDiagnosticHint(actualTicks, expectedTicks);

  // Auto-boost: if the background level is extremely low (typical phone with quiet mic)
  // and no ticks have been detected yet, double the input gain up to MAX_AUTO_BOOST.
  // This runs before the threshold adjustment so the worklet receives a stronger signal.
  if (smoothedBackgroundLevel < VERY_LOW_MIC_LEVEL && actualTicks === 0 && inputBoost.value < MAX_AUTO_BOOST) {
    const newBoost = Math.min(MAX_AUTO_BOOST, inputBoost.value * AUTO_BOOST_FACTOR);
    inputBoost.value = newBoost;
    setInputGain(newBoost);
    statusMessage.value = `Mic signal very low — boosting input gain to ${newBoost}×`;
    statusMessageType.value = 'info';
    return;
  }

  // Too-loud case: far more ticks than expected → raise threshold to reduce false positives
  if (actualTicks > expectedTicks * TOO_MANY_TICKS_RATIO && actualTicks > 3) {
    const prevThreshold = workingThreshold;
    workingThreshold = Math.min(MAX_THRESHOLD, workingThreshold / THRESHOLD_ADJUST_FACTOR);
    workingSensitivity = Math.max(MIN_SENSITIVITY, workingSensitivity / SENSITIVITY_ADJUST_FACTOR);

    if (workingThreshold > prevThreshold) {
      setCalibration(workingSensitivity, workingThreshold, lowCutoff.value, highCutoff.value);
      audioThreshold.value = workingThreshold;
      statusMessage.value = `Signal too strong — reducing sensitivity (${actualTicks} detections vs ~${Math.round(expectedTicks)} expected)`;
      statusMessageType.value = 'warning';
    }
    return;
  }

  // Too-quiet case: fewer than 30% of expected ticks → lower the threshold
  if (actualTicks < expectedTicks * 0.3) {
    const prevThreshold = workingThreshold;
    workingThreshold = Math.max(MIN_THRESHOLD, workingThreshold * THRESHOLD_ADJUST_FACTOR);
    workingSensitivity = Math.min(MAX_SENSITIVITY, workingSensitivity * SENSITIVITY_ADJUST_FACTOR);

    if (workingThreshold < prevThreshold) {
      setCalibration(workingSensitivity, workingThreshold, lowCutoff.value, highCutoff.value);
      // Update the threshold marker on the audio level display
      audioThreshold.value = workingThreshold;
      statusMessage.value = `Adjusting sensitivity — heard ${actualTicks} of ~${Math.round(expectedTicks)} expected ticks`;
      statusMessageType.value = 'info';
    }
  }
};

/**
 * Provide an actionable hint based on the measured background noise level.
 * Distinguishes "mic system gain too low" (background near silence) from
 * "clock too far away" (background audible but no tick transients detected).
 */
const updateMicDiagnosticHint = (actualTicks: number, expectedTicks: number) => {
  if (smoothedBackgroundLevel < VERY_LOW_MIC_LEVEL && actualTicks === 0) {
    micDiagnosticHint.value = '⚠ Microphone level is extremely low. Try increasing microphone gain in your device settings, or use a different microphone (e.g. USB or headset).';
  } else if (smoothedBackgroundLevel < LOW_MIC_LEVEL && actualTicks < expectedTicks * 0.3) {
    micDiagnosticHint.value = '⚠ Signal is weak. Try placing the microphone closer to the clock.';
  } else if (smoothedBackgroundLevel > HIGH_MIC_LEVEL) {
    micDiagnosticHint.value = '⚠ Signal is very loud. Move the microphone further from the clock, or reduce microphone gain in your device settings.';
  } else {
    micDiagnosticHint.value = '';
  }
};

const handleStartCalibration = async () => {
  try {
    // Clear any previous status
    statusMessage.value = '';
    audioLevel.value = 0;
    smoothedBackgroundLevel = 0;
    micDiagnosticHint.value = '';
    
    // Initialize worklet and WASM if not already done
    try {
      await initializeWorklet();
    } catch (error) {
      // Worklet might already be initialized, which is fine
      console.log('Worklet initialization:', error);
    }
    
    // Start calibration
    startCalibration();
    
    // Reset input gain to the user-selected (or default) boost level
    setInputGain(inputBoost.value);
    
    // Reset working calibration parameters to a sensitive starting point so
    // that even quiet clock ticks can be detected during calibration.
    workingThreshold = CALIBRATION_START_THRESHOLD;
    workingSensitivity = CALIBRATION_START_SENSITIVITY;
    calibrationStartTime = Date.now();
    
    // Apply the sensitive starting parameters to the audio system
    setCalibration(workingSensitivity, workingThreshold, lowCutoff.value, highCutoff.value);
    audioThreshold.value = workingThreshold;
    
    // Start audio processing
    startProcessing();
    
    statusMessage.value = 'Calibration started. Please make sure your clock is ticking near the microphone.';
    statusMessageType.value = 'info';
    
    // Start auto-adjustment: periodically check if we are hearing the expected
    // number of ticks and lower the threshold further when we are not.
    stopAutoAdjust();
    autoAdjustIntervalId = window.setInterval(handleAutoAdjust, AUTO_ADJUST_INTERVAL_MS);
    
    // Set timeout for calibration
    timeoutId.value = window.setTimeout(() => {
      // Only timeout if still calibrating and no ticks detected
      if (isCalibrating.value && calibrationProgress.value === 0) {
        handleCalibrationTimeout();
      }
    }, calibrationTimeout);
    
  } catch (error) {
    statusMessage.value = 'Failed to start calibration. Please check microphone permissions.';
    statusMessageType.value = 'error';
    console.error('Calibration start error:', error);
  }
};

const handleStopCalibration = () => {
  // Clear timeout
  if (timeoutId.value !== null) {
    clearTimeout(timeoutId.value);
    timeoutId.value = null;
  }
  
  // Clear auto-adjust interval
  stopAutoAdjust();
  
  // Clear tick flash timeout
  clearTickFlash();
  
  // Stop audio processing
  stopProcessing();
  
  // Stop calibration
  stopCalibration();
  
  // Reset audio level display
  audioLevel.value = 0;
  micDiagnosticHint.value = '';
  
  statusMessage.value = 'Calibration cancelled.';
  statusMessageType.value = 'warning';
};

const handleCalibrationTimeout = () => {
  // Stop auto-adjust interval
  stopAutoAdjust();
  
  // Stop calibration
  stopProcessing();
  stopCalibration();
  
  micDiagnosticHint.value = '';

  // Provide actionable diagnosis based on the background level measured during calibration
  if (smoothedBackgroundLevel < VERY_LOW_MIC_LEVEL) {
    statusMessage.value = 'Microphone level too low. Please increase microphone gain in your device settings, or use a different microphone (e.g. USB or headset microphone).';
  } else if (smoothedBackgroundLevel < LOW_MIC_LEVEL) {
    statusMessage.value = 'Clock ticks not detected. Try moving the microphone closer to the clock.';
  } else {
    statusMessage.value = 'No ticks detected within 30 seconds. Please check microphone placement and try again.';
  }
  statusMessageType.value = 'warning';
};

const handleTickDetected = (event: TickEvent) => {
  if (!isCalibrating.value) {
    return;
  }
  
  // Flash the tick indicator briefly
  tickFlash.value = true;
  if (tickFlashTimeoutId !== null) {
    clearTimeout(tickFlashTimeoutId);
  }
  tickFlashTimeoutId = window.setTimeout(() => {
    tickFlash.value = false;
    tickFlashTimeoutId = null;
  }, 200);
  
  // Record the tick sample
  recordTickSample(event.amplitude);
  
  // Check if we have enough samples
  if (hasEnoughSamples.value) {
    // Clear timeout
    if (timeoutId.value !== null) {
      clearTimeout(timeoutId.value);
      timeoutId.value = null;
    }
    
    // Clear auto-adjust interval
    stopAutoAdjust();
    
    // Complete calibration
    const success = completeCalibration();
    
    // Stop audio processing
    stopProcessing();
    
    // Reset audio level display
    audioLevel.value = 0;
    clearTickFlash();
    micDiagnosticHint.value = '';
    
    if (success) {
      // Send calibration settings to AudioManager
      setCalibration(sensitivity.value, threshold.value, lowCutoff.value, highCutoff.value);
      console.log('Calibration complete:', { sensitivity: sensitivity.value, threshold: threshold.value, lowCutoff: lowCutoff.value, highCutoff: highCutoff.value });
      
      statusMessage.value = 'Calibration completed successfully! You can now proceed to measurement.';
      statusMessageType.value = 'success';
    } else {
      statusMessage.value = 'Calibration failed. Please try again.';
      statusMessageType.value = 'error';
    }
  }
};

const handleVolumeLevel = (level: number, threshold: number) => {
  if (!isCalibrating.value) {
    return;
  }
  audioLevel.value = level;
  audioThreshold.value = threshold;
  // Exponential moving average for background noise level diagnosis
  // alpha=0.03 → time constant ≈ 33 samples (~3 s at 100 ms per report); reaches ~95% of
  // steady state after ~100 samples (~10 s), giving a reliable ambient-noise baseline
  smoothedBackgroundLevel = smoothedBackgroundLevel * 0.97 + level * 0.03;
};

const navigateToMeasurement = () => {
  router.push({ name: 'measurement' });
};

const navigateToSettings = () => {
  router.push({ name: 'settings' });
};

// Lifecycle
onMounted(() => {
  // Register tick detection callback
  onTickDetected(handleTickDetected);
  
  // Register volume level callback for real-time audio feedback
  onVolumeLevel(handleVolumeLevel);
  
  // Show initial status
  if (!isInitialized.value) {
    statusMessage.value = 'Please configure your microphone in Settings first.';
    statusMessageType.value = 'warning';
  } else if (isCalibrated.value) {
    statusMessage.value = 'Already calibrated. You can recalibrate or proceed to measurement.';
    statusMessageType.value = 'success';
  } else {
    statusMessage.value = 'Select your clock size and start calibration.';
    statusMessageType.value = 'info';
  }
});

onUnmounted(() => {
  // Clean up timeout
  if (timeoutId.value !== null) {
    clearTimeout(timeoutId.value);
  }
  
  // Clean up auto-adjust interval
  stopAutoAdjust();
  
  // Clean up tick flash timeout
  clearTickFlash();
  
  // Stop calibration if active
  if (isCalibrating.value) {
    stopProcessing();
    stopCalibration();
  }
});
</script>

<style scoped>
.calibration-page {
  padding: var(--spacing-xl);
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-xl);
  text-align: center;
  color: var(--color-text-primary);
}

h2 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-md);
  color: var(--color-text-primary);
}

section {
  margin-bottom: var(--spacing-xl);
}

/* Band-Pass Filter Section */
.filter-section {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-lg);
}

/* Input Boost Section */
.input-boost-section {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-lg);
}

.input-boost-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  line-height: var(--line-height-normal);
}

.input-boost-control {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}

.input-boost-control label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.filter-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  line-height: var(--line-height-normal);
}

.filter-controls {
  display: flex;
  gap: var(--spacing-md);
}

.filter-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}

.filter-field label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  border: var(--border-width-thick) solid var(--color-border);
  border-radius: var(--border-radius-md, 6px);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  min-height: var(--touch-target-min);
  touch-action: manipulation;
  transition: border-color var(--transition-base);
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Clock Size Selection */
.clock-size-section {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-lg);
}

.clock-size-buttons {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

.size-button {
  flex: 1;
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: var(--border-width-thick) solid var(--color-border);
  background: var(--color-bg-primary);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.size-button:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.size-button:active:not(:disabled) {
  transform: translateY(0);
}

.size-button.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-bold);
}

.size-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Calibration Controls */
.calibration-controls {
  text-align: center;
}

.start-button,
.stop-button {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  border: none;
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-height: var(--touch-target-min);
  min-width: 200px;
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.start-button {
  background: var(--color-success);
  color: white;
}

.start-button:hover:not(:disabled) {
  background: var(--color-success-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.start-button:active:not(:disabled) {
  transform: translateY(0);
}

.start-button:disabled {
  background: var(--color-border);
  cursor: not-allowed;
}

.stop-button {
  background: var(--color-danger);
  color: white;
}

.stop-button:hover {
  background: var(--color-danger-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.stop-button:active {
  transform: translateY(0);
}

/* Calibration Status */
.calibration-status {
  min-height: 150px;
}

.status-active {
  background: var(--color-info-light);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-lg);
  text-align: center;
}

.progress-indicator {
  margin-bottom: var(--spacing-md);
}

.progress-indicator p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto var(--spacing-md);
  border: 4px solid var(--color-border-light);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.tick-count {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  transition: color var(--transition-fast, 0.15s);
}

.tick-count.tick-flash .count-value {
  color: var(--color-success);
}

.count-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-secondary);
}

.count-value {
  color: var(--color-primary);
  font-size: var(--font-size-3xl);
}

.count-required {
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
}

/* Audio Level Meter */
.audio-level-meter {
  margin-bottom: var(--spacing-md);
}

.meter-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs, 4px);
  text-align: left;
}

.meter-bar-track {
  position: relative;
  height: 16px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm, 4px);
  overflow: visible;
}

.meter-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--border-radius-sm, 4px);
  transition: width 0.1s linear, background-color 0.15s;
  min-width: 2px;
}

.meter-bar-fill.tick-flash {
  background: var(--color-success);
}

.meter-bar-fill.level-loud {
  background: var(--color-danger);
}

.mic-diagnostic-hint {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-md, 6px);
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  text-align: left;
}

.meter-threshold-marker {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: var(--color-warning, #f59e0b);
  border-radius: 1px;
  transform: translateX(-50%);
}

.meter-hint {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs, 4px);
}

.threshold-label {
  color: var(--color-warning, #f59e0b);
  font-size: var(--font-size-xs, 11px);
}

.status-message {
  padding: var(--spacing-md);
  border-radius: var(--border-radius-lg);
  margin-top: var(--spacing-md);
  line-height: var(--line-height-normal);
}

.status-message.info {
  background: var(--color-info-light);
  color: var(--color-info);
}

.status-message.success {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.status-message.warning {
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
}

.status-message.error {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
}

/* Navigation */
.navigation-section {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

.nav-button {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border: var(--border-width-thick) solid var(--color-primary);
  background: var(--color-primary);
  color: white;
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-height: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.nav-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.nav-button:active:not(:disabled) {
  transform: translateY(0);
}

.nav-button.secondary {
  background: var(--color-bg-primary);
  color: var(--color-primary);
}

.nav-button.secondary:hover {
  background: var(--color-bg-secondary);
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive Design */
@media (max-width: 768px) {
  .calibration-page {
    padding: var(--spacing-md);
  }
  
  h1 {
    font-size: var(--font-size-xl);
  }
  
  .clock-size-buttons {
    flex-direction: column;
  }
  
  .filter-controls {
    flex-direction: column;
  }
  
  .navigation-section {
    flex-direction: column;
  }
  
  .nav-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .calibration-page {
    padding: var(--spacing-sm);
  }
  
  .clock-size-section {
    padding: var(--spacing-md);
  }
  
  .start-button,
  .stop-button {
    min-width: 150px;
    font-size: var(--font-size-sm);
  }
  
  .count-value {
    font-size: var(--font-size-2xl);
  }
}

/* Landscape orientation support */
@media (orientation: landscape) and (max-height: 500px) {
  .calibration-page {
    padding: var(--spacing-md);
  }
  
  h1 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-md);
  }
  
  section {
    margin-bottom: var(--spacing-md);
  }
  
  .clock-size-section {
    padding: var(--spacing-md);
  }
  
  .calibration-status {
    min-height: 100px;
  }
}
</style>
