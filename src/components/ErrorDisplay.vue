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
  padding: 20px;
  z-index: 1000;
  animation: fadeIn 0.2s ease-in;
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
  background-color: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease-out;
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
  gap: 16px;
  margin-bottom: 20px;
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
  background-color: #fee;
  color: #c00;
}

.error-severity-error {
  background-color: #fef0e6;
  color: #d97706;
}

.error-severity-warning {
  background-color: #fef9e6;
  color: #ca8a04;
}

.error-severity-info {
  background-color: #e6f2ff;
  color: #0066cc;
}

.error-text {
  flex: 1;
}

.error-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.error-details {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.error-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  color: #999;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.error-close:hover {
  background-color: #f5f5f5;
  color: #333;
}

.error-close svg {
  width: 24px;
  height: 24px;
}

.error-resolution {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.error-resolution h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.error-resolution ol {
  margin: 0;
  padding-left: 20px;
}

.error-resolution li {
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.error-resolution li:last-child {
  margin-bottom: 0;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.error-button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.error-button-primary {
  background-color: #2c3e50;
  color: white;
}

.error-button-primary:hover {
  background-color: #1a252f;
}

.error-button-primary:active {
  transform: scale(0.98);
}

.error-button-secondary {
  background-color: #e5e5e5;
  color: #333;
}

.error-button-secondary:hover {
  background-color: #d5d5d5;
}

.error-button-secondary:active {
  transform: scale(0.98);
}

/* Responsive design for mobile */
@media (max-width: 768px) {
  .error-display {
    padding: 16px;
  }
  
  .error-content {
    padding: 20px;
  }
  
  .error-header {
    gap: 12px;
  }
  
  .error-icon {
    width: 36px;
    height: 36px;
  }
  
  .error-title {
    font-size: 16px;
  }
  
  .error-details {
    font-size: 13px;
  }
  
  .error-actions {
    flex-direction: column;
  }
  
  .error-button {
    width: 100%;
  }
}

/* Touch-friendly tap targets (44px minimum) */
.error-button,
.error-close {
  min-height: 44px;
  min-width: 44px;
}
</style>
