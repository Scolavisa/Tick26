# Implementation Plan: Tick Tack Timer PWA

## Overview

This implementation plan builds the Tick Tack Timer PWA incrementally, starting with project setup and core infrastructure, then implementing audio processing capabilities, followed by the three main pages (Settings, Calibration, Measurement), and finally adding PWA features and deployment configuration. Each task builds on previous work, with checkpoints to validate functionality before proceeding.

The implementation uses Vue 3 with Composition API, TypeScript, AudioWorklet for real-time audio processing, and AssemblyScript/WASM for high-performance tick detection. Testing tasks are marked as optional (*) to allow for faster MVP delivery while maintaining the option for comprehensive test coverage.

## Tasks

- [x] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize Vite project with Vue 3 and TypeScript
    - Create project using `yarn create vite tick-tack-timer --template vue-ts`
    - Configure vite.config.ts with base URL for GitHub Pages deployment at https://tick.scolavisa.eu
    - Set up TypeScript configuration with strict mode
    - _Requirements: 9.1, 9.4, 10.1, 10.4, 10.6_
  
  - [x] 1.2 Install and configure dependencies
    - Install Vue Router: `yarn add vue-router@4`
    - Install Vitest and testing utilities: `yarn add -D vitest @vue/test-utils happy-dom`
    - Install fast-check for property-based testing: `yarn add -D fast-check`
    - Install AssemblyScript: `yarn add -D assemblyscript`
    - Configure Vitest in vite.config.ts
    - _Requirements: 10.2, 10.6_
  
  - [x] 1.3 Set up project structure
    - Create directory structure: src/components, src/composables, src/audio, src/pages, src/types, src/utils
    - Create public directory for PWA assets: public/icons
    - Create AssemblyScript directory: assembly
    - _Requirements: 10.1_
  
  - [x] 1.4 Define TypeScript interfaces and types
    - Create src/types/index.ts with all data model interfaces: CalibrationSettings, SessionData, AudioDeviceInfo, TickEvent, AppState, ErrorInfo, ErrorCode enum
    - Export ClockSize type: 'small' | 'medium' | 'large'
    - _Requirements: 10.4_

- [x] 2. Implement WASM tick detector
  - [x] 2.1 Create AssemblyScript tick detection module
    - Create assembly/tick-detector.ts with exported functions: detectTick, calculateRMS, applyHighPassFilter
    - Implement RMS calculation for audio samples
    - Implement high-pass filter with ~500Hz cutoff
    - Implement threshold comparison logic
    - Configure AssemblyScript build in package.json
    - _Requirements: 4.1, 4.2, 4.5, 10.3_
  
  - [x]* 2.2 Write unit tests for WASM functions
    - Test RMS calculation with known audio samples
    - Test high-pass filter with various frequencies
    - Test threshold detection with samples above/below threshold
    - _Requirements: 4.1, 4.2_
  
  - [x]* 2.3 Write property test for WASM tick detection
    - **Property 10: Threshold-based tick identification**
    - **Validates: Requirements 4.1**
    - Test that samples exceeding threshold are identified as ticks
  
  - [x]* 2.4 Write property test for noise filtering
    - **Property 11: Sensitivity-based noise filtering**
    - **Validates: Requirements 4.2**
    - Test that samples below sensitivity threshold are filtered out

- [x] 3. Implement AudioWorklet processor
  - [x] 3.1 Create AudioWorklet processor script
    - Create public/tick-processor.worklet.js (will be loaded as module)
    - Implement TickProcessorWorklet class extending AudioWorkletProcessor
    - Implement process() method to handle 128-sample blocks
    - Implement message handlers for calibration settings and WASM module
    - Implement 50ms duplicate detection window
    - Post tick detection messages to main thread
    - _Requirements: 3.1, 3.2, 3.3, 4.3, 4.4_
  
  - [x] 3.2 Write unit tests for AudioWorklet processor
    - Mock AudioWorkletProcessor environment
    - Test message passing between worklet and main thread
    - Test audio sample processing logic
    - Test duplicate detection window
    - _Requirements: 3.2, 4.4_
  
  - [ ] 3.3 Write property test for duplicate prevention
    - **Property 13: Duplicate tick prevention**
    - **Validates: Requirements 4.4**
    - Test that detections within 50ms window are ignored

- [x] 4. Implement AudioManager
  - [x] 4.1 Create AudioManager class
    - Create src/audio/AudioManager.ts
    - Implement initialize() method to create AudioContext and request microphone access
    - Implement loadWorklet() method to load AudioWorklet processor
    - Implement loadWasm() method to fetch and compile WASM module
    - Implement audio graph connection: MediaStream → AudioWorklet
    - Implement setCalibration() method to send settings to worklet
    - Implement start() and stop() methods for audio processing
    - Implement onTickDetected() callback registration
    - Implement cleanup() for resource disposal
    - _Requirements: 3.1, 3.2, 3.3, 8.3_
  
  - [x] 4.2 Write unit tests for AudioManager
    - Mock Web Audio API components
    - Test initialization flow
    - Test worklet and WASM loading
    - Test audio graph connection
    - Test cleanup and resource disposal
    - _Requirements: 3.1, 3.3_
  
  - [x] 4.3 Write property test for audio sample forwarding
    - **Property 9: Audio sample forwarding**
    - **Validates: Requirements 3.3**
    - Test that audio samples are passed to WASM module

- [x] 5. Checkpoint - Core audio infrastructure
  - Manually test that AudioManager can initialize AudioContext
  - Manually test that WASM module loads successfully
  - Manually test that AudioWorklet processor loads
  - Ensure all tests pass, ask the user if questions arise

- [x] 6. Implement useAudio composable
  - [x] 6.1 Create useAudio composable
    - Create src/composables/useAudio.ts
    - Implement reactive state: audioContext, selectedDevice, availableDevices, isInitialized, permissionGranted
    - Implement requestPermission() to request microphone access
    - Implement enumerateDevices() to list audio input devices
    - Implement selectDevice() to activate specific microphone
    - Implement initializeWorklet() to set up AudioManager
    - Implement startProcessing() and stopProcessing() methods
    - Implement cleanup() method
    - Persist device selection to localStorage
    - _Requirements: 1.2, 1.3, 1.5, 8.1, 8.3_
  
  - [x] 6.2 Write unit tests for useAudio
    - Mock navigator.mediaDevices API
    - Test permission request flow
    - Test device enumeration
    - Test device selection and activation
    - Test localStorage persistence
    - _Requirements: 1.2, 1.5, 8.1_
  
  - [x] 6.3 Write property test for microphone activation
    - **Property 1: Microphone selection activation**
    - **Validates: Requirements 1.2**
    - Test that selected microphone becomes active audio source
  
  - [x] 6.4 Write property test for external microphone detection
    - **Property 2: External microphone enumeration**
    - **Validates: Requirements 1.3**
    - Test that connected external microphones are detected and listed
  
  - [x] 6.5 Write property test for selection persistence
    - **Property 3: Microphone selection persistence**
    - **Validates: Requirements 1.5**
    - Test that microphone selection persists across app reloads

- [x] 7. Implement useCalibration composable
  - [x] 7.1 Create useCalibration composable
    - Create src/composables/useCalibration.ts
    - Implement reactive state: clockSize, sensitivity, threshold, isCalibrating, calibrationProgress
    - Implement startCalibration() to begin calibration process
    - Implement tick sample collection and analysis
    - Implement stopCalibration() to cancel calibration
    - Implement saveCalibration() to persist settings to localStorage
    - Implement loadCalibration() to restore settings
    - Implement resetCalibration() to clear settings
    - Validate minimum 10 ticks for completion
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 12.3_
  
  - [x] 7.2 Write unit tests for useCalibration
    - Test calibration state machine
    - Test sensitivity and threshold calculation
    - Test localStorage persistence
    - Test minimum tick validation
    - _Requirements: 2.3, 2.4, 12.3_
  
  - [x] 7.3 Write property test for frequency adjustment
    - **Property 4: Clock size frequency adjustment**
    - **Validates: Requirements 2.2**
    - Test that clock size selection sets correct expected frequency
  
  - [x] 7.4 Write property test for calibration computation
    - **Property 5: Calibration parameter computation**
    - **Validates: Requirements 2.3**
    - Test that audio input during calibration produces sensitivity/threshold values
  
  - [x] 7.5 Write property test for calibration persistence
    - **Property 6: Calibration settings persistence**
    - **Validates: Requirements 2.4**
    - Test that saved calibration settings can be loaded with same values

- [x] 8. Implement useCounter composable
  - [x] 8.1 Create useCounter composable
    - Create src/composables/useCounter.ts
    - Implement reactive state: count, lastTickTimestamp, isIdle
    - Implement increment() method to increase count
    - Implement reset() method to clear count
    - Implement getCount() method
    - Implement idle detection (5 seconds without ticks)
    - _Requirements: 5.1, 5.3, 11.5_
  
  - [x] 8.2 Write unit tests for useCounter
    - Test increment functionality
    - Test reset functionality
    - Test idle detection after 5 seconds
    - _Requirements: 5.1, 5.3, 11.5_
  
  - [x] 8.3 Write property test for count accuracy
    - **Property 14: Tick count accuracy**
    - **Validates: Requirements 5.1, 5.5**
    - Test that N tick events result in count of N
  
  - [x] 8.4 Write property test for session reset
    - **Property 16: Session initialization resets counter**
    - **Validates: Requirements 5.3, 13.2**
    - Test that starting new session resets counter to zero

- [x] 9. Implement useSession composable
  - [x] 9.1 Create useSession composable
    - Create src/composables/useSession.ts
    - Implement reactive state: isActive, duration, startTime
    - Implement start() method to begin session
    - Implement stop() method to end session
    - Implement reset() method to clear session
    - Implement getDuration() method
    - Implement session timer using setInterval
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [x] 9.2 Write unit tests for useSession
    - Test session start/stop lifecycle
    - Test duration calculation
    - Test session timer
    - _Requirements: 13.1, 13.2, 13.4_
  
  - [x] 9.3 Write property test for session stop preservation
    - **Property 32: Session stop preserves count**
    - **Validates: Requirements 13.3**
    - Test that stopped session preserves final count

- [x] 10. Checkpoint - Composables complete
  - Ensure all composables are implemented and exported
  - Manually test each composable in isolation
  - Ensure all tests pass, ask the user if questions arise

- [x] 11. Implement Vue Router and navigation
  - [x] 11.1 Set up Vue Router
    - Create src/router/index.ts
    - Define routes for Settings, Calibration, and Measurement pages
    - Set Measurement page as default route (/)
    - Configure router with history mode
    - _Requirements: 7.1, 7.2, 7.5, 10.2_
  
  - [x] 11.2 Create App.vue with navigation
    - Create src/App.vue as root component
    - Add navigation controls (tabs or buttons) for page switching
    - Add router-view for page rendering
    - Implement basic layout structure
    - _Requirements: 7.2_
  
  - [x] 11.3 Write unit tests for router configuration
    - Test route definitions
    - Test default route
    - Test navigation between pages
    - _Requirements: 7.1, 7.5_
  
  - [x] 11.4 Write property test for navigation state preservation
    - **Property 17: Navigation state preservation**
    - **Validates: Requirements 7.4**
    - Test that app state remains unchanged after navigation
  
  - [x] 11.5 Write property test for navigation controls availability
    - **Property 18: Navigation controls availability**
    - **Validates: Requirements 7.2**
    - Test that navigation controls are present on all pages

- [x] 12. Implement SettingsPage component
  - [x] 12.1 Create SettingsPage.vue
    - Create src/pages/SettingsPage.vue
    - Use useAudio composable
    - Display list of available microphones
    - Implement microphone selection UI with radio buttons or dropdown
    - Implement refresh devices button
    - Display current selection
    - Show permission status
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [x] 12.2 Write component tests for SettingsPage
    - Test microphone list rendering
    - Test microphone selection interaction
    - Test refresh devices functionality
    - _Requirements: 1.1, 1.2_
  
  - [x] 12.3 Write property test for permission activation
    - **Property 19: Microphone permission activation**
    - **Validates: Requirements 8.3**
    - Test that granted permission activates audio input

- [x] 13. Implement CalibrationPage component
  - [x] 13.1 Create CalibrationPage.vue
    - Create src/pages/CalibrationPage.vue
    - Use useCalibration and useAudio composables
    - Implement clock size selection (small, medium, large) with buttons or radio group
    - Implement start/stop calibration buttons
    - Display detected tick count during calibration
    - Display calibration status messages
    - Show progress indicator
    - Enable navigation to measurement page after successful calibration
    - Implement 30-second timeout with user prompt
    - _Requirements: 2.1, 2.5, 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 13.2 Write component tests for CalibrationPage
    - Test clock size selection
    - Test calibration start/stop
    - Test tick count display during calibration
    - Test calibration completion
    - Test timeout handling
    - _Requirements: 2.1, 2.5, 12.1, 12.2, 12.4_
  
  - [x] 13.3 Write property test for calibration visual feedback
    - **Property 7: Calibration visual feedback**
    - **Validates: Requirements 2.5**
    - Test that detected ticks update display in same render cycle
  
  - [x] 13.4 Write property test for calibration tick display
    - **Property 29: Calibration tick display**
    - **Validates: Requirements 12.1**
    - Test that calibration page updates tick count display
  
  - [x] 13.5 Write property test for calibration completion indication
    - **Property 30: Calibration completion indication**
    - **Validates: Requirements 12.2**
    - Test that completion status is indicated when minimum ticks collected
  
  - [x] 13.6 Write property test for calibration success navigation
    - **Property 31: Calibration success enables navigation**
    - **Validates: Requirements 12.5**
    - Test that successful calibration enables measurement page navigation

- [x] 14. Implement MeasurementPage component
  - [x] 14.1 Create MeasurementPage.vue
    - Create src/pages/MeasurementPage.vue
    - Use useCounter, useSession, and useAudio composables
    - Display large tick count number
    - Display session duration
    - Implement start/stop session buttons
    - Implement reset button with confirmation
    - Implement visual feedback for tick detection (flash, pulse, or color change)
    - Implement idle state indicator (5 seconds without ticks)
    - Connect tick detection callback from AudioManager to counter increment
    - _Requirements: 5.1, 5.2, 5.4, 11.1, 11.2, 11.4, 11.5, 13.1, 13.5_
  
  - [x] 14.2 Write component tests for MeasurementPage
    - Test tick count display
    - Test session start/stop
    - Test reset functionality
    - Test visual feedback rendering
    - Test idle state display
    - _Requirements: 5.2, 11.1, 11.5, 13.1_
  
  - [x] 14.3 Write property test for real-time count display
    - **Property 15: Real-time count display**
    - **Validates: Requirements 5.2**
    - Test that count changes update display
  
  - [x] 14.4 Write property test for tick detection visual feedback
    - **Property 27: Tick detection visual feedback**
    - **Validates: Requirements 11.1**
    - Test that tick events trigger visual feedback
  
  - [x] 14.5 Write property test for idle state indication
    - **Property 28: Idle state indication**
    - **Validates: Requirements 11.5**
    - Test that 5 seconds without ticks shows idle indicator
  
  - [x] 14.6 Write property test for tick event notification
    - **Property 12: Tick event notification**
    - **Validates: Requirements 4.3**
    - Test that confirmed tick events notify counter

- [x] 15. Checkpoint - Core functionality complete
  - Manually test full workflow: Settings → Calibration → Measurement
  - Test microphone selection and permission flow
  - Test calibration with different clock sizes
  - Test tick detection and counting
  - Ensure all tests pass, ask the user if questions arise

- [x] 16. Implement error handling
  - [x] 16.1 Create error handling utilities
    - Create src/utils/errors.ts
    - Implement ErrorInfo interface and ErrorCode enum
    - Implement error logging to localStorage (last 50 errors)
    - Implement error export functionality
    - _Requirements: 14.4_
  
  - [x] 16.2 Add error handling to useAudio
    - Handle microphone permission denied with user message
    - Handle microphone access failure with resolution steps
    - Handle AudioWorklet initialization failure with browser compatibility message
    - Handle WASM load failure with retry logic
    - Handle permission revoked during operation
    - _Requirements: 8.2, 8.4, 14.1, 14.2, 14.3_
  
  - [x] 16.3 Add error handling to useCalibration
    - Handle calibration timeout (30 seconds) with user prompt
    - Handle insufficient calibration samples
    - _Requirements: 12.4, 12.3_
  
  - [x] 16.4 Create error display component
    - Create src/components/ErrorDisplay.vue
    - Display error icon, title, message, resolution steps
    - Implement action buttons (Retry, Learn More)
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [x] 16.5 Write unit tests for error handling
    - Test error logging
    - Test error display component
    - Test specific error scenarios
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  
  - [x] 16.6 Write property test for error logging
    - **Property 20: Error logging**
    - **Validates: Requirements 14.4**
    - Test that errors are logged to console/tracking system
  
  - [x] 16.7 Write property test for graceful degradation
    - **Property 21: Graceful degradation**
    - **Validates: Requirements 14.5**
    - Test that non-critical failures don't stop app operation

- [ ] 17. Implement responsive design and styling
  - [ ] 17.1 Create base CSS styles
    - Create src/styles/main.css
    - Implement CSS reset and base styles
    - Define CSS custom properties for colors, spacing, typography
    - Implement responsive typography (minimum 16px font size)
    - _Requirements: 10.5, 15.4_
  
  - [ ] 17.2 Implement responsive layout
    - Add media queries for screen widths 320px to 768px
    - Implement flexible layouts using flexbox/grid
    - Ensure touch-friendly controls (minimum 44px tap targets)
    - Implement portrait and landscape orientation support
    - Prevent accidental navigation with appropriate touch handling
    - _Requirements: 15.1, 15.2, 15.3, 15.5_
  
  - [ ] 17.3 Style all components
    - Style SettingsPage with clear microphone selection UI
    - Style CalibrationPage with prominent clock size buttons and progress indicator
    - Style MeasurementPage with large tick count display and visual feedback
    - Style navigation controls
    - Style error display component
    - _Requirements: 10.5_
  
  - [ ]* 17.4 Write property test for responsive rendering
    - **Property 22: Responsive rendering**
    - **Validates: Requirements 15.1**
    - Test that UI renders correctly for widths 320-768px
  
  - [ ]* 17.5 Write property test for touch target sizing
    - **Property 23: Touch target sizing**
    - **Validates: Requirements 15.2**
    - Test that interactive controls are at least 44px
  
  - [ ]* 17.6 Write property test for orientation adaptation
    - **Property 24: Orientation adaptation**
    - **Validates: Requirements 15.3**
    - Test that layout adapts to portrait/landscape
  
  - [ ]* 17.7 Write property test for text readability
    - **Property 25: Text readability**
    - **Validates: Requirements 15.4**
    - Test that text elements are at least 16px
  
  - [ ]* 17.8 Write property test for intentional navigation
    - **Property 26: Intentional navigation**
    - **Validates: Requirements 15.5**
    - Test that navigation requires deliberate gestures

- [ ] 18. Implement PWA features
  - [ ] 18.1 Create web app manifest
    - Create public/manifest.json
    - Define name, short_name, description
    - Set start_url to "/"
    - Set display to "standalone"
    - Define background_color and theme_color
    - Set orientation to "any"
    - Add icon definitions for 192x192 and 512x512
    - _Requirements: 6.1_
  
  - [ ] 18.2 Create PWA icons
    - Create placeholder icons: public/icons/icon-192.png and public/icons/icon-512.png
    - Ensure icons meet PWA requirements
    - _Requirements: 6.1_
  
  - [ ] 18.3 Create service worker
    - Create public/sw.js
    - Implement install event to cache app shell (HTML, CSS, JS, WASM)
    - Implement fetch event with cache-first strategy for static resources
    - Implement activate event to clean old caches
    - Cache AudioWorklet script at runtime
    - _Requirements: 6.2, 6.4_
  
  - [ ] 18.4 Register service worker
    - Add service worker registration in src/main.ts
    - Handle registration success and errors
    - _Requirements: 6.2_
  
  - [ ] 18.5 Add manifest link to index.html
    - Add <link rel="manifest" href="/manifest.json"> to index.html
    - Add theme-color meta tag
    - Add apple-touch-icon links
    - _Requirements: 6.1_
  
  - [ ]* 18.6 Write E2E tests for PWA features
    - Test manifest validation
    - Test service worker registration
    - Test offline functionality
    - _Requirements: 6.1, 6.2, 6.4_

- [ ] 19. Implement non-blocking audio processing validation
  - [ ]* 19.1 Write property test for non-blocking processing
    - **Property 8: Non-blocking audio processing**
    - **Validates: Requirements 3.2**
    - Test that main thread remains responsive during audio processing

- [ ] 20. Final integration and wiring
  - [ ] 20.1 Wire AudioManager to composables
    - Connect AudioManager tick detection callback to useCounter increment
    - Ensure calibration settings flow from useCalibration to AudioManager
    - Ensure device selection flows from useAudio to AudioManager
    - _Requirements: 3.3, 4.3_
  
  - [ ] 20.2 Update main.ts
    - Import and mount App.vue
    - Import router
    - Import global styles
    - Register service worker
    - _Requirements: 10.1_
  
  - [ ] 20.3 Update index.html
    - Set appropriate title and meta tags
    - Add manifest link
    - Add theme-color meta tag
    - Ensure proper viewport configuration for mobile
    - _Requirements: 6.1, 15.1_

- [ ] 21. Checkpoint - Full application integration
  - Test complete user workflow from start to finish
  - Test all error scenarios
  - Test responsive behavior on different screen sizes
  - Test PWA installation (manual)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 22. Build configuration and deployment
  - [ ] 22.1 Configure Vite for production build
    - Update vite.config.ts with build optimizations
    - Configure base URL for GitHub Pages: https://tick.scolavisa.eu
    - Configure AssemblyScript build to output to public directory
    - Ensure WASM and AudioWorklet files are included in build
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 22.2 Create build scripts
    - Add build script to package.json: "build": "tsc && vite build"
    - Add AssemblyScript build script: "build:wasm": "asc assembly/tick-detector.ts -o public/tick-detector.wasm"
    - Add combined build script: "build:all": "yarn build:wasm && yarn build"
    - _Requirements: 9.2_
  
  - [ ] 22.3 Create deployment workflow
    - Create .github/workflows/deploy.yml for GitHub Actions
    - Configure workflow to build and deploy to GitHub Pages
    - Set up deployment to custom domain: https://tick.scolavisa.eu
    - _Requirements: 9.3, 9.4_
  
  - [ ] 22.4 Test production build
    - Run production build locally
    - Test built application with local server
    - Verify all assets load correctly
    - Verify PWA features work in production build
    - _Requirements: 9.3, 9.5_

- [ ] 23. Final checkpoint - Production ready
  - Run full test suite
  - Test production build locally
  - Verify PWA installability
  - Verify offline functionality
  - Test on multiple mobile devices and browsers
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation builds incrementally: infrastructure → audio system → composables → pages → PWA features → deployment
- Manual testing is recommended at checkpoints to validate real audio processing behavior
- AssemblyScript WASM module must be built before the main application build
- Service worker and manifest enable PWA installation and offline functionality
