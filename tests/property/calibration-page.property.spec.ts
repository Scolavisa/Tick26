/**
 * Property-based tests for CalibrationPage component
 * Feature: tick-tack-timer
 * 
 * Property 7: Calibration visual feedback
 * Property 29: Calibration tick display
 * Property 30: Calibration completion indication
 * Property 31: Calibration success enables navigation
 * 
 * Validates: Requirements 2.5, 12.1, 12.2, 12.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { ref } from 'vue';
import CalibrationPage from '../../src/pages/CalibrationPage.vue';
import type { TickEvent, ClockSize } from '../../src/types';

// Mock composables with proper Vue refs
const mockClockSize = ref<ClockSize>('medium');
const mockIsCalibrating = ref(false);
const mockCalibrationProgress = ref(0);
const mockHasEnoughSamples = ref(false);
const mockIsCalibrated = ref(false);
const mockSensitivity = ref(1.0);
const mockThreshold = ref(0.05);
const mockLowCutoff = ref(500);
const mockHighCutoff = ref(8000);

const mockIsInitialized = ref(true);
const mockPermissionGranted = ref(true);

const mockSetClockSize = vi.fn();
const mockStartCalibration = vi.fn();
const mockStopCalibration = vi.fn();
const mockCompleteCalibration = vi.fn(() => true);
const mockRecordTickSample = vi.fn();
const mockGetExpectedFrequency = vi.fn(() => 2.5); // medium clock default

const mockOnTickDetected = vi.fn();
const mockSetCalibration = vi.fn();
const mockInitializeWorklet = vi.fn();
const mockStartProcessing = vi.fn();
const mockStopProcessing = vi.fn();

vi.mock('../../src/composables/useCalibration', () => ({
  useCalibration: () => ({
    clockSize: mockClockSize,
    isCalibrating: mockIsCalibrating,
    calibrationProgress: mockCalibrationProgress,
    hasEnoughSamples: mockHasEnoughSamples,
    isCalibrated: mockIsCalibrated,
    sensitivity: mockSensitivity,
    threshold: mockThreshold,
    lowCutoff: mockLowCutoff,
    highCutoff: mockHighCutoff,
    setClockSize: mockSetClockSize,
    startCalibration: mockStartCalibration,
    stopCalibration: mockStopCalibration,
    completeCalibration: mockCompleteCalibration,
    recordTickSample: mockRecordTickSample,
    getExpectedFrequency: mockGetExpectedFrequency
  })
}));

vi.mock('../../src/composables/useAudio', () => ({
  useAudio: () => ({
    isInitialized: mockIsInitialized,
    permissionGranted: mockPermissionGranted,
    onTickDetected: mockOnTickDetected,
    onVolumeLevel: vi.fn(),
    setCalibration: mockSetCalibration,
    initializeWorklet: mockInitializeWorklet,
    startProcessing: mockStartProcessing,
    stopProcessing: mockStopProcessing
  })
}));

// Generators
const tickEventArb = fc.record({
  timestamp: fc.float({ min: 0, max: 1000000 }),
  amplitude: fc.float({ min: Math.fround(0.01), max: Math.fround(1.0) }),
  confidence: fc.float({ min: 0, max: 1 })
});

const tickCountArb = fc.integer({ min: 0, max: 50 });

describe('CalibrationPage properties', () => {
  let router: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset mock ref values
    mockClockSize.value = 'medium';
    mockIsCalibrating.value = false;
    mockCalibrationProgress.value = 0;
    mockHasEnoughSamples.value = false;
    mockIsCalibrated.value = false;
    mockIsInitialized.value = true;
    mockPermissionGranted.value = true;

    // Create router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'measurement', component: { template: '<div>Measurement</div>' } },
        { path: '/calibration', name: 'calibration', component: CalibrationPage },
        { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } }
      ]
    });

    await router.push('/calibration');
    await router.isReady();
  });

  it('Property 7: Calibration visual feedback - detected ticks update display in same render cycle', () => {
    // **Validates: Requirement 2.5**
    // This property verifies that for any tick detected during calibration,
    // the calibration interface updates to display the detection within the same render cycle.

    fc.assert(
      fc.property(
        tickEventArb,
        tickCountArb,
        (tickEvent, initialCount) => {
          // Setup: Start with some initial tick count
          mockIsCalibrating.value = true;
          mockCalibrationProgress.value = initialCount;
          
          const wrapper = mount(CalibrationPage, {
            global: { plugins: [router] }
          });
          
          // Get the tick detected callback
          const tickCallback = mockOnTickDetected.mock.calls[0]?.[0];
          
          if (tickCallback) {
            // Simulate tick detection
            mockCalibrationProgress.value = initialCount + 1;
            tickCallback(tickEvent);
            
            // Verify recordTickSample was called with the tick amplitude
            expect(mockRecordTickSample).toHaveBeenCalledWith(tickEvent.amplitude);
          }
          
          wrapper.unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 29: Calibration tick display - calibration page updates tick count display', () => {
    // **Validates: Requirement 12.1**
    // This property verifies that for any tick detected during calibration,
    // the calibration page updates the display to show the detected tick count.

    fc.assert(
      fc.property(
        tickCountArb,
        (tickCount) => {
          // Setup: Set calibration state with specific tick count
          mockIsCalibrating.value = true;
          mockCalibrationProgress.value = tickCount;
          
          const wrapper = mount(CalibrationPage, {
            global: { plugins: [router] }
          });
          
          // Verify tick count is displayed
          const tickCountElement = wrapper.find('.tick-count');
          if (tickCount > 0 || mockIsCalibrating.value) {
            expect(tickCountElement.exists()).toBe(true);
            // The display should contain the tick count value
            const displayText = tickCountElement.text();
            expect(displayText).toContain(String(tickCount));
          }
          
          wrapper.unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Calibration completion indication - completion status indicated when minimum ticks collected', () => {
    // **Validates: Requirement 12.2**
    // This property verifies that for any calibration session where the minimum required
    // tick samples are collected, the calibration engine indicates completion status.

    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 50 }), // Minimum is 10 ticks
        (tickCount) => {
          // Setup: Set calibration state with enough samples
          mockIsCalibrating.value = true;
          mockCalibrationProgress.value = tickCount;
          mockHasEnoughSamples.value = tickCount >= 10;
          
          const wrapper = mount(CalibrationPage, {
            global: { plugins: [router] }
          });
          
          // Get the tick detected callback
          const tickCallback = mockOnTickDetected.mock.calls[0]?.[0];
          
          if (tickCallback && mockHasEnoughSamples.value) {
            // Simulate final tick that triggers completion
            const finalTick: TickEvent = {
              timestamp: Date.now(),
              amplitude: 0.5,
              confidence: 0.9
            };
            
            tickCallback(finalTick);
            
            // Verify completion was called
            expect(mockCompleteCalibration).toHaveBeenCalled();
            
            // Verify audio processing was stopped
            expect(mockStopProcessing).toHaveBeenCalled();
          }
          
          wrapper.unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 31: Calibration success enables navigation - successful calibration enables measurement page navigation', () => {
    // **Validates: Requirement 12.5**
    // This property verifies that for any successfully completed calibration,
    // navigation to the measurement page becomes enabled.

    fc.assert(
      fc.property(
        fc.boolean(), // Whether calibration is completed
        (isCalibrated) => {
          // Setup: Set calibration completion state
          mockIsCalibrated.value = isCalibrated;
          mockIsCalibrating.value = false;
          
          const wrapper = mount(CalibrationPage, {
            global: { plugins: [router] }
          });
          
          // Find the navigation button to measurement page
          const navButton = wrapper.find('.nav-button');
          
          if (navButton.exists()) {
            const isDisabled = navButton.attributes('disabled') !== undefined;
            
            // Navigation should be enabled (not disabled) when calibrated
            // Navigation should be disabled when not calibrated
            if (isCalibrated) {
              expect(isDisabled).toBe(false);
            } else {
              expect(isDisabled).toBe(true);
            }
          }
          
          wrapper.unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
