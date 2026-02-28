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

// Composables
const counter = useCounter()
const session = useSession()
const audio = useAudio()

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
  min-height: 100vh;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.measurement-container {
  background: white;
  border-radius: 1rem;
  padding: 3rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 600px;
  width: 100%;
}

/* Tick Count Section */
.tick-count-section {
  text-align: center;
  margin-bottom: 2rem;
}

.tick-count {
  font-size: 6rem;
  font-weight: bold;
  color: #2c3e50;
  line-height: 1;
  transition: all 0.1s ease;
  padding: 1rem;
  border-radius: 0.5rem;
}

.tick-count.tick-flash {
  background-color: #4caf50;
  color: white;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
}

.tick-count.idle {
  color: #95a5a6;
}

.tick-label {
  font-size: 1.5rem;
  color: #7f8c8d;
  margin-top: 0.5rem;
}

/* Session Info */
.session-info {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
}

.duration {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.duration-label {
  font-weight: normal;
  color: #7f8c8d;
  margin-right: 0.5rem;
}

.duration-value {
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.idle-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  color: #e67e22;
  font-size: 1rem;
}

.idle-icon {
  font-size: 1.2rem;
}

.idle-text {
  font-weight: 500;
}

/* Controls */
.controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  min-height: 44px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.25rem;
  min-width: 180px;
}

.btn-primary {
  background-color: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-secondary {
  background-color: #ff9800;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e68900;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
}

.btn-danger {
  background-color: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #da190b;
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
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.modal p {
  margin-bottom: 1.5rem;
  color: #7f8c8d;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

/* Responsive Design */
@media (max-width: 768px) {
  .measurement-container {
    padding: 2rem;
  }
  
  .tick-count {
    font-size: 4rem;
  }
  
  .tick-label {
    font-size: 1.25rem;
  }
  
  .duration {
    font-size: 1.25rem;
  }
  
  .btn-large {
    padding: 0.875rem 1.5rem;
    font-size: 1.125rem;
    min-width: 150px;
  }
}

@media (max-width: 480px) {
  .measurement-page {
    padding: 1rem;
  }
  
  .measurement-container {
    padding: 1.5rem;
  }
  
  .tick-count {
    font-size: 3rem;
  }
  
  .controls {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
