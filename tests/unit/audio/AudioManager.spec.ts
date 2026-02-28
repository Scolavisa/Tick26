import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { AudioManager } from '../../../src/audio/AudioManager';

// Feature: tick-tack-timer, Unit tests for AudioManager
// Validates: Requirements 3.1, 3.3

/**
 * Mock Web Audio API components
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

// Mock global APIs - must be done before importing AudioManager
const mockGetUserMedia = vi.fn();
const mockFetch = vi.fn();

// Set up global mocks
beforeAll(() => {
  global.AudioContext = MockAudioContext as any;
  global.AudioWorkletNode = MockAudioWorkletNode as any;
  global.navigator = {
    mediaDevices: {
      getUserMedia: mockGetUserMedia
    }
  } as any;
  global.fetch = mockFetch;
});

describe('AudioManager', () => {
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
  });

  afterEach(() => {
    audioManager.cleanup();
  });

  describe('Initialization', () => {
    it('creates AudioContext on initialize', async () => {
      await audioManager.initialize();

      const state = audioManager.getState();
      expect(state.initialized).toBe(true);
      expect(state.contextState).toBe('running');
    });

    it('requests microphone access without device ID', async () => {
      await audioManager.initialize();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false
      });
    });

    it('requests specific microphone device when deviceId provided', async () => {
      const deviceId = 'test-device-123';

      await audioManager.initialize(deviceId);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: { deviceId: { exact: deviceId } },
        video: false
      });
    });

    it('resumes AudioContext if suspended', async () => {
      // Create a new mock context with suspended state
      const suspendedContext = new MockAudioContext();
      suspendedContext.state = 'suspended';
      
      // Temporarily replace the global AudioContext
      const originalAudioContext = global.AudioContext;
      global.AudioContext = class extends MockAudioContext {
        constructor() {
          super();
          this.state = 'suspended';
        }
      } as any;

      await audioManager.initialize();

      const context = (audioManager as any).audioContext;
      expect(context.resume).toHaveBeenCalled();
      
      // Restore original
      global.AudioContext = originalAudioContext;
    });

    it('throws error when microphone permission is denied', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(permissionError);

      await expect(audioManager.initialize()).rejects.toThrow(
        'Microphone permission denied'
      );
    });

    it('throws error when microphone device is not found', async () => {
      const notFoundError = new Error('Device not found');
      (notFoundError as any).name = 'NotFoundError';
      mockGetUserMedia.mockRejectedValue(notFoundError);

      await expect(audioManager.initialize()).rejects.toThrow(
        'Microphone device not found'
      );
    });

    it('cleans up resources on initialization error', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Test error'));

      await expect(audioManager.initialize()).rejects.toThrow();

      const state = audioManager.getState();
      expect(state.initialized).toBe(false);
    });
  });

  describe('AudioWorklet loading', () => {
    beforeEach(async () => {
      await audioManager.initialize();
    });

    it('loads AudioWorklet module', async () => {
      await audioManager.loadWorklet();

      const mockContext = (audioManager as any).audioContext;
      expect(mockContext.audioWorklet.addModule).toHaveBeenCalledWith(
        '/tick-processor.worklet.js'
      );
    });

    it('creates AudioWorkletNode after loading', async () => {
      await audioManager.loadWorklet();

      const workletNode = (audioManager as any).workletNode;
      expect(workletNode).not.toBeNull();
    });

    it('sets up message handler for worklet', async () => {
      await audioManager.loadWorklet();

      const workletNode = (audioManager as any).workletNode;
      expect(workletNode.port.onmessage).not.toBeNull();
    });

    it('throws error if AudioContext not initialized', async () => {
      const uninitializedManager = new AudioManager();

      await expect(uninitializedManager.loadWorklet()).rejects.toThrow(
        'AudioContext not initialized'
      );
    });

    it('throws error if worklet loading fails', async () => {
      const mockContext = (audioManager as any).audioContext;
      mockContext.audioWorklet.addModule.mockRejectedValue(
        new Error('Failed to load')
      );

      await expect(audioManager.loadWorklet()).rejects.toThrow(
        'Failed to load AudioWorklet'
      );
    });
  });

  describe('WASM loading', () => {
    beforeEach(async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
    });

    it('fetches WASM module from correct path', async () => {
      // Mock WebAssembly.compile to avoid actual compilation
      const compileSpy = vi.spyOn(WebAssembly, 'compile');
      compileSpy.mockResolvedValue({} as WebAssembly.Module);
      
      await audioManager.loadWasm();

      expect(mockFetch).toHaveBeenCalledWith('/tick-detector.wasm');
      
      compileSpy.mockRestore();
    });

    it('compiles WASM module', async () => {
      const compileSpy = vi.spyOn(WebAssembly, 'compile');
      compileSpy.mockResolvedValue({} as WebAssembly.Module);

      await audioManager.loadWasm();

      expect(compileSpy).toHaveBeenCalled();

      compileSpy.mockRestore();
    });

    it('sends compiled WASM module to worklet', async () => {
      const mockModule = {} as WebAssembly.Module;
      vi.spyOn(WebAssembly, 'compile').mockResolvedValue(mockModule);

      await audioManager.loadWasm();

      const workletNode = (audioManager as any).workletNode;
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'setWasm',
        wasmBinary: expect.any(ArrayBuffer)
      });
    });

    it('throws error if WASM fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(audioManager.loadWasm()).rejects.toThrow(
        'Failed to fetch WASM module'
      );
    });

    it('throws error if WASM compilation fails', async () => {
      vi.spyOn(WebAssembly, 'compile').mockRejectedValue(
        new Error('Compilation error')
      );

      await expect(audioManager.loadWasm()).rejects.toThrow(
        'Failed to load WASM module'
      );
    });
  });

  describe('Calibration', () => {
    beforeEach(async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
    });

    it('sends calibration settings to worklet', () => {
      audioManager.setCalibration(1.5, 0.1);

      const workletNode = (audioManager as any).workletNode;
      expect(workletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'setCalibration',
        sensitivity: 1.5,
        threshold: 0.1
      });
    });

    it('handles setCalibration when worklet not loaded', () => {
      const uninitializedManager = new AudioManager();

      // Should not throw
      expect(() => {
        uninitializedManager.setCalibration(1.0, 0.08);
      }).not.toThrow();
    });
  });

  describe('Audio processing', () => {
    beforeEach(async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
    });

    it('connects audio graph on start', () => {
      audioManager.start();

      const sourceNode = (audioManager as any).sourceNode;
      const workletNode = (audioManager as any).workletNode;

      expect(sourceNode.connect).toHaveBeenCalledWith(workletNode);
    });

    it('sets processing state to true on start', () => {
      audioManager.start();

      const state = audioManager.getState();
      expect(state.processing).toBe(true);
    });

    it('throws error if AudioContext not initialized', () => {
      const uninitializedManager = new AudioManager();

      expect(() => uninitializedManager.start()).toThrow(
        'AudioContext not initialized'
      );
    });

    it('throws error if worklet not loaded', async () => {
      const managerWithoutWorklet = new AudioManager();
      await managerWithoutWorklet.initialize();

      expect(() => managerWithoutWorklet.start()).toThrow(
        'AudioWorklet not loaded'
      );
    });

    it('does not start twice if already processing', () => {
      audioManager.start();

      const sourceNode = (audioManager as any).sourceNode;
      vi.clearAllMocks();

      audioManager.start();

      expect(sourceNode.connect).not.toHaveBeenCalled();
    });

    it('disconnects audio graph on stop', () => {
      audioManager.start();

      const sourceNode = (audioManager as any).sourceNode;
      const workletNode = (audioManager as any).workletNode;

      audioManager.stop();

      expect(sourceNode.disconnect).toHaveBeenCalledWith(workletNode);
    });

    it('sets processing state to false on stop', () => {
      audioManager.start();
      audioManager.stop();

      const state = audioManager.getState();
      expect(state.processing).toBe(false);
    });

    it('handles stop when not processing', () => {
      // Should not throw
      expect(() => audioManager.stop()).not.toThrow();
    });
  });

  describe('Tick detection callback', () => {
    beforeEach(async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
    });

    it('registers tick detection callback', () => {
      const callback = vi.fn();

      audioManager.onTickDetected(callback);

      expect((audioManager as any).tickCallback).toBe(callback);
    });

    it('invokes callback when tickDetected message received', () => {
      const callback = vi.fn();
      audioManager.onTickDetected(callback);

      // Simulate worklet message
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      messageHandler({
        data: {
          type: 'tickDetected',
          timestamp: 1000,
          amplitude: 0.15,
          confidence: 1.0
        }
      } as MessageEvent);

      expect(callback).toHaveBeenCalledWith({
        timestamp: 1000,
        amplitude: 0.15,
        confidence: 1.0
      });
    });

    it('does not invoke callback if not registered', () => {
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      // Should not throw
      expect(() => {
        messageHandler({
          data: {
            type: 'tickDetected',
            timestamp: 1000,
            amplitude: 0.15,
            confidence: 1.0
          }
        } as MessageEvent);
      }).not.toThrow();
    });
  });

  describe('Worklet message handling', () => {
    beforeEach(async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
    });

    it('handles ready message', () => {
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      // Should not throw
      expect(() => {
        messageHandler({
          data: { type: 'ready' }
        } as MessageEvent);
      }).not.toThrow();
    });

    it('handles wasmReady message', () => {
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      expect(() => {
        messageHandler({
          data: { type: 'wasmReady' }
        } as MessageEvent);
      }).not.toThrow();
    });

    it('handles calibrationSet message', () => {
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      expect(() => {
        messageHandler({
          data: {
            type: 'calibrationSet',
            sensitivity: 1.5,
            threshold: 0.1
          }
        } as MessageEvent);
      }).not.toThrow();
    });

    it('handles error message', () => {
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      expect(() => {
        messageHandler({
          data: {
            type: 'error',
            error: 'Test error',
            details: 'Error details'
          }
        } as MessageEvent);
      }).not.toThrow();
    });

    it('handles unknown message type', () => {
      const workletNode = (audioManager as any).workletNode;
      const messageHandler = workletNode.port.onmessage;

      expect(() => {
        messageHandler({
          data: { type: 'unknown' }
        } as MessageEvent);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
    });

    it('stops processing on cleanup', () => {
      audioManager.start();
      audioManager.cleanup();

      const state = audioManager.getState();
      expect(state.processing).toBe(false);
    });

    it('disconnects worklet node', () => {
      const workletNode = (audioManager as any).workletNode;

      audioManager.cleanup();

      expect(workletNode.disconnect).toHaveBeenCalled();
    });

    it('disconnects source node', () => {
      const sourceNode = (audioManager as any).sourceNode;

      audioManager.cleanup();

      expect(sourceNode.disconnect).toHaveBeenCalled();
    });

    it('stops media stream tracks', () => {
      const mediaStream = (audioManager as any).mediaStream;
      const tracks = mediaStream.getTracks();

      audioManager.cleanup();

      tracks.forEach((track: any) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });

    it('closes AudioContext', () => {
      const audioContext = (audioManager as any).audioContext;

      audioManager.cleanup();

      expect(audioContext.close).toHaveBeenCalled();
    });

    it('clears all references', () => {
      audioManager.cleanup();

      expect((audioManager as any).audioContext).toBeNull();
      expect((audioManager as any).workletNode).toBeNull();
      expect((audioManager as any).sourceNode).toBeNull();
      expect((audioManager as any).mediaStream).toBeNull();
      expect((audioManager as any).tickCallback).toBeNull();
    });

    it('sets initialized state to false', () => {
      audioManager.cleanup();

      const state = audioManager.getState();
      expect(state.initialized).toBe(false);
    });

    it('can be called multiple times safely', () => {
      audioManager.cleanup();

      expect(() => audioManager.cleanup()).not.toThrow();
    });
  });

  describe('State inspection', () => {
    it('returns correct state when not initialized', () => {
      const state = audioManager.getState();

      expect(state.initialized).toBe(false);
      expect(state.processing).toBe(false);
      expect(state.contextState).toBeNull();
      expect(state.sampleRate).toBeNull();
    });

    it('returns correct state when initialized', async () => {
      await audioManager.initialize();

      const state = audioManager.getState();

      expect(state.initialized).toBe(true);
      expect(state.processing).toBe(false);
      expect(state.contextState).toBe('running');
      expect(state.sampleRate).toBe(48000);
    });

    it('returns correct state when processing', async () => {
      await audioManager.initialize();
      await audioManager.loadWorklet();
      audioManager.start();

      const state = audioManager.getState();

      expect(state.initialized).toBe(true);
      expect(state.processing).toBe(true);
    });
  });
});
