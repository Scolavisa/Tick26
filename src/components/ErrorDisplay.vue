<template>
  <div v-if="error" class="error-display" role="alert" aria-live="assertive">
    <div class="error-content">
      <div class="error-header">
        <div class="error-icon" :class="errorSeverityClass">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        <div class="error-text">
          <h3 class="error-title">{{ error.message }}</h3>
          <p class="error-details">{{ error.details }}</p>
        </div>
        <button 
          class="error-close" 
          @click="handleClose"
          aria-label="Close error message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      
      <div v-if="error.resolution && error.resolution.length > 0" class="error-resolution">
        <h4>How to resolve:</h4>
        <ol>
          <li v-for="(step, index) in error.resolution" :key="index">
            {{ step }}
          </li>
        </ol>
      </div>
      
      <div class="error-actions">
        <button 
          v-if="showRetry"
          class="error-button error-button-primary" 
          @click="handleRetry"
        >
          Retry
        </button>
        <button 
          v-if="showLearnMore"
          class="error-button error-button-secondary" 
          @click="handleLearnMore"
        >
          Learn More
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ErrorInfo } from '../types';
import { ErrorCode } from '../types';

/**
 * ErrorDisplay Component
 * Validates: Requirements 14.1, 14.2, 14.3
 * 
 * Displays error messages with:
 * - Error icon indicating severity
 * - Error title and detailed message
 * - Resolution steps
 * - Action buttons (Retry, Learn More)
 */

interface Props {
  error: ErrorInfo | null;
  showRetry?: boolean;
  showLearnMore?: boolean;
}

interface Emits {
  (e: 'retry'): void;
  (e: 'close'): void;
  (e: 'learn-more'): void;
}

const props = withDefaults(defineProps<Props>(), {
  showRetry: true,
  showLearnMore: false
});

const emit = defineEmits<Emits>();

/**
 * Determine error severity class based on error code
 */
const errorSeverityClass = computed(() => {
  if (!props.error) return 'error-severity-info';
  
  switch (props.error.code) {
    case ErrorCode.MICROPHONE_PERMISSION_DENIED:
    case ErrorCode.BROWSER_NOT_SUPPORTED:
      return 'error-severity-critical';
    
    case ErrorCode.AUDIOWORKLET_INIT_FAILED:
    case ErrorCode.WASM_LOAD_FAILED:
      return 'error-severity-error';
    
    case ErrorCode.CALIBRATION_TIMEOUT:
    case ErrorCode.MICROPHONE_ACCESS_FAILED:
      return 'error-severity-warning';
    
    default:
      return 'error-severity-info';
  }
});

/**
 * Handle retry button click
 */
const handleRetry = () => {
  emit('retry');
};

/**
 * Handle close button click
 */
const handleClose = () => {
  emit('close');
};

/**
 * Handle learn more button click
 */
const handleLearnMore = () => {
  emit('learn-more');
};
</script>

<style scoped>
.error-display {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  z-index: var(--z-index-modal);
  animation: fadeIn var(--transition-base);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.error-content {
  background-color: var(--color-bg-primary);
  border-radius: var(--border-radius-xl);
  padding: var(--spacing-xl);
  max-width: 500px;
  width: 100%;
  box-shadow: var(--shadow-xl);
  animation: slideUp var(--transition-slow);
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.error-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.error-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-icon svg {
  width: 24px;
  height: 24px;
}

.error-severity-critical {
  background-color: var(--color-danger-light);
  color: var(--color-danger);
}

.error-severity-error {
  background-color: var(--color-warning-light);
  color: var(--color-warning-dark);
}

.error-severity-warning {
  background-color: var(--color-warning-light);
  color: var(--color-warning);
}

.error-severity-info {
  background-color: var(--color-info-light);
  color: var(--color-info);
}

.error-text {
  flex: 1;
}

.error-title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.error-details {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.error-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text-light);
  padding: var(--spacing-xs);
  border-radius: var(--border-radius-sm);
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.error-close:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.error-close:active {
  transform: scale(0.95);
}

.error-close svg {
  width: 24px;
  height: 24px;
}

.error-resolution {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-lg);
}

.error-resolution h4 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.error-resolution ol {
  margin: 0;
  padding-left: var(--spacing-lg);
}

.error-resolution li {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.error-resolution li:last-child {
  margin-bottom: 0;
}

.error-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.error-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--border-radius-lg);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-width: 80px;
  min-height: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.error-button-primary {
  background-color: var(--color-primary);
  color: white;
}

.error-button-primary:hover {
  background-color: var(--color-primary-dark);
}

.error-button-primary:active {
  transform: scale(0.98);
}

.error-button-secondary {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.error-button-secondary:hover {
  background-color: var(--color-border);
}

.error-button-secondary:active {
  transform: scale(0.98);
}

/* Responsive design for mobile */
@media (max-width: 768px) {
  .error-display {
    padding: var(--spacing-md);
  }
  
  .error-content {
    padding: var(--spacing-lg);
  }
  
  .error-header {
    gap: var(--spacing-sm);
  }
  
  .error-icon {
    width: 36px;
    height: 36px;
  }
  
  .error-title {
    font-size: var(--font-size-sm);
  }
  
  .error-details {
    font-size: var(--font-size-xs);
  }
  
  .error-actions {
    flex-direction: column;
  }
  
  .error-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .error-display {
    padding: var(--spacing-sm);
  }
  
  .error-content {
    padding: var(--spacing-md);
  }
}

/* Landscape orientation support */
@media (orientation: landscape) and (max-height: 500px) {
  .error-content {
    max-height: 90vh;
    overflow-y: auto;
  }
}
</style>
