/**
 * useCalibration - Vue 3 Composition API wrapper for calibration management
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 12.3
 * 
 * This composable provides:
 * - Reactive state for calibration settings
 * - Clock size selection (small, medium, large)
 * - Calibration process management
 * - Tick sample collection and analysis
 * - Sensitivity and threshold calculation
 * - localStorage persistence
 * - Singleton pattern for shared state across components
 */

import { ref, computed, type Ref } from 'vue';
import type { ClockSize, CalibrationSettings, ErrorInfo } from '../types';
import { ErrorCode } from '../types';
import { logError, createErrorFromCode } from '../utils/errors';

// Singleton state - shared across all component instances
let isSharedStateInitialized = false;

// Shared reactive state
const clockSize: Ref<ClockSize> = ref('medium');
const sensitivity: Ref<number> = ref(1.0);
const threshold: Ref<number> = ref(0.05);
const lowCutoff: Ref<number> = ref(500);
const highCutoff: Ref<number> = ref(8000);
const isCalibrating: Ref<boolean> = ref(false);
const calibrationProgress: Ref<number> = ref(0);
const currentError: Ref<ErrorInfo | null> = ref(null);

// Calibration sample collection
let tickSamples: number[] = [];
let calibrationTimeoutId: number | null = null;

// localStorage key for calibration persistence
const STORAGE_KEY = 'tick-tack-calibration';

// Minimum ticks required for calibration completion
const MIN_TICKS_FOR_CALIBRATION = 10;

// Calibration timeout in milliseconds (30 seconds)
const CALIBRATION_TIMEOUT_MS = 30000;

/**
 * Load calibration settings from localStorage
 * Validates: Requirement 2.4
 */
function loadCalibrationFromStorage(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const settings: CalibrationSettings = JSON.parse(stored);
      
      // Validate and apply settings
      if (settings.clockSize) {
        clockSize.value = settings.clockSize;
      }
      if (typeof settings.sensitivity === 'number') {
        sensitivity.value = settings.sensitivity;
      }
      if (typeof settings.threshold === 'number') {
        threshold.value = settings.threshold;
      }
      if (typeof settings.lowCutoff === 'number') {
        lowCutoff.value = settings.lowCutoff;
      }
      if (typeof settings.highCutoff === 'number') {
        highCutoff.value = settings.highCutoff;
      }
    }
  } catch (error) {
    console.error('Failed to load calibration settings:', error);
  }
}

/**
 * useCalibration composable
 * Returns reactive state and methods for calibration management
 */
export function useCalibration() {
  // Initialize shared state on first use
  if (!isSharedStateInitialized) {
    // Load persisted calibration settings
    loadCalibrationFromStorage();
    isSharedStateInitialized = true;
  }

  /**
   * Set the clock size
   * Validates: Requirement 2.1
   * 
   * @param size - Clock size: 'small', 'medium', or 'large'
   */
  const setClockSize = (size: ClockSize): void => {
    clockSize.value = size;
  };

  /**
   * Start the calibration process
   * Validates: Requirements 2.3, 12.4
   * 
   * Begins collecting tick samples for analysis
   * Sets a 30-second timeout for calibration
   */
  const startCalibration = (): void => {
    if (isCalibrating.value) {
      console.warn('Calibration already in progress');
      return;
    }

    // Clear any previous errors
    currentError.value = null;

    // Reset calibration state
    isCalibrating.value = true;
    calibrationProgress.value = 0;
    tickSamples = [];
    
    // Set timeout for calibration (Requirement 12.4)
    calibrationTimeoutId = window.setTimeout(() => {
      if (isCalibrating.value && tickSamples.length === 0) {
        // No ticks detected within timeout period
        const errorInfo = createErrorFromCode(ErrorCode.CALIBRATION_TIMEOUT);
        logError(errorInfo);
        currentError.value = errorInfo;
        
        // Stop calibration
        stopCalibration();
      }
    }, CALIBRATION_TIMEOUT_MS);
  };

  /**
   * Record a tick sample during calibration
   * Called by the audio system when a tick is detected
   * 
   * @param amplitude - RMS amplitude of the detected tick
   */
  const recordTickSample = (amplitude: number): void => {
    if (!isCalibrating.value) {
      return;
    }

    tickSamples.push(amplitude);
    calibrationProgress.value = tickSamples.length;
  };

  /**
   * Stop the calibration process
   * Can be called to cancel calibration before completion
   */
  const stopCalibration = (): void => {
    if (!isCalibrating.value) {
      return;
    }

    // Clear timeout
    if (calibrationTimeoutId !== null) {
      window.clearTimeout(calibrationTimeoutId);
      calibrationTimeoutId = null;
    }

    isCalibrating.value = false;
    calibrationProgress.value = 0;
    tickSamples = [];
  };

  /**
   * Complete the calibration process
   * Validates: Requirements 2.3, 12.3
   * 
   * Analyzes collected samples and calculates sensitivity/threshold
   * 
   * @returns boolean - true if calibration successful, false if insufficient samples
   */
  const completeCalibration = (): boolean => {
    if (!isCalibrating.value) {
      console.warn('No calibration in progress');
      return false;
    }

    // Clear timeout
    if (calibrationTimeoutId !== null) {
      window.clearTimeout(calibrationTimeoutId);
      calibrationTimeoutId = null;
    }

    // Validate minimum tick count (Requirement 12.3)
    if (tickSamples.length < MIN_TICKS_FOR_CALIBRATION) {
      console.warn(`Insufficient samples: ${tickSamples.length} < ${MIN_TICKS_FOR_CALIBRATION}`);
      
      // Don't create an error for this - just return false
      // The UI should handle this by showing the current count and required count
      return false;
    }

    // Calculate statistics from samples
    const sortedSamples = [...tickSamples].sort((a, b) => a - b);
    const median = sortedSamples[Math.floor(sortedSamples.length / 2)] || 0;
    const min = sortedSamples[0] || 0;
    const max = sortedSamples[sortedSamples.length - 1] || 0;

    // Calculate threshold as percentage of median amplitude
    // Use median instead of mean to be robust against outliers
    threshold.value = median * 0.6; // 60% of median amplitude

    // Calculate sensitivity based on signal variation
    // Higher variation = lower sensitivity (more filtering)
    // Lower variation = higher sensitivity (less filtering)
    const range = max - min;
    const coefficient = median > 0 ? range / median : 0;
    
    if (coefficient > 0.5) {
      // High variation - reduce sensitivity
      sensitivity.value = 0.7;
    } else if (coefficient > 0.3) {
      // Medium variation - standard sensitivity
      sensitivity.value = 1.0;
    } else {
      // Low variation - increase sensitivity
      sensitivity.value = 1.3;
    }

    // End calibration
    isCalibrating.value = false;
    
    // Auto-save calibration
    saveCalibration();

    return true;
  };

  /**
   * Save calibration settings to localStorage
   * Validates: Requirement 2.4
   */
  const saveCalibration = (): void => {
    const settings: CalibrationSettings = {
      clockSize: clockSize.value,
      sensitivity: sensitivity.value,
      threshold: threshold.value,
      lowCutoff: lowCutoff.value,
      highCutoff: highCutoff.value,
      expectedFrequency: getExpectedFrequency(),
      calibratedAt: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save calibration settings:', error);
    }
  };

  /**
   * Load calibration settings from localStorage
   * Validates: Requirement 2.4
   */
  const loadCalibration = (): void => {
    loadCalibrationFromStorage();
  };

  /**
   * Reset calibration settings to defaults
   */
  const resetCalibration = (): void => {
    // Clear timeout if active
    if (calibrationTimeoutId !== null) {
      window.clearTimeout(calibrationTimeoutId);
      calibrationTimeoutId = null;
    }
    
    clockSize.value = 'medium';
    sensitivity.value = 1.0;
    threshold.value = 0.05;
    lowCutoff.value = 500;
    highCutoff.value = 8000;
    isCalibrating.value = false;
    calibrationProgress.value = 0;
    tickSamples = [];
    currentError.value = null;

    // Clear from localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear calibration settings:', error);
    }
  };

  /**
   * Check if calibration is complete (has valid settings)
   */
  const isCalibrated = computed(() => {
    // Calibration is complete if we have non-default values
    return sensitivity.value !== 1.0 || threshold.value !== 0.05;
  });

  /**
   * Check if enough samples have been collected
   */
  const hasEnoughSamples = computed(() => {
    return calibrationProgress.value >= MIN_TICKS_FOR_CALIBRATION;
  });

  /**
   * Get expected tick frequency for current clock size
   * Validates: Requirement 2.2
   * 
   * @returns Expected frequency in Hz
   */
  const getExpectedFrequency = (): number => {
    switch (clockSize.value) {
      case 'small':
        return 5.5; // 5-6 Hz (fast ticking)
      case 'medium':
        return 2.5; // 2-3 Hz (standard)
      case 'large':
        return 0.75; // 0.5-1 Hz (slow ticking)
      default:
        return 2.5;
    }
  };

  /**
   * Clear the current error
   */
  const clearError = (): void => {
    currentError.value = null;
  };

  // Return reactive state and methods
  return {
    // State
    clockSize,
    sensitivity,
    threshold,
    lowCutoff,
    highCutoff,
    isCalibrating,
    calibrationProgress,
    isCalibrated,
    hasEnoughSamples,
    currentError,
    
    // Methods
    setClockSize,
    startCalibration,
    recordTickSample,
    stopCalibration,
    completeCalibration,
    saveCalibration,
    loadCalibration,
    resetCalibration,
    getExpectedFrequency,
    clearError
  };
}
