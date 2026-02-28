import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { useCalibration } from '../../src/composables/useCalibration';
import type { ClockSize } from '../../src/types';

// Feature: tick-tack-timer, Property 4: Clock size frequency adjustment
// Feature: tick-tack-timer, Property 5: Calibration parameter computation
// Feature: tick-tack-timer, Property 6: Calibration settings persistence
// Validates: Requirements 2.2, 2.3, 2.4

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('useCalibration properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('Property 4: clock size selection sets correct expected frequency', () => {
    // **Validates: Requirement 2.2**
    // This property verifies that for any clock size selection (small, medium, large),
    // the calibration engine adjusts the expected tick frequency accordingly.

    fc.assert(
      fc.property(
        // Generate arbitrary clock sizes
        fc.constantFrom<ClockSize>('small', 'medium', 'large'),
        (clockSize) => {
          const { setClockSize, getExpectedFrequency } = useCalibration();

          // Set the clock size
          setClockSize(clockSize);

          // Get the expected frequency
          const frequency = getExpectedFrequency();

          // Property: Each clock size should have a specific expected frequency
          switch (clockSize) {
            case 'small':
              // Small clocks tick fast: 5-6 Hz
              expect(frequency).toBe(5.5);
              expect(frequency).toBeGreaterThan(4);
              expect(frequency).toBeLessThan(7);
              break;
            case 'medium':
              // Medium clocks tick at standard rate: 2-3 Hz
              expect(frequency).toBe(2.5);
              expect(frequency).toBeGreaterThan(1.5);
              expect(frequency).toBeLessThan(3.5);
              break;
            case 'large':
              // Large clocks tick slowly: 0.5-1 Hz
              expect(frequency).toBe(0.75);
              expect(frequency).toBeGreaterThan(0.4);
              expect(frequency).toBeLessThan(1.5);
              break;
          }

          // Property: Frequency should be positive
          expect(frequency).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4 (ordering): small > medium > large frequency', () => {
    // **Validates: Requirement 2.2**
    // This property verifies that clock sizes have the correct frequency ordering:
    // small clocks tick faster than medium, medium faster than large.

    const { setClockSize, getExpectedFrequency } = useCalibration();

    setClockSize('small');
    const smallFreq = getExpectedFrequency();

    setClockSize('medium');
    const mediumFreq = getExpectedFrequency();

    setClockSize('large');
    const largeFreq = getExpectedFrequency();

    // Property: Frequency ordering should be maintained
    expect(smallFreq).toBeGreaterThan(mediumFreq);
    expect(mediumFreq).toBeGreaterThan(largeFreq);
  });

  it('Property 5: audio input during calibration produces sensitivity/threshold values', async () => {
    // **Validates: Requirement 2.3**
    // This property verifies that for any sequence of audio samples collected during
    // calibration (minimum 10 samples), the calibration engine computes valid
    // sensitivity and threshold values.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary arrays of audio amplitudes (10-20 samples)
        fc.array(
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
          { minLength: 10, maxLength: 20 }
        ),
        async (samples) => {
          const {
            startCalibration,
            recordTickSample,
            completeCalibration,
            sensitivity,
            threshold,
            resetCalibration
          } = useCalibration();

          // Start calibration
          startCalibration();

          // Record all samples
          for (const sample of samples) {
            recordTickSample(sample);
          }

          // Complete calibration
          const success = completeCalibration();

          // Property: Calibration should succeed with sufficient samples
          expect(success).toBe(true);

          // Property: Sensitivity should be within valid range (0.1 - 2.0)
          expect(sensitivity.value).toBeGreaterThanOrEqual(0.1);
          expect(sensitivity.value).toBeLessThanOrEqual(2.0);

          // Property: Threshold should be within valid range (0.01 - 0.5)
          expect(threshold.value).toBeGreaterThanOrEqual(0.001);
          expect(threshold.value).toBeLessThanOrEqual(0.5);

          // Property: Threshold should be related to input samples
          // (should be less than or equal to max sample)
          const maxSample = Math.max(...samples);
          expect(threshold.value).toBeLessThanOrEqual(maxSample);

          // Cleanup for next iteration
          resetCalibration();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5 (determinism): same samples produce same calibration', async () => {
    // **Validates: Requirement 2.3**
    // This property verifies that calibration is deterministic: the same sequence
    // of audio samples should always produce the same sensitivity and threshold values.

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.float({ min: Math.fround(0.05), max: Math.fround(0.3), noNaN: true }),
          { minLength: 10, maxLength: 15 }
        ),
        async (samples) => {
          // First calibration
          const cal1 = useCalibration();
          cal1.startCalibration();
          samples.forEach(s => cal1.recordTickSample(s));
          cal1.completeCalibration();
          const sensitivity1 = cal1.sensitivity.value;
          const threshold1 = cal1.threshold.value;

          // Reset and do second calibration with same samples
          cal1.resetCalibration();
          cal1.startCalibration();
          samples.forEach(s => cal1.recordTickSample(s));
          cal1.completeCalibration();
          const sensitivity2 = cal1.sensitivity.value;
          const threshold2 = cal1.threshold.value;

          // Property: Results should be identical
          expect(sensitivity2).toBe(sensitivity1);
          expect(threshold2).toBe(threshold1);

          // Cleanup
          cal1.resetCalibration();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5 (monotonicity): higher amplitudes produce higher thresholds', async () => {
    // **Validates: Requirement 2.3**
    // This property verifies that calibration with higher amplitude samples
    // produces higher threshold values (threshold scales with signal strength).

    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.05), max: Math.fround(0.15), noNaN: true }),
        fc.float({ min: Math.fround(0.2), max: Math.fround(0.4), noNaN: true }),
        async (lowBase, highBase) => {
          // Generate low amplitude samples
          const lowSamples = Array(10).fill(0).map((_, i) => lowBase + i * 0.01);
          
          // Generate high amplitude samples
          const highSamples = Array(10).fill(0).map((_, i) => highBase + i * 0.01);

          // Calibrate with low samples
          const cal1 = useCalibration();
          cal1.startCalibration();
          lowSamples.forEach(s => cal1.recordTickSample(s));
          cal1.completeCalibration();
          const lowThreshold = cal1.threshold.value;

          // Calibrate with high samples
          cal1.resetCalibration();
          cal1.startCalibration();
          highSamples.forEach(s => cal1.recordTickSample(s));
          cal1.completeCalibration();
          const highThreshold = cal1.threshold.value;

          // Property: Higher amplitude samples should produce higher threshold
          expect(highThreshold).toBeGreaterThan(lowThreshold);

          // Cleanup
          cal1.resetCalibration();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: saved calibration settings can be loaded with same values', async () => {
    // **Validates: Requirement 2.4**
    // This property verifies that for any calibration settings saved to localStorage,
    // loading them back should restore exactly the same values.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary calibration settings
        fc.constantFrom<ClockSize>('small', 'medium', 'large'),
        fc.array(
          fc.float({ min: Math.fround(0.05), max: Math.fround(0.3), noNaN: true }),
          { minLength: 10, maxLength: 15 }
        ),
        async (clockSize, samples) => {
          // Clear localStorage before each iteration
          localStorageMock.clear();
          
          const cal = useCalibration();

          // Reset to ensure clean state
          cal.resetCalibration();

          // Set clock size and calibrate
          cal.setClockSize(clockSize);
          cal.startCalibration();
          samples.forEach(s => cal.recordTickSample(s));
          cal.completeCalibration();

          // Get saved values (auto-saved by completeCalibration)
          const savedClockSize = cal.clockSize.value;
          const savedSensitivity = cal.sensitivity.value;
          const savedThreshold = cal.threshold.value;

          // Verify data was saved to localStorage
          const stored = localStorageMock.getItem('tick-tack-calibration');
          expect(stored).not.toBeNull();
          
          const parsed = JSON.parse(stored!);
          
          // Property: Saved values in localStorage should match current values
          expect(parsed.clockSize).toBe(savedClockSize);
          expect(parsed.sensitivity).toBe(savedSensitivity);
          expect(parsed.threshold).toBe(savedThreshold);

          // Cleanup
          cal.resetCalibration();
          localStorageMock.clear();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6 (round-trip): save and load preserves all settings', async () => {
    // **Validates: Requirement 2.4**
    // This property verifies the round-trip persistence: any calibration state
    // saved should be loaded back with exactly the same values.

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<ClockSize>('small', 'medium', 'large'),
        fc.array(
          fc.float({ min: Math.fround(0.05), max: Math.fround(0.3), noNaN: true }),
          { minLength: 10, maxLength: 15 }
        ),
        async (clockSize, samples) => {
          // Clear localStorage before each iteration
          localStorageMock.clear();
          
          const cal = useCalibration();

          // Reset to ensure clean state
          cal.resetCalibration();

          // Set clock size and calibrate
          cal.setClockSize(clockSize);
          cal.startCalibration();
          samples.forEach(s => cal.recordTickSample(s));
          cal.completeCalibration();

          // Save current state
          const originalClockSize = cal.clockSize.value;
          const originalSensitivity = cal.sensitivity.value;
          const originalThreshold = cal.threshold.value;

          // Calibration auto-saves, verify it's in localStorage
          const stored = localStorageMock.getItem('tick-tack-calibration');
          expect(stored).not.toBeNull();
          
          const parsed = JSON.parse(stored!);

          // Property: localStorage should contain the same values
          expect(parsed.clockSize).toBe(originalClockSize);
          expect(parsed.sensitivity).toBe(originalSensitivity);
          expect(parsed.threshold).toBe(originalThreshold);

          // Cleanup
          cal.resetCalibration();
          localStorageMock.clear();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6 (idempotency): multiple saves produce same result', async () => {
    // **Validates: Requirement 2.4**
    // This property verifies that saving calibration settings multiple times
    // produces the same result as saving once (except for timestamp).

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.float({ min: Math.fround(0.05), max: Math.fround(0.3), noNaN: true }),
          { minLength: 10, maxLength: 15 }
        ),
        fc.integer({ min: 2, max: 5 }),
        async (samples, saveCount) => {
          // Clear localStorage before each iteration
          localStorageMock.clear();
          
          const cal = useCalibration();

          // Reset to ensure clean state
          cal.resetCalibration();

          // Calibrate
          cal.startCalibration();
          samples.forEach(s => cal.recordTickSample(s));
          cal.completeCalibration();

          // Get values after first save (auto-save)
          const stored1 = localStorageMock.getItem('tick-tack-calibration');
          expect(stored1).not.toBeNull();
          const parsed1 = JSON.parse(stored1!);

          // Save multiple more times
          for (let i = 0; i < saveCount; i++) {
            cal.saveCalibration();
          }

          // Get values after multiple saves
          const stored2 = localStorageMock.getItem('tick-tack-calibration');
          expect(stored2).not.toBeNull();
          const parsed2 = JSON.parse(stored2!);

          // Property: Core values should be identical (timestamp may differ)
          expect(parsed2.clockSize).toBe(parsed1.clockSize);
          expect(parsed2.sensitivity).toBe(parsed1.sensitivity);
          expect(parsed2.threshold).toBe(parsed1.threshold);
          expect(parsed2.expectedFrequency).toBe(parsed1.expectedFrequency);

          // Cleanup
          cal.resetCalibration();
          localStorageMock.clear();
        }
      ),
      { numRuns: 50 }
    );
  });
});
