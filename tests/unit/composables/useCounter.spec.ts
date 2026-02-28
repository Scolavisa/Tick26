import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('useCounter', () => {
  let useCounter: any
  let resetCounterInstance: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const module = await import('../../../src/composables/useCounter')
    useCounter = module.useCounter
    resetCounterInstance = module.resetCounterInstance
  })

  afterEach(() => {
    resetCounterInstance()
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with count of 0', () => {
      const counter = useCounter()
      expect(counter.count.value).toBe(0)
    })

    it('should initialize with null lastTickTimestamp', () => {
      const counter = useCounter()
      expect(counter.lastTickTimestamp.value).toBeNull()
    })

    it('should initialize with isIdle false', () => {
      const counter = useCounter()
      expect(counter.isIdle.value).toBe(false)
    })

    it('should return same instance on multiple calls (singleton)', () => {
      const counter1 = useCounter()
      const counter2 = useCounter()
      expect(counter1).toBe(counter2)
    })
  })

  describe('increment', () => {
    it('should increment count by 1', () => {
      const counter = useCounter()
      counter.increment()
      expect(counter.count.value).toBe(1)
    })

    it('should increment count multiple times', () => {
      const counter = useCounter()
      counter.increment()
      counter.increment()
      counter.increment()
      expect(counter.count.value).toBe(3)
    })

    it('should update lastTickTimestamp', () => {
      const counter = useCounter()
      const beforeTime = Date.now()
      counter.increment()
      const afterTime = Date.now()
      
      expect(counter.lastTickTimestamp.value).toBeGreaterThanOrEqual(beforeTime)
      expect(counter.lastTickTimestamp.value).toBeLessThanOrEqual(afterTime)
    })

    it('should set isIdle to false', () => {
      const counter = useCounter()
      counter.increment()
      expect(counter.isIdle.value).toBe(false)
    })

    it('should reset idle timer on each increment', () => {
      const counter = useCounter()
      
      counter.increment()
      vi.advanceTimersByTime(3000) // 3 seconds
      expect(counter.isIdle.value).toBe(false)
      
      counter.increment() // Reset timer
      vi.advanceTimersByTime(3000) // Another 3 seconds (6 total, but timer was reset)
      expect(counter.isIdle.value).toBe(false)
      
      vi.advanceTimersByTime(2000) // 2 more seconds (5 from last increment)
      expect(counter.isIdle.value).toBe(true)
    })
  })

  describe('reset', () => {
    it('should reset count to 0', () => {
      const counter = useCounter()
      counter.increment()
      counter.increment()
      counter.reset()
      expect(counter.count.value).toBe(0)
    })

    it('should reset lastTickTimestamp to null', () => {
      const counter = useCounter()
      counter.increment()
      counter.reset()
      expect(counter.lastTickTimestamp.value).toBeNull()
    })

    it('should reset isIdle to false', () => {
      const counter = useCounter()
      counter.increment()
      vi.advanceTimersByTime(5000)
      expect(counter.isIdle.value).toBe(true)
      
      counter.reset()
      expect(counter.isIdle.value).toBe(false)
    })

    it('should clear idle timer', () => {
      const counter = useCounter()
      counter.increment()
      counter.reset()
      
      vi.advanceTimersByTime(5000)
      expect(counter.isIdle.value).toBe(false) // Should not become idle after reset
    })
  })

  describe('getCount', () => {
    it('should return current count', () => {
      const counter = useCounter()
      expect(counter.getCount()).toBe(0)
      
      counter.increment()
      expect(counter.getCount()).toBe(1)
      
      counter.increment()
      expect(counter.getCount()).toBe(2)
    })
  })

  describe('idle detection', () => {
    it('should set isIdle to true after 5 seconds without ticks', () => {
      const counter = useCounter()
      counter.increment()
      
      expect(counter.isIdle.value).toBe(false)
      
      vi.advanceTimersByTime(4999)
      expect(counter.isIdle.value).toBe(false)
      
      vi.advanceTimersByTime(1)
      expect(counter.isIdle.value).toBe(true)
    })

    it('should remain idle after timeout', () => {
      const counter = useCounter()
      counter.increment()
      
      vi.advanceTimersByTime(5000)
      expect(counter.isIdle.value).toBe(true)
      
      vi.advanceTimersByTime(5000)
      expect(counter.isIdle.value).toBe(true)
    })

    it('should reset idle state on new tick', () => {
      const counter = useCounter()
      counter.increment()
      
      vi.advanceTimersByTime(5000)
      expect(counter.isIdle.value).toBe(true)
      
      counter.increment()
      expect(counter.isIdle.value).toBe(false)
    })

    it('should not set idle if no ticks have occurred', () => {
      const counter = useCounter()
      
      vi.advanceTimersByTime(10000)
      expect(counter.isIdle.value).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should clear idle timer', () => {
      const counter = useCounter()
      counter.increment()
      counter.cleanup()
      
      vi.advanceTimersByTime(5000)
      expect(counter.isIdle.value).toBe(false)
    })

    it('should not throw if called multiple times', () => {
      const counter = useCounter()
      expect(() => {
        counter.cleanup()
        counter.cleanup()
      }).not.toThrow()
    })
  })

  describe('singleton behavior', () => {
    it('should maintain state across multiple useCounter calls', () => {
      const counter1 = useCounter()
      counter1.increment()
      counter1.increment()
      
      const counter2 = useCounter()
      expect(counter2.count.value).toBe(2)
    })

    it('should reset singleton instance with resetCounterInstance', async () => {
      const counter1 = useCounter()
      counter1.increment()
      counter1.increment()
      
      resetCounterInstance()
      vi.resetModules()
      const module = await import('../../../src/composables/useCounter')
      const counter2 = module.useCounter()
      
      expect(counter2.count.value).toBe(0)
    })
  })
})
