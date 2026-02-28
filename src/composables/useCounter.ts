import { ref, computed } from 'vue'

interface CounterState {
  count: number
  lastTickTimestamp: number | null
  isIdle: boolean
}

const IDLE_TIMEOUT_MS = 5000 // 5 seconds

// Singleton state
let instance: ReturnType<typeof createCounter> | null = null

function createCounter() {
  const count = ref(0)
  const lastTickTimestamp = ref<number | null>(null)
  const isIdle = ref(false)
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const increment = () => {
    count.value++
    lastTickTimestamp.value = Date.now()
    isIdle.value = false

    // Clear existing idle timer
    if (idleTimer) {
      clearTimeout(idleTimer)
    }

    // Set new idle timer
    idleTimer = setTimeout(() => {
      isIdle.value = true
    }, IDLE_TIMEOUT_MS)
  }

  const reset = () => {
    count.value = 0
    lastTickTimestamp.value = null
    isIdle.value = false

    // Clear idle timer
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const getCount = () => count.value

  const cleanup = () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  return {
    count: computed(() => count.value),
    lastTickTimestamp: computed(() => lastTickTimestamp.value),
    isIdle: computed(() => isIdle.value),
    increment,
    reset,
    getCount,
    cleanup
  }
}

export function useCounter() {
  if (!instance) {
    instance = createCounter()
  }
  return instance
}

// For testing: reset singleton
export function resetCounterInstance() {
  if (instance) {
    instance.cleanup()
  }
  instance = null
}
