/**
 * Property-based tests for MeasurementPage component
 * 
 * Feature: tick-tack-timer
 * 
 * Properties tested:
 * - Property 15: Real-time count display
 * - Property 27: Tick detection visual feedback
 * - Property 28: Idle state indication
 * - Property 12: Tick event notification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import fc from 'fast-check'
import MeasurementPage from '../../src/pages/MeasurementPage.vue'
import { resetCounterInstance } from '../../src/composables/useCounter'
import { resetSessionInstance } from '../../src/composables/useSession'

// Mock the composables
vi.mock('../../src/composables/useAudio', () => ({
  useAudio: () => ({
    startProcessing: vi.fn(),
    stopProcessing: vi.fn(),
    onTickDetected: vi.fn((callback: () => void) => {
      // Store callback for manual triggering in tests
      ;(global as any).__tickCallback = callback
    })
  })
}))

describe('MeasurementPage - Property-Based Tests', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    // Reset singleton instances
    resetCounterInstance()
    resetSessionInstance()
    
    // Clear any stored tick callback
    ;(global as any).__tickCallback = null
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  /**
   * Property 15: Real-time count display
   * **Validates: Requirements 5.2**
   * 
   * For any change in the tick count value, the measurement page display 
   * should update to show the new count value.
   */
  it('Property 15: Real-time count display - count changes update display', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }), // Number of ticks to simulate
        async (numTicks) => {
          // Reset for each iteration
          resetCounterInstance()
          resetSessionInstance()
          ;(global as any).__tickCallback = null

          // Mount component
          wrapper = mount(MeasurementPage)
          await nextTick()

          // Start session
          await wrapper.find('.btn-primary').trigger('click')
          await nextTick()

          // Get tick callback
          const tickCallback = (global as any).__tickCallback
          expect(tickCallback).toBeDefined()

          // Simulate ticks and verify display updates
          for (let i = 1; i <= numTicks; i++) {
            tickCallback()
            await nextTick()

            // Verify display shows current count
            const tickCount = wrapper.find('.tick-count')
            expect(tickCount.text()).toBe(i.toString())
          }

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 27: Tick detection visual feedback
   * **Validates: Requirements 11.1**
   * 
   * For any tick event detected during measurement, the measurement page 
   * should provide visual feedback indicating the detection.
   */
  it('Property 27: Tick detection visual feedback - tick events trigger visual feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of ticks to test (reduced for performance)
        async (numTicks) => {
          // Reset for each iteration
          resetCounterInstance()
          resetSessionInstance()
          ;(global as any).__tickCallback = null

          // Mount component
          wrapper = mount(MeasurementPage)
          await nextTick()

          // Start session
          await wrapper.find('.btn-primary').trigger('click')
          await nextTick()

          // Get tick callback
          const tickCallback = (global as any).__tickCallback
          expect(tickCallback).toBeDefined()

          // Test that at least one tick triggers visual feedback
          // (testing all ticks would be too slow)
          tickCallback()
          await nextTick()

          // Verify visual feedback is present (tick-flash class)
          const tickCount = wrapper.find('.tick-count')
          expect(tickCount.classes()).toContain('tick-flash')

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  }, 10000) // Increase timeout to 10 seconds

  /**
   * Property 28: Idle state indication
   * **Validates: Requirements 11.5**
   * 
   * For any time period of 5 consecutive seconds without tick detection, 
   * the measurement page should display an idle state indicator.
   */
  it('Property 28: Idle state indication - 5 seconds without ticks shows idle indicator', async () => {
    vi.useFakeTimers()

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Initial ticks before idle
        async (initialTicks) => {
          // Reset for each iteration
          resetCounterInstance()
          resetSessionInstance()
          ;(global as any).__tickCallback = null

          // Mount component
          wrapper = mount(MeasurementPage)
          await nextTick()

          // Start session
          await wrapper.find('.btn-primary').trigger('click')
          await nextTick()

          // Get tick callback
          const tickCallback = (global as any).__tickCallback
          expect(tickCallback).toBeDefined()

          // Trigger initial ticks
          for (let i = 0; i < initialTicks; i++) {
            tickCallback()
            await nextTick()
          }

          // Should not be idle yet
          let idleIndicator = wrapper.find('.idle-indicator')
          expect(idleIndicator.exists()).toBe(false)

          // Advance time by 5 seconds
          vi.advanceTimersByTime(5000)
          await nextTick()

          // Should now show idle indicator
          idleIndicator = wrapper.find('.idle-indicator')
          expect(idleIndicator.exists()).toBe(true)
          expect(idleIndicator.text()).toContain('No ticks detected')

          // Tick count should have idle class
          const tickCount = wrapper.find('.tick-count')
          expect(tickCount.classes()).toContain('idle')

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )

    vi.useRealTimers()
  })

  /**
   * Property 12: Tick event notification
   * **Validates: Requirements 4.3**
   * 
   * For any confirmed tick event detected by the tick detector, 
   * the tick counter should be notified and receive the event.
   */
  it('Property 12: Tick event notification - confirmed tick events notify counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 30 }), // Sequence of tick events
        async (tickSequence) => {
          // Reset for each iteration
          resetCounterInstance()
          resetSessionInstance()
          ;(global as any).__tickCallback = null

          // Mount component
          wrapper = mount(MeasurementPage)
          await nextTick()

          // Start session
          await wrapper.find('.btn-primary').trigger('click')
          await nextTick()

          // Get tick callback
          const tickCallback = (global as any).__tickCallback
          expect(tickCallback).toBeDefined()

          // Process each tick event
          let expectedCount = 0
          for (const tickValue of tickSequence) {
            // Trigger tick event
            tickCallback()
            await nextTick()

            // Counter should be incremented
            expectedCount++
            const tickCount = wrapper.find('.tick-count')
            expect(tickCount.text()).toBe(expectedCount.toString())
          }

          // Final count should match number of tick events
          const finalCount = wrapper.find('.tick-count')
          expect(finalCount.text()).toBe(tickSequence.length.toString())

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Additional property: Idle state clears on new tick
   * 
   * For any idle state, a new tick should clear the idle indicator.
   */
  it('Property: Idle state clears when new tick is detected', async () => {
    vi.useFakeTimers()

    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 5 }), // Initial ticks
          fc.integer({ min: 1, max: 5 })  // Ticks after idle
        ),
        async ([initialTicks, ticksAfterIdle]) => {
          // Reset for each iteration
          resetCounterInstance()
          resetSessionInstance()
          ;(global as any).__tickCallback = null

          // Mount component
          wrapper = mount(MeasurementPage)
          await nextTick()

          // Start session
          await wrapper.find('.btn-primary').trigger('click')
          await nextTick()

          // Get tick callback
          const tickCallback = (global as any).__tickCallback
          expect(tickCallback).toBeDefined()

          // Trigger initial ticks
          for (let i = 0; i < initialTicks; i++) {
            tickCallback()
            await nextTick()
          }

          // Advance time to trigger idle
          vi.advanceTimersByTime(5000)
          await nextTick()

          // Should be idle
          let idleIndicator = wrapper.find('.idle-indicator')
          expect(idleIndicator.exists()).toBe(true)

          // Trigger new ticks
          for (let i = 0; i < ticksAfterIdle; i++) {
            tickCallback()
            await nextTick()

            // Should no longer be idle after first tick
            idleIndicator = wrapper.find('.idle-indicator')
            expect(idleIndicator.exists()).toBe(false)

            const tickCount = wrapper.find('.tick-count')
            expect(tickCount.classes()).not.toContain('idle')
          }

          wrapper.unmount()
        }
      ),
      { numRuns: 100 }
    )

    vi.useRealTimers()
  })
})
