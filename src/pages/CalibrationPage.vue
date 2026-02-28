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
        <div class="tick-count">
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
  setClockSize,
  startCalibration,
  stopCalibration,
  completeCalibration,
  recordTickSample
} = useCalibration();

const {
  isInitialized,
  permissionGranted,
  onTickDetected,
  initializeWorklet,
  startProcessing,
  stopProcessing
} = useAudio();

// Local state
const statusMessage = ref<string>('');
const statusMessageType = ref<'info' | 'success' | 'warning' | 'error'>('info');
const timeoutId = ref<number | null>(null);

// Constants
const minTicksRequired = 10;
const calibrationTimeout = 30000; // 30 seconds

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

// Methods
const selectClockSize = (size: ClockSize) => {
  setClockSize(size);
  statusMessage.value = `Clock size set to ${size}`;
  statusMessageType.value = 'info';
};

const handleStartCalibration = async () => {
  try {
    // Clear any previous status
    statusMessage.value = '';
    
    // Initialize worklet and WASM if not already done
    try {
      await initializeWorklet();
    } catch (error) {
      // Worklet might already be initialized, which is fine
      console.log('Worklet initialization:', error);
    }
    
    // Start calibration
    startCalibration();
    
    // Start audio processing
    startProcessing();
    
    statusMessage.value = 'Calibration started. Please make sure your clock is ticking near the microphone.';
    statusMessageType.value = 'info';
    
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
  
  // Stop audio processing
  stopProcessing();
  
  // Stop calibration
  stopCalibration();
  
  statusMessage.value = 'Calibration cancelled.';
  statusMessageType.value = 'warning';
};

const handleCalibrationTimeout = () => {
  // Stop calibration
  stopProcessing();
  stopCalibration();
  
  statusMessage.value = 'No ticks detected within 30 seconds. Please check microphone placement and try again.';
  statusMessageType.value = 'warning';
};

const handleTickDetected = (event: TickEvent) => {
  if (!isCalibrating.value) {
    return;
  }
  
  // Record the tick sample
  recordTickSample(event.amplitude);
  
  // Check if we have enough samples
  if (hasEnoughSamples.value) {
    // Clear timeout
    if (timeoutId.value !== null) {
      clearTimeout(timeoutId.value);
      timeoutId.value = null;
    }
    
    // Complete calibration
    const success = completeCalibration();
    
    // Stop audio processing
    stopProcessing();
    
    if (success) {
      statusMessage.value = 'Calibration completed successfully! You can now proceed to measurement.';
      statusMessageType.value = 'success';
    } else {
      statusMessage.value = 'Calibration failed. Please try again.';
      statusMessageType.value = 'error';
    }
  }
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
  
  // Stop calibration if active
  if (isCalibrating.value) {
    stopProcessing();
    stopCalibration();
  }
});
</script>

<style scoped>
.calibration-page {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

section {
  margin-bottom: 2rem;
}

/* Clock Size Selection */
.clock-size-section {
  background: #f5f5f5;
  padding: 1.5rem;
  border-radius: 8px;
}

.clock-size-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.size-button {
  flex: 1;
  padding: 1rem;
  font-size: 1rem;
  border: 2px solid #ccc;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  min-width: 44px;
}

.size-button:hover:not(:disabled) {
  border-color: #2c3e50;
  background: #f9f9f9;
}

.size-button.active {
  border-color: #2c3e50;
  background: #2c3e50;
  color: white;
  font-weight: bold;
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
  padding: 1rem 2rem;
  font-size: 1.125rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  min-width: 200px;
}

.start-button {
  background: #4caf50;
  color: white;
}

.start-button:hover:not(:disabled) {
  background: #45a049;
}

.start-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.stop-button {
  background: #f44336;
  color: white;
}

.stop-button:hover {
  background: #da190b;
}

/* Calibration Status */
.calibration-status {
  min-height: 150px;
}

.status-active {
  background: #e3f2fd;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.progress-indicator {
  margin-bottom: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2c3e50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.tick-count {
  font-size: 1.5rem;
  font-weight: bold;
}

.count-label {
  display: block;
  font-size: 1rem;
  font-weight: normal;
  margin-bottom: 0.5rem;
}

.count-value {
  color: #2c3e50;
  font-size: 2rem;
}

.count-required {
  color: #666;
  font-size: 1.25rem;
}

.status-message {
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.status-message.info {
  background: #e3f2fd;
  color: #1976d2;
}

.status-message.success {
  background: #e8f5e9;
  color: #388e3c;
}

.status-message.warning {
  background: #fff3e0;
  color: #f57c00;
}

.status-message.error {
  background: #ffebee;
  color: #d32f2f;
}

/* Navigation */
.navigation-section {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.nav-button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: 2px solid #2c3e50;
  background: #2c3e50;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
}

.nav-button:hover:not(:disabled) {
  background: #1a252f;
  border-color: #1a252f;
}

.nav-button.secondary {
  background: white;
  color: #2c3e50;
}

.nav-button.secondary:hover {
  background: #f5f5f5;
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive Design */
@media (max-width: 768px) {
  .calibration-page {
    padding: 1rem;
  }
  
  .clock-size-buttons {
    flex-direction: column;
  }
  
  .navigation-section {
    flex-direction: column;
  }
  
  .nav-button {
    width: 100%;
  }
}
</style>
