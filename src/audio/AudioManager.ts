/**
 * AudioManager - Coordinates audio system initialization and communication
 * Validates: Requirements 3.1, 3.2, 3.3, 8.3
 * 
 * This class manages:
 * - Web Audio API initialization (AudioContext)
 * - Microphone access and MediaStream management
 * - AudioWorklet processor loading and lifecycle
 * - WASM module loading and instantiation
 * - Audio graph connection: MediaStream → GainNode → AudioWorklet
 * - Input gain control (digital pre-amp) to compensate for low-level phone mics
 * - Tick detection event forwarding to application layer
 * - Resource cleanup and disposal
 */

import type { TickEvent } from '../types';

// Safe limits for the digital input gain stage
const MIN_INPUT_GAIN = 0.0;
const MAX_INPUT_GAIN = 32.0;

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  /** Digital pre-amp inserted between the mic source and the AudioWorklet. */
  private gainNode: GainNode | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private tickCallback: ((event: TickEvent) => void) | null = null;
  private volumeCallback: ((level: number, threshold: number) => void) | null = null;
  private isProcessing = false;

  /**
   * Initialize the audio system
   * Creates AudioContext and requests microphone access
   * 
   * @param deviceId - Optional specific microphone device ID
   * @throws Error if microphone access is denied or AudioContext creation fails
   */
  async initialize(deviceId?: string): Promise<void> {
    try {
      // Create AudioContext if not already created
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume AudioContext if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Request microphone access.
      // Best-effort: try to disable browser voice-processing features (AGC, noise
      // suppression, echo cancellation) to get a raw signal — this is especially
      // important on phones where these processing stages can drastically reduce the
      // apparent microphone level delivered to the app.
      // If the browser rejects the enhanced constraints (some do), fall back to simpler ones.
      let stream: MediaStream | null = null;
      try {
        const enhancedAudio: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {})
        };
        stream = await navigator.mediaDevices.getUserMedia({ audio: enhancedAudio, video: false });
      } catch {
        // Fall back to simpler constraints when enhanced ones are not supported
        console.warn('AudioManager: Enhanced mic constraints rejected - falling back to default constraints');
        const fallbackConstraints: MediaStreamConstraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          video: false
        };
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      this.mediaStream = stream;

      // Create MediaStreamAudioSourceNode from the microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create a gain node (digital pre-amp) so the app can compensate for
      // low-level microphone signals, especially on phones.
      // Default gain of 1.0 means no amplification — desktop behaviour is unchanged.
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

    } catch (error) {
      // Clean up on error
      this.cleanup();
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied');
        } else if (error.name === 'NotFoundError') {
          throw new Error('Microphone device not found');
        } else {
          throw new Error(`Failed to initialize audio: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Load the AudioWorklet processor script
   * Must be called after initialize() and before start()
   * 
   * @throws Error if AudioWorklet loading fails
   */
  async loadWorklet(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    try {
      // Load the AudioWorklet processor module
      // The path is relative to the public directory
      await this.audioContext.audioWorklet.addModule('/tick-processor.worklet.js');

      // Create the AudioWorkletNode
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'tick-processor'
      );

      // Set up message handler for worklet messages
      this.workletNode.port.onmessage = (event) => {
        this.handleWorkletMessage(event.data);
      };

    } catch (error) {
      throw new Error(
        `Failed to load AudioWorklet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load and compile the WASM module
   * Must be called after initialize()
   * 
   * @returns The compiled WASM module
   * @throws Error if WASM loading or compilation fails
   */
  async loadWasm(): Promise<WebAssembly.Module> {
    try {
      const response = await fetch('/tick-detector.wasm');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
      }

      const wasmBinary = await response.arrayBuffer();
      this.wasmModule = await WebAssembly.compile(wasmBinary);

      // Send the raw binary to the worklet
      if (this.workletNode) {
        this.workletNode.port.postMessage({
          type: 'setWasm',
          wasmBinary: wasmBinary
        });
      }

      return this.wasmModule;

    } catch (error) {
      console.error('AudioManager: WASM loading failed:', error);
      throw new Error(
        `Failed to load WASM module: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set calibration parameters for tick detection
   * Sends sensitivity, threshold and band-pass filter values to the AudioWorklet processor
   * 
   * @param sensitivity - Sensitivity multiplier (0.1 - 2.0)
   * @param threshold - RMS amplitude threshold (0.01 - 0.5)
   * @param lowCutoff - High-pass edge in Hz (0 = bypass)
   * @param highCutoff - Low-pass edge in Hz (0 = bypass)
   * @param debounceWindowMs - Duplicate-detection window in milliseconds (optional)
   */
  setCalibration(sensitivity: number, threshold: number, lowCutoff: number, highCutoff: number, debounceWindowMs?: number): void {
    if (!this.workletNode) {
      console.warn('AudioManager: Cannot set calibration, worklet not loaded');
      return;
    }

    // Send calibration settings to the worklet
    this.workletNode.port.postMessage({
      type: 'setCalibration',
      sensitivity,
      threshold,
      lowCutoff,
      highCutoff,
      ...(debounceWindowMs !== undefined ? { debounceWindowMs } : {})
    });
  }

  /**
   * Start audio processing
   * Connects the audio graph: MediaStream → GainNode → AudioWorklet
   * 
   * @throws Error if audio system is not fully initialized
   */
  start(): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    if (!this.sourceNode) {
      throw new Error('MediaStream source not created. Call initialize() first.');
    }

    if (!this.workletNode) {
      throw new Error('AudioWorklet not loaded. Call loadWorklet() first.');
    }

    if (this.isProcessing) {
      return;
    }

    // Connect the audio graph: source → gain → worklet
    this.sourceNode.connect(this.gainNode!);
    this.gainNode!.connect(this.workletNode);

    this.isProcessing = true;
    console.log('AudioManager: Audio processing started');
  }

  /**
   * Stop audio processing
   * Disconnects the audio graph but keeps resources allocated
   */
  stop(): void {
    if (!this.isProcessing) {
      return;
    }

    // Disconnect only the source→gain edge so the gain→worklet
    // wiring can be reused when start() is called again.
    if (this.sourceNode && this.gainNode) {
      this.sourceNode.disconnect(this.gainNode);
    }

    this.isProcessing = false;
  }

  /**
   * Set the digital input gain applied before the AudioWorklet.
   * Use this to compensate for low microphone levels on phones.
   * 
   * @param value - Gain multiplier. 1.0 = unity (no change). Safe range: 0–32.
   */
  setInputGain(value: number): void {
    // Clamp to safe range to avoid clipping or silent output
    const clamped = Math.max(MIN_INPUT_GAIN, Math.min(MAX_INPUT_GAIN, value));
    if (this.gainNode) {
      this.gainNode.gain.value = clamped;
    }
  }

  /**
   * Get the current digital input gain value.
   * Returns 1.0 (unity gain) when the gain node has not been created yet.
   */
  getInputGain(): number {
    return this.gainNode?.gain.value ?? 1.0;
  }

  /**
   * Register a callback for tick detection events
   * The callback will be invoked whenever the worklet detects a tick
   * 
   * @param callback - Function to call when a tick is detected
   */
  onTickDetected(callback: (event: TickEvent) => void): void {
    this.tickCallback = callback;
  }

  /**
   * Register a callback for volume level updates
   * The callback will be invoked periodically with the current audio level
   * 
   * @param callback - Function to call with the current RMS level and detection threshold
   */
  onVolumeLevel(callback: (level: number, threshold: number) => void): void {
    this.volumeCallback = callback;
  }

  /**
   * Clean up all audio resources
   * Stops processing, closes streams, and releases AudioContext
   */
  cleanup(): void {
    // Stop processing if active
    this.stop();

    // Disconnect and clean up worklet node
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    // Disconnect and clean up gain node
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // Disconnect and clean up source node
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop and clean up media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear callback
    this.tickCallback = null;
    this.volumeCallback = null;
    this.wasmModule = null;
    this.isProcessing = false;
  }

  /**
   * Handle messages from the AudioWorklet processor
   * 
   * @param data - Message data from the worklet
   */
  private handleWorkletMessage(data: any): void {
    switch (data.type) {
      case 'ready':
        console.log('AudioManager: Worklet ready');
        break;

      case 'wasmReady':
        console.log('AudioManager: WASM module initialized in worklet');
        break;

      case 'calibrationSet':
        console.log('AudioManager: Calibration updated', {
          sensitivity: data.sensitivity,
          threshold: data.threshold,
          lowCutoff: data.lowCutoff,
          highCutoff: data.highCutoff
        });
        break;

      case 'tickDetected':
        // Forward tick detection event to the application layer
        if (this.tickCallback) {
          const tickEvent: TickEvent = {
            timestamp: data.timestamp,
            amplitude: data.amplitude,
            confidence: data.confidence
          };
          this.tickCallback(tickEvent);
        }
        break;

      case 'volumeUpdate':
        // Forward volume level to the application layer
        if (this.volumeCallback) {
          this.volumeCallback(data.level, data.threshold);
        }
        break;

      case 'error':
        console.error('AudioManager: Worklet error', {
          error: data.error,
          details: data.details
        });
        break;

      default:
        console.warn('AudioManager: Unknown worklet message type', data.type);
    }
  }

  /**
   * Get the current AudioContext state
   * Useful for debugging and status checks
   */
  getState(): {
    initialized: boolean;
    processing: boolean;
    contextState: AudioContextState | null;
    sampleRate: number | null;
    inputGain: number;
  } {
    return {
      initialized: this.audioContext !== null,
      processing: this.isProcessing,
      contextState: this.audioContext?.state || null,
      sampleRate: this.audioContext?.sampleRate || null,
      inputGain: this.getInputGain()
    };
  }
}
