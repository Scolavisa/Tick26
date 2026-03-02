<template>
  <div class="measurement-page">
    <div class="measurement-container">
      <!-- Tick Count Display -->
      <div class="tick-count-section">
        <div 
          class="tick-count" 
          :class="{ 'tick-flash': showTickFlash, 'idle': isIdle }"
        >
          {{ tickCount }}
        </div>
        <div class="tick-label">Ticks</div>
      </div>

      <!-- Session Duration -->
      <div class="session-info">
        <div class="duration">
          <span class="duration-label">Duration:</span>
          <span class="duration-value">{{ formattedDuration }}</span>
        </div>
        <div v-if="isIdle" class="idle-indicator">
          <span class="idle-icon">⏸</span>
          <span class="idle-text">No ticks detected (idle)</span>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="controls">
        <button 
          v-if="!isActive" 
          @click="handleStart" 
          class="btn btn-primary btn-large"
        >
          Start Session
        </button>
        <button 
          v-else 
          @click="handleStop" 
          class="btn btn-secondary btn-large"
        >
          Stop Session
        </button>
        <button 
          @click="handleReset" 
          class="btn btn-danger"
          :disabled="isActive"
        >
          Reset
        </button>
      </div>

      <!-- Reset Confirmation Dialog -->
      <div v-if="showResetConfirm" class="modal-overlay" @click="cancelReset">
        <div class="modal" @click.stop>
          <h2>Confirm Reset</h2>
          <p>Are you sure you want to reset the counter? This will clear the current count and duration.</p>
          <div class="modal-actions">
            <button @click="confirmReset" class="btn btn-danger">Reset</button>
            <button @click="cancelReset" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCounter } from '../composables/useCounter'
import { useSession } from '../composables/useSession'
import { useAudio } from '../composables/useAudio'
import { useCalibration } from '../composables/useCalibration'

// Composables
const counter = useCounter()
const session = useSession()
const audio = useAudio()
const calibration = useCalibration()

// Local state
const showResetConfirm = ref(false)
const showTickFlash = ref(false)
let flashTimeout: ReturnType<typeof setTimeout> | null = null

// Computed properties
const tickCount = computed(() => counter.count.value)
const isActive = computed(() => session.isActive.value)
const isIdle = computed(() => counter.isIdle.value)

const formattedDuration = computed(() => {
  const seconds = session.duration.value
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

// Methods
const handleStart = async () => {
  // Reset counter for new session
  counter.reset()
  
  // Start session
  session.start()
  
  // Initialize worklet and start audio processing
  try {
    // Initialize worklet if not already done
    try {
      await audio.initializeWorklet()
    } catch (error) {
      // Worklet might already be initialized, which is fine
      console.log('Worklet initialization:', error)
    }
    
    // Apply calibration settings to AudioManager
    audio.setCalibration(calibration.sensitivity.value, calibration.threshold.value)
    
    audio.startProcessing()
  } catch (error) {
    console.error('Failed to start audio processing:', error)
    session.stop()
  }
}

const handleStop = () => {
  // Stop session
  session.stop()
  
  // Stop audio processing
  audio.stopProcessing()
}

const handleReset = () => {
  if (isActive.value) {
    return // Cannot reset while active
  }
  
  // Show confirmation dialog
  showResetConfirm.value = true
}

const confirmReset = () => {
  // Reset counter and session
  counter.reset()
  session.reset()
  
  // Close dialog
  showResetConfirm.value = false
}

const cancelReset = () => {
  showResetConfirm.value = false
}

const triggerTickFlash = () => {
  // Clear any existing timeout
  if (flashTimeout) {
    clearTimeout(flashTimeout)
  }
  
  // Show flash
  showTickFlash.value = true
  
  // Hide flash after 100ms
  flashTimeout = setTimeout(() => {
    showTickFlash.value = false
  }, 100)
}

// Lifecycle hooks
onMounted(() => {
  // Register tick detection callback
  audio.onTickDetected(() => {
    // Increment counter
    counter.increment()
    
    // Trigger visual feedback
    triggerTickFlash()
  })
})

onUnmounted(() => {
  // Clean up flash timeout
  if (flashTimeout) {
    clearTimeout(flashTimeout)
  }
  
  // Stop audio if active
  if (isActive.value) {
    audio.stopProcessing()
  }
})
</script>

<style scoped>
.measurement-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 60px); /* Account for navigation */
  padding: var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-accent) 0%, #764ba2 100%);
}

.measurement-container {
  background: var(--color-bg-primary);
  border-radius: var(--border-radius-xl);
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-xl);
  max-width: 600px;
  width: 100%;
}

/* Tick Count Section */
.tick-count-section {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.tick-count {
  font-size: 6rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  line-height: var(--line-height-tight);
  transition: all var(--transition-fast);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-lg);
}

.tick-count.tick-flash {
  background-color: var(--color-success);
  color: white;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
}

.tick-count.idle {
  color: var(--color-text-light);
}

.tick-label {
  font-size: var(--font-size-xl);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
}

/* Session Info */
.session-info {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-md);
  background: var(--color-bg-secondary);
  border-radius: var(--border-radius-lg);
}

.duration {
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.duration-label {
  font-weight: var(--font-weight-normal);
  color: var(--color-text-secondary);
  margin-right: var(--spacing-sm);
}

.duration-value {
  font-weight: var(--font-weight-bold);
  font-family: var(--font-family-mono);
}

.idle-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}

.idle-icon {
  font-size: var(--font-size-lg);
}

.idle-text {
  font-weight: var(--font-weight-medium);
}

/* Controls */
.controls {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border: none;
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-width: 120px;
  min-height: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-large {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-lg);
  min-width: 180px;
}

.btn-primary {
  background-color: var(--color-success);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-success-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-secondary {
  background-color: var(--color-warning);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-warning-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
}

.btn-danger {
  background-color: var(--color-danger);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-danger-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal);
  padding: var(--spacing-md);
}

.modal {
  background: var(--color-bg-primary);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-xl);
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-xl);
}

.modal h2 {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
}

.modal p {
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

/* Responsive Design */
@media (max-width: 768px) {
  .measurement-page {
    padding: var(--spacing-md);
  }
  
  .measurement-container {
    padding: var(--spacing-xl);
  }
  
  .tick-count {
    font-size: 4rem;
  }
  
  .tick-label {
    font-size: var(--font-size-lg);
  }
  
  .duration {
    font-size: var(--font-size-lg);
  }
  
  .btn-large {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: var(--font-size-md);
    min-width: 150px;
  }
}

@media (max-width: 480px) {
  .measurement-page {
    padding: var(--spacing-sm);
  }
  
  .measurement-container {
    padding: var(--spacing-lg);
  }
  
  .tick-count {
    font-size: 3rem;
  }
  
  .tick-label {
    font-size: var(--font-size-md);
  }
  
  .controls {
    flex-direction: column;
    width: 100%;
  }
  
  .btn {
    width: 100%;
  }
  
  .modal {
    padding: var(--spacing-md);
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .modal-actions .btn {
    width: 100%;
  }
}

/* Landscape orientation support */
@media (orientation: landscape) and (max-height: 500px) {
  .measurement-page {
    padding: var(--spacing-md);
    min-height: auto;
  }
  
  .measurement-container {
    padding: var(--spacing-md);
  }
  
  .tick-count {
    font-size: 3rem;
  }
  
  .tick-count-section {
    margin-bottom: var(--spacing-md);
  }
  
  .session-info {
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-sm);
  }
  
  .duration {
    font-size: var(--font-size-md);
  }
}
</style>
