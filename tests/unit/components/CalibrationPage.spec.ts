/**
 * Unit tests for CalibrationPage component
 * Validates: Requirements 2.1, 2.5, 12.1, 12.2, 12.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { ref } from 'vue';
import CalibrationPage from '../../../src/pages/CalibrationPage.vue';
import type { ClockSize } from '../../../src/types';

// Mock composables with proper Vue refs
const mockClockSize = ref<ClockSize>('medium');
const mockIsCalibrating = ref(false);
const mockCalibrationProgress = ref(0);
const mockHasEnoughSamples = ref(false);
const mockIsCalibrated = ref(false);

const mockIsInitialized = ref(true);
const mockPermissionGranted = ref(true);

const mockSetClockSize = vi.fn();
const mockStartCalibration = vi.fn();
const mockStopCalibration = vi.fn();
const mockCompleteCalibration = vi.fn(() => true);
const mockRecordTickSample = vi.fn();

const mockOnTickDetected = vi.fn();
const mockSetCalibration = vi.fn();
const mockStartProcessing = vi.fn();
const mockStopProcessing = vi.fn();

vi.mock('../../../src/composables/useCalibration', () => ({
  useCalibration: () => ({
    clockSize: mockClockSize,
    isCalibrating: mockIsCalibrating,
    calibrationProgress: mockCalibrationProgress,
    hasEnoughSamples: mockHasEnoughSamples,
    isCalibrated: mockIsCalibrated,
    setClockSize: mockSetClockSize,
    startCalibration: mockStartCalibration,
    stopCalibration: mockStopCalibration,
    completeCalibration: mockCompleteCalibration,
    recordTickSample: mockRecordTickSample
  })
}));

vi.mock('../../../src/composables/useAudio', () => ({
  useAudio: () => ({
    isInitialized: mockIsInitialized,
    permissionGranted: mockPermissionGranted,
    onTickDetected: mockOnTickDetected,
    setCalibration: mockSetCalibration,
    startProcessing: mockStartProcessing,
    stopProcessing: mockStopProcessing
  })
}));

describe('CalibrationPage', () => {
  let wrapper: VueWrapper;
  let router: any;

  // Helper to remount component with current mock state
  const remountComponent = async () => {
    if (wrapper) {
      wrapper.unmount();
    }
    
    wrapper = mount(CalibrationPage, {
      global: {
        plugins: [router]
      }
    });
    
    await wrapper.vm.$nextTick();
  };

  beforeEach(async () => {
    // Reset mocks
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

    await remountComponent();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  describe('Clock Size Selection', () => {
    it('should display three clock size buttons', () => {
      const buttons = wrapper.findAll('.size-button');
      expect(buttons).toHaveLength(3);
      expect(buttons[0].text()).toBe('Small');
      expect(buttons[1].text()).toBe('Medium');
      expect(buttons[2].text()).toBe('Large');
    });

    it('should highlight the selected clock size', async () => {
      mockClockSize.value = 'small';
      await remountComponent();
      
      const buttons = wrapper.findAll('.size-button');
      expect(buttons[0].classes()).toContain('active');
      expect(buttons[1].classes()).not.toContain('active');
      expect(buttons[2].classes()).not.toContain('active');
    });

    it('should call setClockSize when a size button is clicked', async () => {
      const buttons = wrapper.findAll('.size-button');
      await buttons[2].trigger('click'); // Click "Large"
      await wrapper.vm.$nextTick();
      
      expect(mockSetClockSize).toHaveBeenCalledWith('large');
    });

    it('should disable size buttons during calibration', async () => {
      mockIsCalibrating.value = true;
      await remountComponent();
      
      const buttons = wrapper.findAll('.size-button');
      buttons.forEach(button => {
        expect(button.attributes('disabled')).toBeDefined();
      });
    });
  });

  describe('Calibration Start/Stop', () => {
    it('should display start button when not calibrating', async () => {
      mockIsCalibrating.value = false;
      await remountComponent();
      
      const startButton = wrapper.find('.start-button');
      expect(startButton.exists()).toBe(true);
      expect(startButton.text()).toBe('Start Calibration');
    });

    it('should display stop button when calibrating', async () => {
      mockIsCalibrating.value = true;
      await remountComponent();
      
      const stopButton = wrapper.find('.stop-button');
      expect(stopButton.exists()).toBe(true);
      expect(stopButton.text()).toBe('Stop Calibration');
    });

    it('should start calibration when start button is clicked', async () => {
      mockIsCalibrating.value = false;
      await remountComponent();
      
      const startButton = wrapper.find('.start-button');
      await startButton.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockStartCalibration).toHaveBeenCalled();
      expect(mockStartProcessing).toHaveBeenCalled();
    });

    it('should stop calibration when stop button is clicked', async () => {
      mockIsCalibrating.value = true;
      await remountComponent();
      
      const stopButton = wrapper.find('.stop-button');
      await stopButton.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockStopCalibration).toHaveBeenCalled();
      expect(mockStopProcessing).toHaveBeenCalled();
    });

    it('should disable start button when audio is not initialized', async () => {
      mockIsCalibrating.value = false;
      mockIsInitialized.value = false;
      await remountComponent();
      
      const startButton = wrapper.find('.start-button');
      expect(startButton.attributes('disabled')).toBeDefined();
    });
  });

  describe('Tick Count Display During Calibration', () => {
    it('should display tick count when calibrating', async () => {
      mockIsCalibrating.value = true;
      mockCalibrationProgress.value = 5;
      await remountComponent();
      
      const tickCount = wrapper.find('.tick-count');
      expect(tickCount.exists()).toBe(true);
      expect(tickCount.text()).toContain('5');
      expect(tickCount.text()).toContain('10'); // minimum required
    });

    it('should not display tick count when not calibrating', async () => {
      mockIsCalibrating.value = false;
      await remountComponent();
      
      const statusActive = wrapper.find('.status-active');
      expect(statusActive.exists()).toBe(false);
    });

    it('should update tick count display as ticks are detected', async () => {
      mockIsCalibrating.value = true;
      mockCalibrationProgress.value = 3;
      await remountComponent();
      
      let countValue = wrapper.find('.count-value');
      expect(countValue.text()).toBe('3');
      
      // Simulate more ticks detected
      mockCalibrationProgress.value = 7;
      await remountComponent();
      
      countValue = wrapper.find('.count-value');
      expect(countValue.text()).toBe('7');
    });
  });

  describe('Calibration Completion', () => {
    it('should complete calibration when minimum ticks are collected', async () => {
      mockIsCalibrating.value = true;
      mockCalibrationProgress.value = 9;
      mockHasEnoughSamples.value = false;
      await wrapper.vm.$nextTick();
      
      // Get the tick detected callback
      const tickCallback = mockOnTickDetected.mock.calls[0][0];
      
      // Simulate tick detection that reaches minimum
      mockHasEnoughSamples.value = true;
      tickCallback({ timestamp: Date.now(), amplitude: 0.5, confidence: 0.9 });
      
      await wrapper.vm.$nextTick();
      
      expect(mockCompleteCalibration).toHaveBeenCalled();
      expect(mockStopProcessing).toHaveBeenCalled();
    });

    it('should display success message after successful calibration', async () => {
      mockIsCalibrating.value = true;
      mockHasEnoughSamples.value = true;
      await wrapper.vm.$nextTick();
      
      // Get the tick detected callback
      const tickCallback = mockOnTickDetected.mock.calls[0][0];
      mockCompleteCalibration.mockReturnValue(true);
      
      // Trigger completion
      tickCallback({ timestamp: Date.now(), amplitude: 0.5, confidence: 0.9 });
      await wrapper.vm.$nextTick();
      
      const statusMessage = wrapper.find('.status-message.success');
      expect(statusMessage.exists()).toBe(true);
      expect(statusMessage.text()).toContain('successfully');
    });

    it('should enable navigation to measurement after successful calibration', async () => {
      mockIsCalibrated.value = true;
      mockIsCalibrating.value = false;
      await remountComponent();
      
      const navButton = wrapper.find('.nav-button');
      expect(navButton.attributes('disabled')).not.toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should display timeout message if no ticks detected within 30 seconds', async () => {
      mockIsCalibrating.value = false;
      mockCalibrationProgress.value = 0;
      await remountComponent();
      
      // Start calibration
      const startButton = wrapper.find('.start-button');
      await startButton.trigger('click');
      
      // Update state to calibrating (without remounting)
      mockIsCalibrating.value = true;
      await wrapper.vm.$nextTick();
      
      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);
      await wrapper.vm.$nextTick();
      
      const statusMessage = wrapper.find('.status-message.warning');
      expect(statusMessage.exists()).toBe(true);
      expect(statusMessage.text()).toContain('30 seconds');
      expect(statusMessage.text()).toContain('microphone placement');
    });

    it('should not timeout if ticks are being detected', async () => {
      mockIsCalibrating.value = false;
      mockCalibrationProgress.value = 0;
      await remountComponent();
      
      // Start calibration
      const startButton = wrapper.find('.start-button');
      await startButton.trigger('click');
      
      // Update state to calibrating with ticks detected (without remounting)
      mockIsCalibrating.value = true;
      mockCalibrationProgress.value = 5; // Some ticks detected
      await wrapper.vm.$nextTick();
      
      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);
      await wrapper.vm.$nextTick();
      
      // Should not show timeout message or stop calibration since ticks were detected
      expect(mockStopCalibration).not.toHaveBeenCalled();
    });
  });

  describe('Progress Indicator', () => {
    it('should display progress indicator during calibration', async () => {
      mockIsCalibrating.value = true;
      await remountComponent();
      
      const progressIndicator = wrapper.find('.progress-indicator');
      expect(progressIndicator.exists()).toBe(true);
      
      const spinner = wrapper.find('.spinner');
      expect(spinner.exists()).toBe(true);
    });

    it('should not display progress indicator when not calibrating', async () => {
      mockIsCalibrating.value = false;
      await remountComponent();
      
      const statusActive = wrapper.find('.status-active');
      expect(statusActive.exists()).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should navigate to measurement page when button is clicked', async () => {
      mockIsCalibrated.value = true;
      mockIsCalibrating.value = false;
      await remountComponent();
      
      const navButton = wrapper.find('.nav-button');
      await navButton.trigger('click');
      await wrapper.vm.$nextTick();
      
      // Wait for router navigation
      await router.isReady();
      
      expect(router.currentRoute.value.name).toBe('measurement');
    });

    it('should navigate to settings page when back button is clicked', async () => {
      const backButton = wrapper.find('.nav-button.secondary');
      expect(backButton.exists()).toBe(true);
      
      await backButton.trigger('click');
      await flushPromises();
      await router.isReady();
      
      expect(router.currentRoute.value.name).toBe('settings');
    });
  });
});
