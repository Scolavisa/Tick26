import { ref, type Ref } from 'vue'

/**
 * useSession composable
 * 
 * Manages measurement session lifecycle and timing.
 * Tracks session start/stop state, calculates elapsed duration,
 * and manages session timer.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

interface UseSession {
  isActive: Ref<boolean>
  duration: Ref<number>
  startTime: Ref<number | null>
  start: () => void
  stop: () => void
  reset: () => void
  getDuration: () => number
  cleanup: () => void
}

let sessionInstance: UseSession | null = null

export function useSession(): UseSession {
  if (sessionInstance) {
    return sessionInstance
  }

  const isActive = ref(false)
  const duration = ref(0)
  const startTime = ref<number | null>(null)
  let timerInterval: number | null = null

  const start = () => {
    if (isActive.value) {
      return // Already active
    }

    isActive.value = true
    startTime.value = Date.now()
    duration.value = 0

    // Update duration every 100ms for smooth display
    timerInterval = window.setInterval(() => {
      if (startTime.value !== null) {
        duration.value = Math.floor((Date.now() - startTime.value) / 1000)
      }
    }, 100)
  }

  const stop = () => {
    if (!isActive.value) {
      return // Not active
    }

    isActive.value = false

    // Calculate final duration
    if (startTime.value !== null) {
      duration.value = Math.floor((Date.now() - startTime.value) / 1000)
    }

    // Clear timer
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  const reset = () => {
    // Stop if active
    if (isActive.value) {
      stop()
    }

    // Reset all state
    isActive.value = false
    duration.value = 0
    startTime.value = null

    // Clear timer if it exists
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  const getDuration = (): number => {
    return duration.value
  }

  const cleanup = () => {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  sessionInstance = {
    isActive,
    duration,
    startTime,
    start,
    stop,
    reset,
    getDuration,
    cleanup
  }

  return sessionInstance
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSessionInstance(): void {
  if (sessionInstance) {
    sessionInstance.cleanup()
  }
  sessionInstance = null
}
