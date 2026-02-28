import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('useSession', () => {
  let useSession: any
  let resetSessionInstance: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const module = await import('../../../src/composables/useSession')
    useSession = module.useSession
    resetSessionInstance = module.resetSessionInstance
  })

  afterEach(() => {
    resetSessionInstance()
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with isActive false', () => {
      const session = useSession()
      expect(session.isActive.value).toBe(false)
    })

    it('should initialize with duration 0', () => {
      const session = useSession()
      expect(session.duration.value).toBe(0)
    })

    it('should initialize with null startTime', () => {
      const session = useSession()
      expect(session.startTime.value).toBeNull()
    })

    it('should return same instance on multiple calls (singleton)', () => {
      const session1 = useSession()
      const session2 = useSession()
      expect(session1).toBe(session2)
    })
  })

  describe('start', () => {
    it('should set isActive to true', () => {
      const session = useSession()
      session.start()
      expect(session.isActive.value).toBe(true)
    })

    it('should set startTime to current timestamp', () => {
      const session = useSession()
      const beforeTime = Date.now()
      session.start()
      const afterTime = Date.now()
      
      expect(session.startTime.value).toBeGreaterThanOrEqual(beforeTime)
      expect(session.startTime.value).toBeLessThanOrEqual(afterTime)
    })

    it('should reset duration to 0', () => {
      const session = useSession()
      session.start()
      vi.advanceTimersByTime(5000)
      session.stop()
      
      expect(session.duration.value).toBeGreaterThan(0)
      
      session.start()
      expect(session.duration.value).toBe(0)
    })

    it('should not restart if already active', () => {
      const session = useSession()
      session.start()
      const firstStartTime = session.startTime.value
      
      vi.advanceTimersByTime(1000)
      session.start() // Try to start again
      
      expect(session.startTime.value).toBe(firstStartTime)
    })

    it('should start timer that updates duration', () => {
      const session = useSession()
      session.start()
      
      expect(session.duration.value).toBe(0)
      
      vi.advanceTimersByTime(1000)
      expect(session.duration.value).toBe(1)
      
      vi.advanceTimersByTime(2000)
      expect(session.duration.value).toBe(3)
    })
  })

  describe('stop', () => {
    it('should set isActive to false', () => {
      const session = useSession()
      session.start()
      session.stop()
      expect(session.isActive.value).toBe(false)
    })

    it('should preserve final duration', () => {
      const session = useSession()
      session.start()
      
      vi.advanceTimersByTime(5000)
      session.stop()
      
      const finalDuration = session.duration.value
      expect(finalDuration).toBe(5)
      
      // Duration should not change after stop
      vi.advanceTimersByTime(3000)
      expect(session.duration.value).toBe(finalDuration)
    })

    it('should stop timer updates', () => {
      const session = useSession()
      session.start()
      
      vi.advanceTimersByTime(2000)
      session.stop()
      
      const stoppedDuration = session.duration.value
      
      vi.advanceTimersByTime(5000)
      expect(session.duration.value).toBe(stoppedDuration)
    })

    it('should do nothing if not active', () => {
      const session = useSession()
      expect(() => session.stop()).not.toThrow()
      expect(session.isActive.value).toBe(false)
    })

    it('should preserve startTime', () => {
      const session = useSession()
      session.start()
      const startTimeValue = session.startTime.value
      
      session.stop()
      expect(session.startTime.value).toBe(startTimeValue)
    })
  })

  describe('reset', () => {
    it('should reset isActive to false', () => {
      const session = useSession()
      session.start()
      session.reset()
      expect(session.isActive.value).toBe(false)
    })

    it('should reset duration to 0', () => {
      const session = useSession()
      session.start()
      vi.advanceTimersByTime(5000)
      session.reset()
      expect(session.duration.value).toBe(0)
    })

    it('should reset startTime to null', () => {
      const session = useSession()
      session.start()
      session.reset()
      expect(session.startTime.value).toBeNull()
    })

    it('should stop timer if active', () => {
      const session = useSession()
      session.start()
      
      vi.advanceTimersByTime(2000)
      session.reset()
      
      expect(session.duration.value).toBe(0)
      
      vi.advanceTimersByTime(3000)
      expect(session.duration.value).toBe(0)
    })

    it('should work when session is not active', () => {
      const session = useSession()
      expect(() => session.reset()).not.toThrow()
      expect(session.isActive.value).toBe(false)
      expect(session.duration.value).toBe(0)
      expect(session.startTime.value).toBeNull()
    })
  })

  describe('getDuration', () => {
    it('should return current duration', () => {
      const session = useSession()
      expect(session.getDuration()).toBe(0)
      
      session.start()
      vi.advanceTimersByTime(3000)
      expect(session.getDuration()).toBe(3)
      
      vi.advanceTimersByTime(2000)
      expect(session.getDuration()).toBe(5)
    })

    it('should return final duration after stop', () => {
      const session = useSession()
      session.start()
      vi.advanceTimersByTime(7000)
      session.stop()
      
      expect(session.getDuration()).toBe(7)
      
      vi.advanceTimersByTime(5000)
      expect(session.getDuration()).toBe(7)
    })
  })

  describe('session timer', () => {
    it('should update duration every 100ms', () => {
      const session = useSession()
      session.start()
      
      vi.advanceTimersByTime(100)
      const duration1 = session.duration.value
      
      vi.advanceTimersByTime(100)
      const duration2 = session.duration.value
      
      // Duration should be updated (though it's in seconds, so might be same)
      expect(duration2).toBeGreaterThanOrEqual(duration1)
    })

    it('should calculate duration in seconds', () => {
      const session = useSession()
      session.start()
      
      vi.advanceTimersByTime(500)
      expect(session.duration.value).toBe(0) // Less than 1 second
      
      vi.advanceTimersByTime(500)
      expect(session.duration.value).toBe(1) // 1 second
      
      vi.advanceTimersByTime(1000)
      expect(session.duration.value).toBe(2) // 2 seconds
    })

    it('should handle long sessions', () => {
      const session = useSession()
      session.start()
      
      vi.advanceTimersByTime(60000) // 1 minute
      expect(session.duration.value).toBe(60)
      
      vi.advanceTimersByTime(60000) // Another minute
      expect(session.duration.value).toBe(120)
    })
  })

  describe('cleanup', () => {
    it('should clear timer', () => {
      const session = useSession()
      session.start()
      session.cleanup()
      
      vi.advanceTimersByTime(5000)
      // Duration should not update after cleanup
      expect(session.duration.value).toBe(0)
    })

    it('should not throw if called multiple times', () => {
      const session = useSession()
      expect(() => {
        session.cleanup()
        session.cleanup()
      }).not.toThrow()
    })

    it('should not throw if called before start', () => {
      const session = useSession()
      expect(() => session.cleanup()).not.toThrow()
    })
  })

  describe('singleton behavior', () => {
    it('should maintain state across multiple useSession calls', () => {
      const session1 = useSession()
      session1.start()
      vi.advanceTimersByTime(3000)
      
      const session2 = useSession()
      expect(session2.isActive.value).toBe(true)
      expect(session2.duration.value).toBe(3)
    })

    it('should reset singleton instance with resetSessionInstance', async () => {
      const session1 = useSession()
      session1.start()
      vi.advanceTimersByTime(5000)
      
      resetSessionInstance()
      vi.resetModules()
      const module = await import('../../../src/composables/useSession')
      const session2 = module.useSession()
      
      expect(session2.isActive.value).toBe(false)
      expect(session2.duration.value).toBe(0)
      expect(session2.startTime.value).toBeNull()
    })
  })

  describe('start-stop-start lifecycle', () => {
    it('should allow starting again after stop', () => {
      const session = useSession()
      
      // First session
      session.start()
      vi.advanceTimersByTime(3000)
      session.stop()
      expect(session.duration.value).toBe(3)
      
      // Second session
      session.start()
      expect(session.duration.value).toBe(0)
      vi.advanceTimersByTime(2000)
      expect(session.duration.value).toBe(2)
    })

    it('should handle multiple start-stop cycles', () => {
      const session = useSession()
      
      for (let i = 0; i < 3; i++) {
        session.start()
        vi.advanceTimersByTime(1000)
        session.stop()
        expect(session.duration.value).toBe(1)
      }
    })
  })
})
