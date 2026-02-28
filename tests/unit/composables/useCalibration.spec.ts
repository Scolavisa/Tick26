import { describe, it, expect, beforeEach, vi } from 'vitest';

// Feature: tick-tack-timer, Unit tests for useCalibration composable
// Validates: Requirements 2.3, 2.4, 12.3

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

global.localStorage = localStorageMock as any;

describe('useCalibration composable', () => {
  let useCalibration: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset modules to clear singleton state
    vi.resetModules();

    // Dynamically import to get fresh singleton state
    const module = await import('../../../src/composables/useCalibration');
    useCalibration = module.useCalibration;
  });

  describe('Initialization', () => {
    it('returns reactive state and methods', () => {
      const calibration = useCalibration();

      // Check state properties
      expect(calibration.clockSize).toBeDefined();
      expect(calibration.sensitivity).toBeDefined();
      expect(calibration.threshold).toBeDefined();
      expect(calibration.isCalibrating).toBeDefined();
      expect(calibration.calibrationProgress).toBeDefined();
      expect(calibration.isCalibrated).toBeDefined();
      expect(calibration.hasEnoughSamples).toBeDefined();

      // Check methods
      expect(typeof calibration.setClockSize).toBe('function');
      expect(typeof calibration.startCalibration).toBe('function');
      expect(typeof calibration.recordTickSample).toBe('function');
      expect(typeof calibration.stopCalibration).toBe('function');
      expect(typeof calibration.completeCalibration).toBe('function');
      expect(typeof calibration.saveCalibration).toBe('function');
      expect(typeof calibration.loadCalibration).toBe('function');
      expect(typeof calibration.resetCalibration).toBe('function');
      expect(typeof calibration.getExpectedFrequency).toBe('function');
    });

    it('initializes with default state', () => {
      const calibration = useCalibration();

      expect(calibration.clockSize.value).toBe('medium');
      expect(calibration.sensitivity.value).toBe(1.0);
      expect(calibration.threshold.value).toBe(0.05);
      expect(calibration.isCalibrating.value).toBe(false);
      expect(calibration.calibrationProgress.value).toBe(0);
      expect(calibration.isCalibrated.value).toBe(false);
    });

    it('loads persisted calibration settings from localStorage', () => {
      const savedSettings = {
        clockSize: 'large',
        sensitivity: 1.5,
        threshold: 0.1,
        expectedFrequency: 0.75,
        calibratedAt: Date.now()
      };
      localStorageMock.setItem('tick-tack-calibration', JSON.stringify(savedSettings));

      const calibration = useCalibration();

      expect(calibration.clockSize.value).toBe('large');
      expect(calibration.sensitivity.value).toBe(1.5);
      expect(calibration.threshold.value).toBe(0.1);
    });
  });

  describe('Clock size management', () => {
    it('sets clock size', () => {
      const calibration = useCalibration();

      calibration.setClockSize('small');
      expect(calibration.clockSize.value).toBe('small');

      calibration.setClockSize('large');
      expect(calibration.clockSize.value).toBe('large');
    });

    it('returns correct expected frequency for small clock', () => {
      const calibration = useCalibration();

      calibration.setClockSize('small');
      expect(calibration.getExpectedFrequency()).toBe(5.5);
    });

    it('returns correct expected frequency for medium clock', () => {
      const calibration = useCalibration();

      calibration.setClockSize('medium');
      expect(calibration.getExpectedFrequency()).toBe(2.5);
    });

    it('returns correct expected frequency for large clock', () => {
      const calibration = useCalibration();

      calibration.setClockSize('large');
      expect(calibration.getExpectedFrequency()).toBe(0.75);
    });
  });

  describe('Calibration state machine', () => {
    it('starts calibration process', () => {
      const calibration = useCalibration();

      calibration.startCalibration();

      expect(calibration.isCalibrating.value).toBe(true);
      expect(calibration.calibrationProgress.value).toBe(0);
    });

    it('prevents starting calibration when already in progress', () => {
      const calibration = useCalibration();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      calibration.startCalibration();
      calibration.startCalibration(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('Calibration already in progress');
      consoleSpy.mockRestore();
    });

    it('stops calibration process', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      calibration.recordTickSample(0.1);
      calibration.recordTickSample(0.12);

      calibration.stopCalibration();

      expect(calibration.isCalibrating.value).toBe(false);
      expect(calibration.calibrationProgress.value).toBe(0);
    });

    it('records tick samples during calibration', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      calibration.recordTickSample(0.1);
      expect(calibration.calibrationProgress.value).toBe(1);

      calibration.recordTickSample(0.12);
      expect(calibration.calibrationProgress.value).toBe(2);

      calibration.recordTickSample(0.11);
      expect(calibration.calibrationProgress.value).toBe(3);
    });

    it('ignores tick samples when not calibrating', () => {
      const calibration = useCalibration();

      calibration.recordTickSample(0.1);

      expect(calibration.calibrationProgress.value).toBe(0);
    });

    it('tracks hasEnoughSamples computed property', () => {
      const calibration = useCalibration();

      expect(calibration.hasEnoughSamples.value).toBe(false);

      calibration.startCalibration();
      
      // Add 9 samples - not enough
      for (let i = 0; i < 9; i++) {
        calibration.recordTickSample(0.1 + i * 0.01);
      }
      expect(calibration.hasEnoughSamples.value).toBe(false);

      // Add 10th sample - now enough
      calibration.recordTickSample(0.2);
      expect(calibration.hasEnoughSamples.value).toBe(true);
    });
  });

  describe('Calibration completion and calculation', () => {
    it('completes calibration with sufficient samples', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      // Add 10 samples
      for (let i = 0; i < 10; i++) {
        calibration.recordTickSample(0.1 + i * 0.01);
      }

      const result = calibration.completeCalibration();

      expect(result).toBe(true);
      expect(calibration.isCalibrating.value).toBe(false);
      expect(calibration.isCalibrated.value).toBe(true);
    });

    it('fails to complete calibration with insufficient samples', () => {
      const calibration = useCalibration();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      calibration.startCalibration();
      
      // Add only 5 samples
      for (let i = 0; i < 5; i++) {
        calibration.recordTickSample(0.1);
      }

      const result = calibration.completeCalibration();

      expect(result).toBe(false);
      expect(calibration.isCalibrating.value).toBe(true); // Still calibrating
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('calculates threshold based on median amplitude', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      // Add samples with known median
      const samples = [0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17];
      samples.forEach(s => calibration.recordTickSample(s));

      calibration.completeCalibration();

      // Threshold should be ~60% of median (0.125)
      expect(calibration.threshold.value).toBeCloseTo(0.075, 2);
    });

    it('calculates sensitivity based on signal variation (high variation)', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      // High variation samples
      const samples = [0.05, 0.06, 0.10, 0.12, 0.15, 0.18, 0.20, 0.22, 0.25, 0.30];
      samples.forEach(s => calibration.recordTickSample(s));

      calibration.completeCalibration();

      // High variation should result in lower sensitivity
      expect(calibration.sensitivity.value).toBe(0.7);
    });

    it('calculates sensitivity based on signal variation (medium variation)', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      // Medium variation samples
      const samples = [0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17];
      samples.forEach(s => calibration.recordTickSample(s));

      calibration.completeCalibration();

      // The coefficient for these samples is (0.17-0.08)/0.125 = 0.72, which is > 0.5
      // So it should result in lower sensitivity (0.7), not standard (1.0)
      expect(calibration.sensitivity.value).toBe(0.7);
    });

    it('calculates sensitivity based on signal variation (low variation)', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      // Low variation samples
      const samples = [0.098, 0.099, 0.100, 0.101, 0.102, 0.103, 0.104, 0.105, 0.106, 0.107];
      samples.forEach(s => calibration.recordTickSample(s));

      calibration.completeCalibration();

      // Low variation should result in higher sensitivity
      expect(calibration.sensitivity.value).toBe(1.3);
    });

    it('auto-saves calibration after completion', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      for (let i = 0; i < 10; i++) {
        calibration.recordTickSample(0.1);
      }

      calibration.completeCalibration();

      // Check that settings were saved to localStorage
      const saved = localStorageMock.getItem('tick-tack-calibration');
      expect(saved).not.toBeNull();
      
      const settings = JSON.parse(saved!);
      expect(settings.clockSize).toBe('medium');
      expect(settings.sensitivity).toBeDefined();
      expect(settings.threshold).toBeDefined();
    });
  });

  describe('localStorage persistence', () => {
    it('saves calibration settings to localStorage', () => {
      const calibration = useCalibration();

      calibration.setClockSize('small');
      calibration.saveCalibration();

      const saved = localStorageMock.getItem('tick-tack-calibration');
      expect(saved).not.toBeNull();
      
      const settings = JSON.parse(saved!);
      expect(settings.clockSize).toBe('small');
      expect(settings.sensitivity).toBe(1.0);
      expect(settings.threshold).toBe(0.05);
      expect(settings.expectedFrequency).toBe(5.5);
      expect(settings.calibratedAt).toBeDefined();
    });

    it('loads calibration settings from localStorage', () => {
      const savedSettings = {
        clockSize: 'large',
        sensitivity: 1.8,
        threshold: 0.15,
        expectedFrequency: 0.75,
        calibratedAt: Date.now()
      };
      localStorageMock.setItem('tick-tack-calibration', JSON.stringify(savedSettings));

      const calibration = useCalibration();
      calibration.loadCalibration();

      expect(calibration.clockSize.value).toBe('large');
      expect(calibration.sensitivity.value).toBe(1.8);
      expect(calibration.threshold.value).toBe(0.15);
    });

    it('handles missing localStorage data gracefully', () => {
      const calibration = useCalibration();
      calibration.loadCalibration();

      // Should have default values
      expect(calibration.clockSize.value).toBe('medium');
      expect(calibration.sensitivity.value).toBe(1.0);
      expect(calibration.threshold.value).toBe(0.05);
    });

    it('handles corrupted localStorage data gracefully', () => {
      localStorageMock.setItem('tick-tack-calibration', 'invalid json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const calibration = useCalibration();

      // Should not throw and should have default values
      expect(calibration.clockSize.value).toBe('medium');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('resets calibration settings', () => {
      const calibration = useCalibration();

      // Set non-default values
      calibration.setClockSize('large');
      calibration.startCalibration();
      for (let i = 0; i < 10; i++) {
        calibration.recordTickSample(0.2);
      }
      calibration.completeCalibration();

      // Reset
      calibration.resetCalibration();

      expect(calibration.clockSize.value).toBe('medium');
      expect(calibration.sensitivity.value).toBe(1.0);
      expect(calibration.threshold.value).toBe(0.05);
      expect(calibration.isCalibrating.value).toBe(false);
      expect(calibration.calibrationProgress.value).toBe(0);
      expect(calibration.isCalibrated.value).toBe(false);

      // Should also clear from localStorage
      const saved = localStorageMock.getItem('tick-tack-calibration');
      expect(saved).toBeNull();
    });
  });

  describe('Computed properties', () => {
    it('isCalibrated is false with default values', () => {
      const calibration = useCalibration();

      expect(calibration.isCalibrated.value).toBe(false);
    });

    it('isCalibrated is true after successful calibration', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      for (let i = 0; i < 10; i++) {
        calibration.recordTickSample(0.1);
      }
      calibration.completeCalibration();

      expect(calibration.isCalibrated.value).toBe(true);
    });

    it('hasEnoughSamples tracks minimum tick requirement', () => {
      const calibration = useCalibration();

      calibration.startCalibration();
      
      for (let i = 0; i < 9; i++) {
        calibration.recordTickSample(0.1);
        expect(calibration.hasEnoughSamples.value).toBe(false);
      }

      calibration.recordTickSample(0.1);
      expect(calibration.hasEnoughSamples.value).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles empty sample array in completeCalibration', () => {
      const calibration = useCalibration();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      calibration.startCalibration();
      const result = calibration.completeCalibration();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('handles completeCalibration when not calibrating', () => {
      const calibration = useCalibration();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = calibration.completeCalibration();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('No calibration in progress');
      
      consoleSpy.mockRestore();
    });

    it('handles stopCalibration when not calibrating', () => {
      const calibration = useCalibration();

      // Should not throw
      expect(() => calibration.stopCalibration()).not.toThrow();
    });
  });
});
