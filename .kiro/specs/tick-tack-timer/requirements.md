# Requirements Document

## Introduction

Tick Tack Timer is a Progressive Web Application (PWA) that listens to mechanical clock ticks using audio input and counts them in real-time. The application uses high-performance audio processing through AudioWorklet and WebAssembly (compiled from AssemblyScript) to detect ticks with minimal latency. Users can calibrate the detection based on clock size and choose between internal or external microphones for optimal signal quality.

## Glossary

- **Tick_Tack_Timer**: The PWA system that detects and counts clock ticks
- **Audio_Processor**: The AudioWorklet-based component that processes audio input in real-time
- **Tick_Detector**: The WASM module that analyzes audio samples and identifies tick events
- **Calibration_Engine**: The component that adjusts sensitivity and threshold based on clock size
- **Tick_Counter**: The component that maintains the count of detected ticks
- **Microphone_Selector**: The component that manages audio input source selection
- **Clock_Size**: The classification of clock (small, medium, large) indicating tick frequency
- **Tick_Event**: A detected clock tick sound that meets threshold criteria
- **Contact_Microphone**: An external microphone connected via USB-C that physically contacts the clock
- **Internal_Microphone**: The device's built-in microphone
- **Sensitivity**: The audio level threshold for detecting tick sounds
- **Threshold**: The minimum signal strength required to register a Tick_Event

## Requirements

### Requirement 1: Audio Input Source Selection

**User Story:** As a user, I want to choose between internal and external microphones, so that I can optimize audio quality based on my environment.

#### Acceptance Criteria

1. THE Microphone_Selector SHALL provide options for Internal_Microphone and Contact_Microphone
2. WHEN a user selects an audio input source, THE Microphone_Selector SHALL activate the selected microphone
3. WHEN a Contact_Microphone is connected via USB-C, THE Microphone_Selector SHALL detect and list it as available
4. WHEN no Contact_Microphone is connected, THE Microphone_Selector SHALL display only the Internal_Microphone option
5. THE Microphone_Selector SHALL persist the user's microphone selection across sessions

### Requirement 2: Clock Size Calibration

**User Story:** As a user, I want to calibrate the app for my clock size, so that tick detection is accurate for different tick frequencies.

#### Acceptance Criteria

1. THE Calibration_Engine SHALL provide three Clock_Size options: small, medium, and large
2. WHEN a user selects a Clock_Size, THE Calibration_Engine SHALL adjust expected tick frequency accordingly
3. WHILE calibration is active, THE Calibration_Engine SHALL analyze incoming audio to determine optimal Sensitivity and Threshold values
4. WHEN calibration completes, THE Calibration_Engine SHALL store the calibrated Sensitivity and Threshold values
5. THE Calibration_Engine SHALL provide visual feedback during the calibration process

### Requirement 3: Real-Time Audio Processing

**User Story:** As a user, I want the app to process audio in real-time with minimal latency, so that tick detection is immediate and accurate.

#### Acceptance Criteria

1. THE Audio_Processor SHALL run in a dedicated AudioWorklet thread
2. THE Audio_Processor SHALL process audio samples continuously without blocking the main thread
3. WHEN audio samples are received, THE Audio_Processor SHALL pass them to the Tick_Detector WASM module
4. THE Audio_Processor SHALL maintain audio processing latency below 100 milliseconds
5. IF the AudioWorklet fails to initialize, THEN THE Tick_Tack_Timer SHALL display an error message to the user

### Requirement 4: Tick Detection

**User Story:** As a user, I want the app to accurately detect clock ticks, so that I can count them reliably.

#### Acceptance Criteria

1. WHEN an audio sample exceeds the calibrated Threshold, THE Tick_Detector SHALL identify it as a potential Tick_Event
2. THE Tick_Detector SHALL apply the calibrated Sensitivity to filter out background noise
3. WHEN a Tick_Event is confirmed, THE Tick_Detector SHALL notify the Tick_Counter
4. THE Tick_Detector SHALL prevent duplicate detection of the same tick within a 50-millisecond window
5. THE Tick_Detector SHALL execute within the WASM runtime for optimal performance

### Requirement 5: Tick Counting and Display

**User Story:** As a user, I want to see the count of detected ticks, so that I can monitor the clock's operation.

#### Acceptance Criteria

1. THE Tick_Counter SHALL increment by one for each detected Tick_Event
2. THE Tick_Counter SHALL display the current count in real-time on the measurement page
3. WHEN a user starts a new measurement session, THE Tick_Counter SHALL reset to zero
4. THE Tick_Counter SHALL update the display within 50 milliseconds of receiving a Tick_Event
5. THE Tick_Counter SHALL maintain count accuracy without drift during extended sessions

### Requirement 6: Progressive Web App Capabilities

**User Story:** As a user, I want to install and use the app like a native application, so that I can access it quickly without a browser interface.

#### Acceptance Criteria

1. THE Tick_Tack_Timer SHALL provide a valid web app manifest for PWA installation
2. THE Tick_Tack_Timer SHALL register a service worker for offline functionality
3. WHEN installed, THE Tick_Tack_Timer SHALL be launchable from the device home screen
4. THE Tick_Tack_Timer SHALL function offline after initial installation
5. THE Tick_Tack_Timer SHALL meet PWA installability criteria for mobile browsers

### Requirement 7: Navigation and Page Structure

**User Story:** As a user, I want to navigate between different pages, so that I can access settings, calibration, and measurement features.

#### Acceptance Criteria

1. THE Tick_Tack_Timer SHALL provide three pages: Settings, Calibration, and Measurement
2. THE Tick_Tack_Timer SHALL provide navigation controls to move between pages
3. WHEN a user navigates to a page, THE Tick_Tack_Timer SHALL load the page within 200 milliseconds
4. THE Tick_Tack_Timer SHALL maintain application state when navigating between pages
5. WHEN a user opens the app, THE Tick_Tack_Timer SHALL display the Measurement page by default

### Requirement 8: Microphone Permissions

**User Story:** As a user, I want to grant microphone access to the app, so that it can listen to clock ticks.

#### Acceptance Criteria

1. WHEN the app requires microphone access, THE Tick_Tack_Timer SHALL request permission from the user
2. IF microphone permission is denied, THEN THE Tick_Tack_Timer SHALL display a message explaining why access is needed
3. WHEN microphone permission is granted, THE Tick_Tack_Timer SHALL activate the selected audio input source
4. IF microphone access is revoked during operation, THEN THE Tick_Tack_Timer SHALL pause tick detection and notify the user
5. THE Tick_Tack_Timer SHALL handle permission requests according to browser security policies

### Requirement 9: Build and Deployment

**User Story:** As a developer, I want to build and deploy the app to GitHub Pages, so that users can access it at the configured domain.

#### Acceptance Criteria

1. THE Tick_Tack_Timer SHALL use Vite as the build tool to generate static assets
2. WHEN the build process executes, THE Tick_Tack_Timer SHALL compile TypeScript and AssemblyScript to production-ready code
3. THE Tick_Tack_Timer SHALL generate static files suitable for GitHub Pages hosting
4. THE Tick_Tack_Timer SHALL configure the base URL for deployment at https://tick.scolavisa.eu
5. THE Tick_Tack_Timer SHALL include all PWA assets in the build output

### Requirement 10: Technology Stack Implementation

**User Story:** As a developer, I want to use modern web technologies, so that the app is performant and maintainable.

#### Acceptance Criteria

1. THE Tick_Tack_Timer SHALL use Vue 3 with Composition API for UI components
2. THE Tick_Tack_Timer SHALL use Vue Router for page navigation
3. THE Tick_Tack_Timer SHALL implement audio processing logic in AssemblyScript compiled to WASM
4. THE Tick_Tack_Timer SHALL use TypeScript for type-safe application code
5. THE Tick_Tack_Timer SHALL use standard CSS without external CSS frameworks
6. THE Tick_Tack_Timer SHALL use Yarn as the package manager

### Requirement 11: Visual Feedback During Measurement

**User Story:** As a user, I want visual feedback when ticks are detected, so that I can verify the app is working correctly.

#### Acceptance Criteria

1. WHEN a Tick_Event is detected, THE Tick_Tack_Timer SHALL provide immediate visual feedback on the measurement page
2. THE Tick_Tack_Timer SHALL display visual feedback within 50 milliseconds of tick detection
3. THE Tick_Tack_Timer SHALL distinguish visual feedback from the tick count display
4. THE Tick_Tack_Timer SHALL ensure visual feedback does not interfere with count readability
5. WHILE no ticks are detected for 5 seconds, THE Tick_Tack_Timer SHALL indicate idle state

### Requirement 12: Calibration Feedback

**User Story:** As a user, I want feedback during calibration, so that I know when calibration is complete and successful.

#### Acceptance Criteria

1. WHILE calibration is in progress, THE Calibration_Engine SHALL display detected ticks in real-time
2. WHEN sufficient tick samples are collected, THE Calibration_Engine SHALL indicate calibration completion
3. THE Calibration_Engine SHALL require a minimum of 10 detected ticks to complete calibration
4. IF no ticks are detected within 30 seconds, THEN THE Calibration_Engine SHALL prompt the user to check microphone placement
5. WHEN calibration succeeds, THE Calibration_Engine SHALL enable navigation to the measurement page

### Requirement 13: Session Management

**User Story:** As a user, I want to start and stop measurement sessions, so that I can control when tick counting occurs.

#### Acceptance Criteria

1. THE Tick_Tack_Timer SHALL provide controls to start and stop measurement sessions
2. WHEN a user starts a session, THE Tick_Counter SHALL begin counting from zero
3. WHEN a user stops a session, THE Tick_Counter SHALL preserve the final count for review
4. THE Tick_Tack_Timer SHALL display session duration alongside tick count
5. WHEN a user starts a new session, THE Tick_Tack_Timer SHALL prompt for confirmation if a previous session is active

### Requirement 14: Error Handling

**User Story:** As a user, I want clear error messages when issues occur, so that I can resolve problems quickly.

#### Acceptance Criteria

1. IF microphone access fails, THEN THE Tick_Tack_Timer SHALL display a specific error message with resolution steps
2. IF AudioWorklet initialization fails, THEN THE Tick_Tack_Timer SHALL display a browser compatibility message
3. IF WASM module loading fails, THEN THE Tick_Tack_Timer SHALL display an error and attempt to reload
4. WHEN an error occurs, THE Tick_Tack_Timer SHALL log error details for debugging purposes
5. THE Tick_Tack_Timer SHALL continue operating in degraded mode when non-critical components fail

### Requirement 15: Responsive Design

**User Story:** As a user, I want the app to work on different mobile devices, so that I can use it on my phone or tablet.

#### Acceptance Criteria

1. THE Tick_Tack_Timer SHALL render correctly on mobile devices with screen widths from 320 pixels to 768 pixels
2. THE Tick_Tack_Timer SHALL use touch-friendly controls with minimum tap target size of 44 pixels
3. THE Tick_Tack_Timer SHALL adapt layout orientation for portrait and landscape modes
4. THE Tick_Tack_Timer SHALL ensure text remains readable without zooming on mobile devices
5. THE Tick_Tack_Timer SHALL prevent accidental navigation through appropriate touch handling

