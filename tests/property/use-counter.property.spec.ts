import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'

describe('useCounter - Property Tests', () => {
  let useCounter: any
  let resetCounterInstance: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const module = await import('../../src/composables/useCounter')
    useCounter = module.useCounter
    resetCounterInstance = module.resetCounterInstance
  })

  afterEach(() => {
    resetCounterInstance()
    vi.useRealTimers()
  })

  describe('Property 14: Tick count accuracy', () => {
    it('should count exactly N ticks for N increment calls', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          (tickCount) => {
            resetCounterInstance()
            const counter = useCounter()
            
            for (let i = 0; i < tickCount; i++) {
              counter.increment()
            }
            
            expect(counter.count.value).toBe(tickCount)
            expect(counter.getCount()).toBe(tickCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain accurate count through multiple increment sequences', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }),
          (sequences) => {
            resetCounterInstance()
            const counter = useCounter()
            let expectedTotal = 0
            
            for (const tickCount of sequences) {
              for (let i = 0; i < tickCount; i++) {
                counter.increment()
              }
              expectedTotal += tickCount
            }
            
            expect(counter.count.value).toBe(expectedTotal)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Property 16: Session initialization resets counter', () => {
    it('should reset counter to zero on reset call', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (tickCount) => {
            resetCounterInstance()
            const counter = useCounter()
            
            // Increment counter
            for (let i = 0; i < tickCount; i++) {
              counter.increment()
            }
            
            expect(counter.count.value).toBe(tickCount)
            
            // Reset should bring count back to zero
            counter.reset()
            
            expect(counter.count.value).toBe(0)
            expect(counter.getCount()).toBe(0)
            expect(counter.lastTickTimestamp.value).toBeNull()
            expect(counter.isIdle.value).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow counting again after reset', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (firstCount, secondCount) => {
            resetCounterInstance()
            const counter = useCounter()
            
            // First counting session
            for (let i = 0; i < firstCount; i++) {
              counter.increment()
            }
            expect(counter.count.value).toBe(firstCount)
            
            // Reset
            counter.reset()
            expect(counter.count.value).toBe(0)
            
            // Second counting session
            for (let i = 0; i < secondCount; i++) {
              counter.increment()
            }
            expect(counter.count.value).toBe(secondCount)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Property: Idle detection timing', () => {
    it('should set idle state after exactly 5 seconds without ticks', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (tickCount) => {
            resetCounterInstance()
            const counter = useCounter()
            
            // Generate some ticks
            for (let i = 0; i < tickCount; i++) {
              counter.increment()
            }
            
            // Should not be idle immediately
            expect(counter.isIdle.value).toBe(false)
            
            // Should not be idle before 5 seconds
            vi.advanceTimersByTime(4999)
            expect(counter.isIdle.value).toBe(false)
            
            // Should be idle after 5 seconds
            vi.advanceTimersByTime(1)
            expect(counter.isIdle.value).toBe(true)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should reset idle timer on any tick', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1000, max: 4000 }), { minLength: 2, maxLength: 5 }),
          (delays) => {
            resetCounterInstance()
            const counter = useCounter()
            
            counter.increment()
            
            for (const delay of delays) {
              vi.advanceTimersByTime(delay)
              expect(counter.isIdle.value).toBe(false)
              counter.increment() // Reset timer
            }
            
            // Now wait full 5 seconds
            vi.advanceTimersByTime(5000)
            expect(counter.isIdle.value).toBe(true)
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('Property: State consistency', () => {
    it('should maintain consistent state after any sequence of operations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant({ type: 'increment' as const }),
              fc.constant({ type: 'reset' as const }),
              fc.record({ type: fc.constant('wait' as const), ms: fc.integer({ min: 0, max: 6000 }) })
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (operations) => {
            resetCounterInstance()
            const counter = useCounter()
            let expectedCount = 0
            let lastTickTime: number | null = null
            
            for (const op of operations) {
              if (op.type === 'increment') {
                counter.increment()
                expectedCount++
                lastTickTime = Date.now()
              } else if (op.type === 'reset') {
                counter.reset()
                expectedCount = 0
                lastTickTime = null
              } else if (op.type === 'wait') {
                vi.advanceTimersByTime(op.ms)
              }
            }
            
            // Verify count is consistent
            expect(counter.count.value).toBe(expectedCount)
            expect(counter.getCount()).toBe(expectedCount)
            
            // Verify lastTickTimestamp consistency
            if (lastTickTime === null) {
              expect(counter.lastTickTimestamp.value).toBeNull()
            } else {
              expect(counter.lastTickTimestamp.value).not.toBeNull()
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
