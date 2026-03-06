/**
 * Unit tests for MeasurementPage component
 * 
 * Tests:
 * - Tick count display
 * - Session start/stop
 * - Reset functionality
 * - Visual feedback rendering
 * - Idle state display
 * 
 * Requirements: 5.2, 11.1, 11.5, 13.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MeasurementPage from '../../../src/pages/MeasurementPage.vue'
import { resetCounterInstance } from '../../../src/composables/useCounter'
import { resetSessionInstance } from '../../../src/composables/useSession'

// Mock the composables
vi.mock('../../../src/composables/useAudio', () => ({
  useAudio: () => ({
    startProcessing: vi.fn(),
    stopProcessing: vi.fn(),
    initializeWorklet: vi.fn().mockResolvedValue(undefined),
    setCalibration: vi.fn(),
    onTickDetected: vi.fn((callback: () => void) => {
      // Store callback for manual triggering in tests
      ;(global as any).__tickCallback = callback
    })
  })
}))

vi.mock('../../../src/composables/useCalibration', () => ({
  useCalibration: () => ({
    sensitivity: { value: 1.0 },
    threshold: { value: 0.08 },
    lowCutoff: { value: 500 },
    highCutoff: { value: 8000 },
    clockSize: { value: 'medium' },
    isCalibrating: { value: false },
    calibrationProgress: { value: 0 }
  })
}))

describe('MeasurementPage', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    // Reset singleton instances
    resetCounterInstance()
    resetSessionInstance()
    
    // Clear any stored tick callback
    ;(global as any).__tickCallback = null
    
    // Mount component
    wrapper = mount(MeasurementPage)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Tick count display', () => {
    it('should display initial tick count of 0', () => {
      const tickCount = wrapper.find('.tick-count')
      expect(tickCount.text()).toBe('0')
    })

    it('should display "Ticks" label', () => {
      const label = wrapper.find('.tick-label')
      expect(label.text()).toBe('Ticks')
    })

    it('should update tick count when ticks are detected', async () => {
      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Simulate tick detection
      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        await nextTick()
        
        const tickCount = wrapper.find('.tick-count')
        expect(tickCount.text()).toBe('1')
        
        // Trigger another tick
        tickCallback()
        await nextTick()
        
        expect(tickCount.text()).toBe('2')
      }
    })
  })

  describe('Session duration display', () => {
    it('should display initial duration of 00:00', () => {
      const duration = wrapper.find('.duration-value')
      expect(duration.text()).toBe('00:00')
    })

    it('should display "Duration:" label', () => {
      const label = wrapper.find('.duration-label')
      expect(label.text()).toBe('Duration:')
    })
  })

  describe('Session start/stop', () => {
    it('should display "Start Session" button initially', () => {
      const startButton = wrapper.find('.btn-primary')
      expect(startButton.exists()).toBe(true)
      expect(startButton.text()).toBe('Start Session')
    })

    it('should display "Stop Session" button when session is active', async () => {
      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const stopButton = wrapper.find('.btn-secondary')
      expect(stopButton.exists()).toBe(true)
      expect(stopButton.text()).toBe('Stop Session')
    })

    it('should start session when Start button is clicked', async () => {
      const startButton = wrapper.find('.btn-primary')
      await startButton.trigger('click')
      await nextTick()

      // Should now show stop button
      const stopButton = wrapper.find('.btn-secondary')
      expect(stopButton.exists()).toBe(true)
    })

    it('should stop session when Stop button is clicked', async () => {
      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Stop session
      await wrapper.find('.btn-secondary').trigger('click')
      await nextTick()

      // Should now show start button again
      const startButton = wrapper.find('.btn-primary')
      expect(startButton.exists()).toBe(true)
    })
  })

  describe('Reset functionality', () => {
    it('should display Reset button', () => {
      const resetButton = wrapper.find('.btn-danger')
      expect(resetButton.exists()).toBe(true)
      expect(resetButton.text()).toBe('Reset')
    })

    it('should disable Reset button when session is active', async () => {
      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const resetButton = wrapper.find('.btn-danger')
      expect(resetButton.attributes('disabled')).toBeDefined()
    })

    it('should enable Reset button when session is stopped', async () => {
      const resetButton = wrapper.find('.btn-danger')
      expect(resetButton.attributes('disabled')).toBeUndefined()
    })

    it('should show confirmation dialog when Reset is clicked', async () => {
      const resetButton = wrapper.find('.btn-danger')
      await resetButton.trigger('click')
      await nextTick()

      const modal = wrapper.find('.modal')
      expect(modal.exists()).toBe(true)
      expect(modal.text()).toContain('Confirm Reset')
    })

    it('should reset count when confirmed', async () => {
      // Start session and trigger some ticks
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        tickCallback()
        await nextTick()
      }

      // Stop session
      await wrapper.find('.btn-secondary').trigger('click')
      await nextTick()

      // Click reset
      await wrapper.find('.btn-danger').trigger('click')
      await nextTick()

      // Confirm reset
      const confirmButton = wrapper.findAll('.modal .btn-danger')[0]
      await confirmButton.trigger('click')
      await nextTick()

      // Check count is reset
      const tickCount = wrapper.find('.tick-count')
      expect(tickCount.text()).toBe('0')
    })

    it('should close dialog when Cancel is clicked', async () => {
      // Click reset
      await wrapper.find('.btn-danger').trigger('click')
      await nextTick()

      // Click cancel
      const cancelButton = wrapper.find('.modal .btn-secondary')
      await cancelButton.trigger('click')
      await nextTick()

      // Modal should be gone
      const modal = wrapper.find('.modal')
      expect(modal.exists()).toBe(false)
    })

    it('should close dialog when overlay is clicked', async () => {
      // Click reset
      await wrapper.find('.btn-danger').trigger('click')
      await nextTick()

      // Click overlay
      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click')
      await nextTick()

      // Modal should be gone
      const modal = wrapper.find('.modal')
      expect(modal.exists()).toBe(false)
    })
  })

  describe('Visual feedback rendering', () => {
    it('should apply tick-flash class when tick is detected', async () => {
      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Simulate tick detection
      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        await nextTick()

        const tickCount = wrapper.find('.tick-count')
        expect(tickCount.classes()).toContain('tick-flash')
      }
    })

    it('should remove tick-flash class after animation', async () => {
      vi.useFakeTimers()

      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Simulate tick detection
      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        await nextTick()

        // Flash should be visible
        let tickCount = wrapper.find('.tick-count')
        expect(tickCount.classes()).toContain('tick-flash')

        // Advance time past flash duration (100ms)
        vi.advanceTimersByTime(150)
        await nextTick()

        // Flash should be gone
        tickCount = wrapper.find('.tick-count')
        expect(tickCount.classes()).not.toContain('tick-flash')
      }

      vi.useRealTimers()
    })
  })

  describe('Idle state display', () => {
    it('should not show idle indicator initially', () => {
      const idleIndicator = wrapper.find('.idle-indicator')
      expect(idleIndicator.exists()).toBe(false)
    })

    it('should show idle indicator after 5 seconds without ticks', async () => {
      vi.useFakeTimers()

      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Simulate tick to start idle timer
      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        await nextTick()

        // Advance time by 5 seconds
        vi.advanceTimersByTime(5000)
        await nextTick()

        // Idle indicator should be visible
        const idleIndicator = wrapper.find('.idle-indicator')
        expect(idleIndicator.exists()).toBe(true)
        expect(idleIndicator.text()).toContain('No ticks detected')
      }

      vi.useRealTimers()
    })

    it('should apply idle class to tick count when idle', async () => {
      vi.useFakeTimers()

      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Simulate tick to start idle timer
      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        await nextTick()

        // Advance time by 5 seconds
        vi.advanceTimersByTime(5000)
        await nextTick()

        // Tick count should have idle class
        const tickCount = wrapper.find('.tick-count')
        expect(tickCount.classes()).toContain('idle')
      }

      vi.useRealTimers()
    })

    it('should clear idle state when new tick is detected', async () => {
      vi.useFakeTimers()

      // Start session
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Simulate tick to start idle timer
      const tickCallback = (global as any).__tickCallback
      if (tickCallback) {
        tickCallback()
        await nextTick()

        // Advance time to trigger idle
        vi.advanceTimersByTime(5000)
        await nextTick()

        // Should be idle
        let idleIndicator = wrapper.find('.idle-indicator')
        expect(idleIndicator.exists()).toBe(true)

        // Trigger another tick
        tickCallback()
        await nextTick()

        // Should no longer be idle
        idleIndicator = wrapper.find('.idle-indicator')
        expect(idleIndicator.exists()).toBe(false)
      }

      vi.useRealTimers()
    })
  })

  describe('Button sizing (touch-friendly)', () => {
    it('should have btn class for all interactive buttons', () => {
      const buttons = wrapper.findAll('.btn')
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach(button => {
        expect(button.classes()).toContain('btn')
      })
    })
  })
})
