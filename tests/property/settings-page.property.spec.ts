/**
 * Property-based tests for SettingsPage component
 * Feature: tick-tack-timer, Property 19: Microphone permission activation
 * Validates: Requirements 8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { useAudio } from '../../src/composables/useAudio';

/**
 * Mock Web Audio API and MediaDevices for property testing
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

  createGain = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1.0 }
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

  constructor(_context: AudioContext, _name: string) {}
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
const mockEnumerateDevices = vi.fn();
const mockFetch = vi.fn();

global.AudioContext = MockAudioContext as any;
global.AudioWorkletNode = MockAudioWorkletNode as any;
global.navigator = {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices
  }
} as any;
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('SettingsPage properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

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
    vi.restoreAllMocks();
  });

  it('Property 19: granted permission activates audio input', async () => {
    // **Validates: Requirement 8.3**
    // This property verifies that for any granted microphone permission,
    // the system should activate the selected audio input source and begin
    // receiving audio data.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary device IDs to test with
        fc.string({ minLength: 1, maxLength: 50 }),
        async (deviceId) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();
          
          const { 
            requestPermission, 
            selectDevice, 
            permissionGranted,
            isInitialized,
            cleanup 
          } = useAudio();

          // Step 1: Request permission
          const granted = await requestPermission();

          // Property: Permission should be granted
          expect(granted).toBe(true);
          expect(permissionGranted.value).toBe(true);

          // Property: getUserMedia should have been called to request permission
          expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });

          // Step 2: Select a device (which activates the audio input)
          await selectDevice(deviceId);

          // Property: The audio system should be initialized after device selection
          expect(isInitialized.value).toBe(true);

          // Property: getUserMedia should have been called again with the specific device
          // to activate the audio input source (enhanced constraints are tried first)
          expect(mockGetUserMedia).toHaveBeenCalledWith(
            expect.objectContaining({
              audio: expect.objectContaining({ deviceId: { exact: deviceId } }),
              video: false
            })
          );

          // Property: The system should have created an audio context
          // (verified by the fact that isInitialized is true, which requires
          // successful AudioContext creation in AudioManager)

          // Cleanup for next iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19 (edge case): denied permission does not activate audio input', async () => {
    // **Validates: Requirement 8.3**
    // This property verifies that when microphone permission is denied,
    // the audio input source should NOT be activated.

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (deviceId) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();
          
          // Mock permission denial
          mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
          
          const { 
            requestPermission, 
            selectDevice, 
            permissionGranted,
            isInitialized,
            cleanup 
          } = useAudio();

          // Step 1: Request permission (will be denied)
          const granted = await requestPermission();

          // Property: Permission should be denied
          expect(granted).toBe(false);
          expect(permissionGranted.value).toBe(false);

          // Step 2: Attempt to select a device
          try {
            await selectDevice(deviceId);
            // If we get here, the device selection succeeded despite denied permission
            // This is actually okay - the error will occur when trying to get user media
          } catch (error) {
            // Expected: device selection should fail when permission is denied
            expect(error).toBeDefined();
          }

          // Property: The audio system should NOT be initialized
          // (because permission was denied)
          expect(isInitialized.value).toBe(false);

          // Cleanup for next iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19 (integration): permission flow enables device enumeration', async () => {
    // **Validates: Requirement 8.3**
    // This property verifies that granting permission enables the full
    // audio input workflow including device enumeration.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary lists of audio devices
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1, maxLength: 50 }),
            label: fc.string({ minLength: 1, maxLength: 100 }),
            kind: fc.constant('audioinput' as MediaDeviceKind),
            groupId: fc.string()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (devices) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();
          
          // Mock device enumeration
          mockEnumerateDevices.mockResolvedValue(devices);
          
          const { 
            requestPermission, 
            enumerateDevices,
            availableDevices,
            permissionGranted,
            cleanup 
          } = useAudio();

          // Step 1: Request permission
          const granted = await requestPermission();

          // Property: Permission should be granted
          expect(granted).toBe(true);
          expect(permissionGranted.value).toBe(true);

          // Step 2: Enumerate devices (should work after permission is granted)
          const result = await enumerateDevices();

          // Property: All devices should be enumerated
          expect(result).toHaveLength(devices.length);
          expect(availableDevices.value).toHaveLength(devices.length);

          // Property: Device enumeration should have been called
          expect(mockEnumerateDevices).toHaveBeenCalled();

          // Property: Each device should be present in the result
          for (const device of devices) {
            const found = result.find(d => d.deviceId === device.deviceId);
            expect(found).toBeDefined();
          }

          // Cleanup for next iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
