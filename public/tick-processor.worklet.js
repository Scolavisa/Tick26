// AudioWorklet processor for real-time tick detection
// Validates: Requirements 3.1, 3.2, 3.3, 4.3, 4.4
//
// This processor runs in a dedicated audio thread and:
// - Receives 128-sample audio blocks from the Web Audio API
// - Passes samples to the WASM tick detector
// - Implements 50ms duplicate detection window
// - Posts tick detection messages to the main thread
// - Maintains latency below 100ms

class TickProcessorWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // WASM instance for tick detection
    this.wasmInstance = null;
    this.wasmMemory = null;
    this.wasmExports = null;
    
    // Calibration parameters
    this.sensitivity = 1.0;
    this.threshold = 0.08;
    this.lowCutoff = 500;
    this.highCutoff = 8000;
    
    // Duplicate detection window (50ms)
    // At 48kHz sample rate, 50ms = 2400 samples
    // We track the last tick time in samples
    this.lastTickTime = -Infinity;
    this.duplicateWindowSamples = 2400; // 50ms at 48kHz
    this.currentSampleTime = 0;
    
    // Sample rate (will be set from context)
    this.sampleRate = sampleRate || 48000;
    
    // Update duplicate window based on actual sample rate
    this.duplicateWindowSamples = Math.floor(this.sampleRate * 0.05); // 50ms
    
    // Volume level reporting
    // Send a volumeUpdate message roughly every 100ms
    // 128 is the standard AudioWorklet render quantum size (samples per block)
    this.volumeReportInterval = Math.max(1, Math.round(this.sampleRate * 0.1 / 128));
    this.blockCount = 0;
    
    // Message handler for communication with main thread
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    // Notify main thread that worklet is ready
    this.port.postMessage({ type: 'ready' });
  }
  
  /**
   * Handle messages from the main thread
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    switch (data.type) {
      case 'setCalibration':
        this.handleSetCalibration(data);
        break;
      case 'setWasm':
        this.handleSetWasm(data);
        break;
      default:
        console.warn('TickProcessorWorklet: Unknown message type:', data.type);
    }
  }
  
  /**
   * Handle calibration settings update
   * @param {Object} data - Calibration data with sensitivity and threshold
   */
  handleSetCalibration(data) {
    if (typeof data.sensitivity === 'number') {
      this.sensitivity = data.sensitivity;
    }
    if (typeof data.threshold === 'number') {
      this.threshold = data.threshold;
    }
    if (typeof data.lowCutoff === 'number') {
      this.lowCutoff = data.lowCutoff;
    }
    if (typeof data.highCutoff === 'number') {
      this.highCutoff = data.highCutoff;
    }
    if (typeof data.debounceWindowMs === 'number' && data.debounceWindowMs > 0) {
      this.duplicateWindowSamples = Math.floor(this.sampleRate * data.debounceWindowMs / 1000);
    }
    
    // Acknowledge calibration update
    this.port.postMessage({
      type: 'calibrationSet',
      sensitivity: this.sensitivity,
      threshold: this.threshold,
      lowCutoff: this.lowCutoff,
      highCutoff: this.highCutoff
    });
  }
  
  /**
   * Handle WASM module initialization
   * @param {Object} data - WASM module data
   */
  async handleSetWasm(data) {
    try {
      if (data.wasmBinary) {
        const wasmBinary = data.wasmBinary;
        
        // Compile and instantiate WASM module
        const wasmModule = await WebAssembly.compile(wasmBinary);
        const instance = new WebAssembly.Instance(wasmModule, {
          env: {
            abort: (msg, file, line, column) => {
              console.error('WASM abort:', msg, file, line, column);
            }
          }
        });
        
        this.wasmInstance = instance;
        this.wasmExports = instance.exports;
        this.wasmMemory = this.wasmExports.memory;
        
        console.log('AudioWorklet: WASM initialized');
        
        // Acknowledge WASM initialization
        this.port.postMessage({ type: 'wasmReady' });
      }
    } catch (error) {
      console.error('AudioWorklet: Failed to initialize WASM:', error);
      this.port.postMessage({
        type: 'error',
        error: 'Failed to initialize WASM module',
        details: error.message
      });
    }
  }
  
  /**
   * Process audio samples
   * This is called by the Web Audio API for each 128-sample block
   * 
   * @param {Float32Array[][]} inputs - Input audio data
   * @param {Float32Array[][]} outputs - Output audio data (unused)
   * @param {Object} parameters - Audio parameters (unused)
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs, parameters) {
    // Check if we have WASM initialized
    if (!this.wasmInstance || !this.wasmExports) {
      return true; // Keep processor alive
    }
    
    // Log that we're processing (once)
    if (!this.processingStarted) {
      console.log('AudioWorklet: Audio processing started');
      this.processingStarted = true;
    }
    
    // Get the first input channel (mono)
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    
    const samples = input[0]; // First channel
    if (!samples || samples.length === 0) {
      return true;
    }
    
    const sampleCount = samples.length;
    
    try {
      // Copy samples to WASM memory
      const samplesOffset = 1024; // Safe offset beyond AssemblyScript runtime data
      const bytesNeeded = sampleCount * 4;
      
      // Ensure we have enough memory
      const memorySize = this.wasmMemory.buffer.byteLength;
      if (samplesOffset + bytesNeeded > memorySize) {
        const pagesNeeded = Math.ceil((samplesOffset + bytesNeeded) / 65536);
        const currentPages = memorySize / 65536;
        if (pagesNeeded > currentPages) {
          this.wasmMemory.grow(pagesNeeded - currentPages);
        }
      }
      
      const wasmSamples = new Float32Array(
        this.wasmMemory.buffer,
        samplesOffset,
        sampleCount
      );
      
      wasmSamples.set(samples);
      
      // Call WASM detectTick function
      const tickDetected = this.wasmExports.detectTick(
        samplesOffset,
        sampleCount,
        this.threshold,
        this.sensitivity,
        this.lowCutoff,
        this.highCutoff
      );
      
      // Check if tick was detected
      if (tickDetected) {
        // Check duplicate detection window
        const timeSinceLastTick = this.currentSampleTime - this.lastTickTime;
        
        if (timeSinceLastTick >= this.duplicateWindowSamples) {
          // Not a duplicate, record this tick
          this.lastTickTime = this.currentSampleTime;
          
          // Calculate RMS for reporting
          const rms = this.wasmExports.calculateRMS(samplesOffset, sampleCount);
          const timestamp = this.currentSampleTime / this.sampleRate;
          
          // Post tick detection message to main thread
          this.port.postMessage({
            type: 'tickDetected',
            timestamp: timestamp,
            sampleTime: this.currentSampleTime,
            amplitude: rms,
            confidence: 1.0
          });
        }
      }
      
      // Update current sample time
      this.currentSampleTime += sampleCount;

      // Periodically report audio level to main thread for UI feedback
      this.blockCount++;
      if (this.blockCount >= this.volumeReportInterval) {
        this.blockCount = 0;
        const volumeRms = this.wasmExports.calculateRMS(samplesOffset, sampleCount);
        this.port.postMessage({
          type: 'volumeUpdate',
          level: volumeRms,
          threshold: this.threshold
        });
      }
      
    } catch (error) {
      console.error('AudioWorklet: Error processing audio:', error);
      this.port.postMessage({
        type: 'error',
        error: 'Audio processing error',
        details: error.message
      });
    }
    
    return true;
  }
}

// Register the processor
registerProcessor('tick-processor', TickProcessorWorklet);
