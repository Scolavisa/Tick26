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
import type { ClockSize, CalibrationSettings } from '../types';

// Singleton state - shared across all component instances
let isSharedStateInitialized = false;

// Shared reactive state
const clockSize: Ref<ClockSize> = ref('medium');
const sensitivity: Ref<number> = ref(1.0);
const threshold: Ref<number> = ref(0.05);
const isCalibrating: Ref<boolean> = ref(false);
const calibrationProgress: Ref<number> = ref(0);

// Calibration sample collection
let tickSamples: number[] = [];

// localStorage key for calibration persistence
const STORAGE_KEY = 'tick-tack-calibration';

// Minimum ticks required for calibration completion
const MIN_TICKS_FOR_CALIBRATION = 10;

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
   * Validates: Requirement 2.3
   * 
   * Begins collecting tick samples for analysis
   */
  const startCalibration = (): void => {
    if (isCalibrating.value) {
      console.warn('Calibration already in progress');
      return;
    }

    // Reset calibration state
    isCalibrating.value = true;
    calibrationProgress.value = 0;
    tickSamples = [];
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

    isCalibrating.value = false;
    calibrationProgress.value = 0;
    tickSamples = [];
  };

  /**
   * Complete the calibration process
   * Validates: Requirement 2.3
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

    // Validate minimum tick count
    if (tickSamples.length < MIN_TICKS_FOR_CALIBRATION) {
      console.warn(`Insufficient samples: ${tickSamples.length} < ${MIN_TICKS_FOR_CALIBRATION}`);
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
    clockSize.value = 'medium';
    sensitivity.value = 1.0;
    threshold.value = 0.05;
    isCalibrating.value = false;
    calibrationProgress.value = 0;
    tickSamples = [];

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

  // Return reactive state and methods
  return {
    // State
    clockSize,
    sensitivity,
    threshold,
    isCalibrating,
    calibrationProgress,
    isCalibrated,
    hasEnoughSamples,
    
    // Methods
    setClockSize,
    startCalibration,
    recordTickSample,
    stopCalibration,
    completeCalibration,
    saveCalibration,
    loadCalibration,
    resetCalibration,
    getExpectedFrequency
  };
}
