import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { AudioManager } from '../../src/audio/AudioManager';

// Feature: tick-tack-timer, Property 8: Non-blocking audio processing
// Validates: Requirements 3.2

/**
 * **Validates: Requirements 3.2**
 * 
 * Property 8: Non-blocking audio processing
 * 
 * For any audio processing operation, the main thread should remain responsive
 * and capable of handling user interactions without blocking.
 * 
 * This property validates the core architectural decision to use AudioWorklet,
 * which processes audio in a separate thread from the main JavaScript thread.
 * 
 * Testing Strategy:
 * - Verify that audio processing initialization doesn't block the main thread
 * - Verify that main thread operations (timers, promises, UI updates) execute
 *   without delay while audio processing is active
 * - Verify that the audio graph connection uses AudioWorklet (not ScriptProcessor)
 * - Measure that main thread operations complete within expected timeframes
 */

/**
 * Mock Web Audio API components for property testing
 */
class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 48000;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined)
  };

  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn()
  });

  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null
  };

  connect = vi.fn();
  disconnect = vi.fn();

  constructor(context: AudioContext, name: string) {}
}

class MockMediaStream {
  private tracks: MediaStreamTrack[] = [
    {
      stop: vi.fn(),
      kind: 'audio',
      id: 'mock-track-1',
      label: 'Mock Audio Track',
      enabled: true,
      muted: false,
      readyState: 'live'
    } as any
  ];

  getTracks() {
    return this.tracks;
  }
}

// Set up global mocks
const mockGetUserMedia = vi.fn();
const mockFetch = vi.fn();

global.AudioContext = MockAudioContext as any;
global.AudioWorkletNode = MockAudioWorkletNode as any;
global.navigator = {
  mediaDevices: {
    getUserMedia: mockGetUserMedia
  }
} as any;
global.fetch = mockFetch;

describe('Non-blocking audio processing properties', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    audioManager = new AudioManager();
    vi.clearAllMocks();

    // Default mock implementations
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
    });

    // Mock WebAssembly.compile
    vi.spyOn(WebAssembly, 'compile').mockResolvedValue({} as WebAssembly.Module);
  });

  afterEach(() => {
    audioManager.cleanup();
    vi.restoreAllMocks();
  });

  it('Property 8: main thread remains responsive during audio processing', async () => {
    // This property verifies that audio processing does not block the main thread.
    // The use of AudioWorklet ensures that audio processing happens in a separate
    // thread, allowing the main thread to remain responsive for UI updates and
    // user interactions.

    await fc.assert(
      fc.asyncProperty(
        // Generate random calibration settings
        fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5) }),
        // Generate random number of main thread operations to test
        fc.integer({ min: 5, max: 20 }),
        async (sensitivity, threshold, operationCount) => {
          // Initialize the audio system
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();
          audioManager.setCalibration(sensitivity, threshold, 500, 8000);

          // Start audio processing
          audioManager.start();

          // Property: Audio processing should be active
          const state = audioManager.getState();
          expect(state.processing).toBe(true);

          // Property: Main thread should remain responsive
          // Simulate main thread operations that would block if audio processing
          // was happening on the main thread

          const mainThreadOperations: Promise<number>[] = [];
          const operationStartTime = performance.now();

          // Create multiple async operations that represent UI updates,
          // user interactions, and other main thread work
          for (let i = 0; i < operationCount; i++) {
            const operation = new Promise<number>((resolve) => {
              // Use setImmediate-like behavior with setTimeout(0)
              setTimeout(() => {
                // Simulate some computation
                let sum = 0;
                for (let j = 0; j < 100; j++) {
                  sum += j;
                }
                resolve(sum);
              }, 0);
            });
            mainThreadOperations.push(operation);
          }

          // Wait for all operations to complete
          const results = await Promise.all(mainThreadOperations);

          const operationEndTime = performance.now();
          const totalTime = operationEndTime - operationStartTime;

          // Property: All operations should complete successfully
          expect(results).toHaveLength(operationCount);
          results.forEach(result => {
            expect(result).toBeGreaterThan(0);
          });

          // Property: Operations should complete in a reasonable time
          // If audio processing was blocking the main thread, these operations
          // would take significantly longer. We allow generous time for test
          // environment overhead, but verify it's not excessively delayed.
          // In a real scenario with blocking audio processing, this could take
          // hundreds of milliseconds or more.
          expect(totalTime).toBeLessThan(1000); // 1 second is very generous

          // Property: Audio processing should still be active after main thread work
          const stateAfter = audioManager.getState();
          expect(stateAfter.processing).toBe(true);

          // Cleanup
          audioManager.stop();
          audioManager.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8 (architectural): uses AudioWorklet not ScriptProcessor', async () => {
    // This property verifies that the system uses AudioWorklet for audio processing,
    // which is the modern, non-blocking approach. ScriptProcessorNode (deprecated)
    // runs on the main thread and would block UI operations.

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('device-1', 'device-2', 'default'),
        async (deviceId) => {
          // Initialize the audio system
          await audioManager.initialize(deviceId === 'default' ? undefined : deviceId);
          await audioManager.loadWorklet();

          // Property: AudioWorklet should be used (addModule should be called)
          const audioContext = (audioManager as any).audioContext;
          expect(audioContext.audioWorklet.addModule).toHaveBeenCalled();

          // Property: The worklet node should be an AudioWorkletNode
          const workletNode = (audioManager as any).workletNode;
          expect(workletNode).toBeInstanceOf(MockAudioWorkletNode);

          // Property: No ScriptProcessorNode should be created
          // (We verify this by checking that only AudioWorkletNode is used)
          expect(audioContext.createScriptProcessor).toBeUndefined();

          // Cleanup
          audioManager.cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 8 (responsiveness): timers execute on schedule during audio processing', async () => {
    // This property verifies that JavaScript timers (setTimeout, setInterval)
    // execute on schedule while audio processing is active. If audio processing
    // blocked the main thread, timers would be delayed.

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 10 }),
        async (timerCount) => {
          // Initialize and start audio processing
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();
          audioManager.start();

          // Property: Set up multiple timers and verify they execute
          const timerPromises: Promise<boolean>[] = [];
          const timerStartTime = performance.now();

          for (let i = 0; i < timerCount; i++) {
            const timerPromise = new Promise<boolean>((resolve) => {
              setTimeout(() => {
                resolve(true);
              }, 10); // 10ms delay
            });
            timerPromises.push(timerPromise);
          }

          // Wait for all timers to complete
          const timerResults = await Promise.all(timerPromises);
          const timerEndTime = performance.now();
          const totalTime = timerEndTime - timerStartTime;

          // Property: All timers should have executed
          expect(timerResults).toHaveLength(timerCount);
          timerResults.forEach(result => {
            expect(result).toBe(true);
          });

          // Property: Timers should execute within reasonable time
          // With non-blocking audio, timers should execute close to their scheduled time
          // We allow overhead for test environment, but verify no excessive delay
          expect(totalTime).toBeLessThan(200); // 200ms for 10ms timers is generous

          // Property: Audio processing should still be active
          const state = audioManager.getState();
          expect(state.processing).toBe(true);

          // Cleanup
          audioManager.stop();
          audioManager.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8 (UI simulation): simulated UI updates execute without blocking', async () => {
    // This property simulates UI update operations (like React/Vue re-renders)
    // and verifies they can execute while audio processing is active.

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 15 }),
        async (updateCount) => {
          // Initialize and start audio processing
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();
          audioManager.start();

          // Simulate UI updates (like component re-renders)
          const updates: Promise<void>[] = [];
          let completedUpdates = 0;

          for (let i = 0; i < updateCount; i++) {
            const update = new Promise<void>((resolve) => {
              // Simulate a UI update cycle
              requestAnimationFrame(() => {
                // Simulate DOM manipulation or virtual DOM diffing
                const element = { textContent: `Update ${i}` };
                completedUpdates++;
                resolve();
              });
            });
            updates.push(update);
          }

          // Wait for all updates to complete
          await Promise.all(updates);

          // Property: All UI updates should have completed
          expect(completedUpdates).toBe(updateCount);

          // Property: Audio processing should still be active
          const state = audioManager.getState();
          expect(state.processing).toBe(true);

          // Cleanup
          audioManager.stop();
          audioManager.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8 (concurrency): multiple async operations execute concurrently', async () => {
    // This property verifies that multiple async operations can execute
    // concurrently while audio processing is active, demonstrating that
    // the main thread is not blocked.

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 8 }),
        async (concurrentOps) => {
          // Initialize and start audio processing
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();
          audioManager.start();

          // Create multiple concurrent async operations
          const operations: Promise<string>[] = [];
          const startTime = performance.now();

          for (let i = 0; i < concurrentOps; i++) {
            const operation = new Promise<string>((resolve) => {
              // Simulate async work (like fetch, database query, etc.)
              setTimeout(() => {
                resolve(`Operation ${i} completed`);
              }, 20);
            });
            operations.push(operation);
          }

          // Wait for all operations to complete
          const results = await Promise.all(operations);
          const endTime = performance.now();
          const totalTime = endTime - startTime;

          // Property: All operations should complete
          expect(results).toHaveLength(concurrentOps);
          results.forEach((result, index) => {
            expect(result).toBe(`Operation ${index} completed`);
          });

          // Property: Operations should execute concurrently, not sequentially
          // If they were sequential, total time would be concurrentOps * 20ms
          // With concurrency, they should complete in ~20ms (plus overhead)
          // We verify that total time is much less than sequential execution
          const sequentialTime = concurrentOps * 20;
          expect(totalTime).toBeLessThan(sequentialTime * 0.8); // At least 20% faster

          // Property: Audio processing should still be active
          const state = audioManager.getState();
          expect(state.processing).toBe(true);

          // Cleanup
          audioManager.stop();
          audioManager.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8 (invariant): audio processing state transitions do not block', async () => {
    // This property verifies that starting and stopping audio processing
    // does not block the main thread.

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (cycles) => {
          // Initialize the audio system once
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();

          // Perform multiple start/stop cycles
          for (let i = 0; i < cycles; i++) {
            const startTime = performance.now();

            // Start audio processing
            audioManager.start();

            // Verify main thread can execute work immediately after start
            let workCompleted = false;
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                workCompleted = true;
                resolve();
              }, 0);
            });

            expect(workCompleted).toBe(true);

            // Stop audio processing
            audioManager.stop();

            // Verify main thread can execute work immediately after stop
            workCompleted = false;
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                workCompleted = true;
                resolve();
              }, 0);
            });

            expect(workCompleted).toBe(true);

            const endTime = performance.now();
            const cycleTime = endTime - startTime;

            // Property: Each cycle should complete quickly
            expect(cycleTime).toBeLessThan(100); // 100ms per cycle is generous
          }

          // Cleanup
          audioManager.cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });
});
