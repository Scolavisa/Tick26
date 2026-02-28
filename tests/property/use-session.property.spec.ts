import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'

describe('useSession - Property Tests', () => {
  let useSession: any
  let resetSessionInstance: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const module = await import('../../src/composables/useSession')
    useSession = module.useSession
    resetSessionInstance = module.resetSessionInstance
  })

  afterEach(() => {
    resetSessionInstance()
    vi.useRealTimers()
  })

  describe('Property 32: Session stop preserves count', () => {
    /**
     * **Validates: Requirements 13.3**
     * 
     * For any measurement session that is stopped, the final tick count
     * should remain accessible for review after the session ends.
     * 
     * This property test verifies that:
     * 1. Duration is preserved after stop
     * 2. Duration does not change after stop
     * 3. Duration remains accessible via getDuration()
     */
    it('should preserve final duration after stop', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 300 }), // Session duration in seconds (1-300s)
          (sessionDuration) => {
            resetSessionInstance()
            const session = useSession()
            
            // Start session
            session.start()
            expect(session.isActive.value).toBe(true)
            
            // Advance time to simulate session duration
            vi.advanceTimersByTime(sessionDuration * 1000)
            
            // Stop session
            session.stop()
            expect(session.isActive.value).toBe(false)
            
            // Capture final duration
            const finalDuration = session.duration.value
            const finalDurationFromGetter = session.getDuration()
            
            // Verify duration matches expected
            expect(finalDuration).toBe(sessionDuration)
            expect(finalDurationFromGetter).toBe(sessionDuration)
            
            // Advance time further - duration should not change
            vi.advanceTimersByTime(10000)
            
            // Verify duration is preserved
            expect(session.duration.value).toBe(finalDuration)
            expect(session.getDuration()).toBe(finalDuration)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve duration through multiple stop-start cycles', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 5 }),
          (sessionDurations) => {
            resetSessionInstance()
            const session = useSession()
            
            for (const duration of sessionDurations) {
              // Start session
              session.start()
              expect(session.isActive.value).toBe(true)
              
              // Run session
              vi.advanceTimersByTime(duration * 1000)
              
              // Stop session
              session.stop()
              expect(session.isActive.value).toBe(false)
              
              // Verify duration is preserved
              const stoppedDuration = session.duration.value
              expect(stoppedDuration).toBe(duration)
              
              // Wait some time
              vi.advanceTimersByTime(1000)
              
              // Duration should still be preserved
              expect(session.duration.value).toBe(stoppedDuration)
              expect(session.getDuration()).toBe(stoppedDuration)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should preserve startTime after stop', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (sessionDuration) => {
            resetSessionInstance()
            const session = useSession()
            
            session.start()
            const startTimeValue = session.startTime.value
            expect(startTimeValue).not.toBeNull()
            
            vi.advanceTimersByTime(sessionDuration * 1000)
            session.stop()
            
            // startTime should be preserved
            expect(session.startTime.value).toBe(startTimeValue)
            
            // Even after more time passes
            vi.advanceTimersByTime(5000)
            expect(session.startTime.value).toBe(startTimeValue)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Property: Session lifecycle consistency', () => {
    it('should maintain consistent state through any sequence of operations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant({ type: 'start' as const }),
              fc.constant({ type: 'stop' as const }),
              fc.constant({ type: 'reset' as const }),
              fc.record({ type: fc.constant('wait' as const), ms: fc.integer({ min: 100, max: 5000 }) })
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (operations) => {
            resetSessionInstance()
            const session = useSession()
            let isActive = false
            let lastStartTime: number | null = null
            
            for (const op of operations) {
              if (op.type === 'start') {
                if (!isActive) {
                  session.start()
                  isActive = true
                  lastStartTime = Date.now()
                  expect(session.isActive.value).toBe(true)
                  expect(session.duration.value).toBe(0)
                }
              } else if (op.type === 'stop') {
                if (isActive) {
                  const durationBeforeStop = session.duration.value
                  session.stop()
                  isActive = false
                  expect(session.isActive.value).toBe(false)
                  // Duration should be preserved or equal
                  expect(session.duration.value).toBeGreaterThanOrEqual(durationBeforeStop)
                }
              } else if (op.type === 'reset') {
                session.reset()
                isActive = false
                lastStartTime = null
                expect(session.isActive.value).toBe(false)
                expect(session.duration.value).toBe(0)
                expect(session.startTime.value).toBeNull()
              } else if (op.type === 'wait') {
                vi.advanceTimersByTime(op.ms)
              }
            }
            
            // Final state should be consistent
            expect(session.isActive.value).toBe(isActive)
            if (!isActive && lastStartTime === null) {
              expect(session.startTime.value).toBeNull()
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Property: Duration calculation accuracy', () => {
    it('should calculate duration accurately for any session length', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 600 }), // 0-600 seconds
          (seconds) => {
            resetSessionInstance()
            const session = useSession()
            
            session.start()
            vi.advanceTimersByTime(seconds * 1000)
            
            // Duration should match elapsed time (within 1 second tolerance due to rounding)
            const calculatedDuration = session.duration.value
            expect(Math.abs(calculatedDuration - seconds)).toBeLessThanOrEqual(1)
            
            session.stop()
            
            // After stop, duration should still be accurate
            expect(Math.abs(session.duration.value - seconds)).toBeLessThanOrEqual(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle sub-second durations correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }), // Milliseconds
          (milliseconds) => {
            resetSessionInstance()
            const session = useSession()
            
            session.start()
            vi.advanceTimersByTime(milliseconds)
            
            // Duration should be 0 for sub-second durations
            const expectedSeconds = Math.floor(milliseconds / 1000)
            expect(session.duration.value).toBe(expectedSeconds)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Property: Timer behavior', () => {
    it('should stop timer updates after stop', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1, max: 30 }),
          (runDuration, waitDuration) => {
            resetSessionInstance()
            const session = useSession()
            
            session.start()
            vi.advanceTimersByTime(runDuration * 1000)
            session.stop()
            
            const stoppedDuration = session.duration.value
            
            // Wait additional time
            vi.advanceTimersByTime(waitDuration * 1000)
            
            // Duration should not have changed
            expect(session.duration.value).toBe(stoppedDuration)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should restart timer correctly after stop', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 20 }),
          (firstDuration, secondDuration) => {
            resetSessionInstance()
            const session = useSession()
            
            // First session
            session.start()
            vi.advanceTimersByTime(firstDuration * 1000)
            session.stop()
            expect(session.duration.value).toBe(firstDuration)
            
            // Second session
            session.start()
            expect(session.duration.value).toBe(0) // Should reset
            vi.advanceTimersByTime(secondDuration * 1000)
            expect(session.duration.value).toBe(secondDuration)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
