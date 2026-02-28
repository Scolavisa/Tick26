/**
 * Unit tests for SettingsPage component
 * Validates: Requirements 1.1, 1.2
 * 
 * Tests:
 * - Microphone list rendering
 * - Microphone selection interaction
 * - Refresh devices functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import SettingsPage from '../../../src/pages/SettingsPage.vue';
import { useAudio } from '../../../src/composables/useAudio';

// Mock the useAudio composable
vi.mock('../../../src/composables/useAudio');

describe('SettingsPage Component', () => {
  // Mock functions
  let mockRequestPermission: ReturnType<typeof vi.fn>;
  let mockEnumerateDevices: ReturnType<typeof vi.fn>;
  let mockSelectDevice: ReturnType<typeof vi.fn>;

  // Mock reactive refs - create fresh ones for each test
  let mockSelectedDevice: ReturnType<typeof ref<string | null>>;
  let mockAvailableDevices: ReturnType<typeof ref<MediaDeviceInfo[]>>;
  let mockPermissionGranted: ReturnType<typeof ref<boolean>>;

  beforeEach(() => {
    // Reset mocks
    mockRequestPermission = vi.fn();
    mockEnumerateDevices = vi.fn();
    mockSelectDevice = vi.fn();

    // Create fresh mock reactive refs for each test
    mockSelectedDevice = ref<string | null>(null);
    mockAvailableDevices = ref<MediaDeviceInfo[]>([]);
    mockPermissionGranted = ref(false);

    // Mock useAudio implementation
    vi.mocked(useAudio).mockReturnValue({
      selectedDevice: mockSelectedDevice,
      availableDevices: mockAvailableDevices,
      permissionGranted: mockPermissionGranted,
      requestPermission: mockRequestPermission,
      enumerateDevices: mockEnumerateDevices,
      selectDevice: mockSelectDevice,
      audioContext: ref(null),
      isInitialized: ref(false),
      initializeWorklet: vi.fn(),
      startProcessing: vi.fn(),
      stopProcessing: vi.fn(),
      cleanup: vi.fn(),
      onTickDetected: vi.fn(),
      setCalibration: vi.fn(),
      getState: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission Status Display', () => {
    it('should display permission not requested message initially', () => {
      const wrapper = mount(SettingsPage);
      
      expect(wrapper.text()).toContain('Microphone permission not yet requested');
    });

    it('should display grant permission button when permission not granted', () => {
      const wrapper = mount(SettingsPage);
      
      const button = wrapper.find('button');
      expect(button.exists()).toBe(true);
      expect(button.text()).toContain('Grant Microphone Permission');
    });

    it('should display permission granted message when permission is granted', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.text()).toContain('Microphone permission granted');
    });

    it('should request permission when grant button is clicked', async () => {
      mockRequestPermission.mockResolvedValue(true);
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      
      const button = wrapper.find('button');
      await button.trigger('click');
      await flushPromises();
      
      expect(mockRequestPermission).toHaveBeenCalledOnce();
    });

    it('should enumerate devices after permission is granted', async () => {
      mockRequestPermission.mockResolvedValue(true);
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      
      const button = wrapper.find('button');
      await button.trigger('click');
      await flushPromises();
      
      expect(mockEnumerateDevices).toHaveBeenCalled();
    });

    it('should display error message when permission is denied', async () => {
      mockRequestPermission.mockResolvedValue(false);
      
      const wrapper = mount(SettingsPage);
      
      const button = wrapper.find('button');
      await button.trigger('click');
      await flushPromises();
      
      expect(wrapper.text()).toContain('Microphone permission was denied');
    });
  });

  describe('Microphone List Rendering', () => {
    it('should not display microphone selection when permission not granted', () => {
      const wrapper = mount(SettingsPage);
      
      expect(wrapper.find('.microphone-selection').exists()).toBe(false);
    });

    it('should display microphone selection when permission is granted', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.find('.microphone-selection').exists()).toBe(true);
    });

    it('should display "no devices" message when no microphones are available', async () => {
      mockPermissionGranted.value = true;
      mockAvailableDevices.value = [];
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.text()).toContain('No microphones detected');
    });

    it('should render list of available microphones', async () => {
      mockPermissionGranted.value = true;
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Built-in Microphone',
          groupId: 'group1',
          toJSON: () => ({})
        },
        {
          deviceId: 'device2',
          kind: 'audioinput',
          label: 'External USB Microphone',
          groupId: 'group2',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.text()).toContain('Built-in Microphone');
      expect(wrapper.text()).toContain('External USB Microphone');
    });

    it('should display device ID when label is empty', async () => {
      mockPermissionGranted.value = true;
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device123456789',
          kind: 'audioinput',
          label: '',
          groupId: 'group1',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.text()).toContain('Microphone device12');
    });

    it('should render radio buttons for each device', async () => {
      mockPermissionGranted.value = true;
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group1',
          toJSON: () => ({})
        },
        {
          deviceId: 'device2',
          kind: 'audioinput',
          label: 'Microphone 2',
          groupId: 'group2',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      const radioButtons = wrapper.findAll('input[type="radio"]');
      expect(radioButtons).toHaveLength(2);
    });
  });

  describe('Microphone Selection Interaction', () => {
    it('should call selectDevice when a microphone is selected', async () => {
      mockPermissionGranted.value = true;
      mockSelectDevice.mockResolvedValue(undefined);
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group1',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      const radioButton = wrapper.find('input[type="radio"]');
      await radioButton.trigger('change');
      await flushPromises();
      
      expect(mockSelectDevice).toHaveBeenCalledWith('device1');
    });

    it('should display current badge on selected device', async () => {
      mockPermissionGranted.value = true;
      mockSelectedDevice.value = 'device1';
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group1',
          toJSON: () => ({})
        },
        {
          deviceId: 'device2',
          kind: 'audioinput',
          label: 'Microphone 2',
          groupId: 'group2',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.text()).toContain('Current');
    });

    it('should check the radio button for selected device', async () => {
      mockPermissionGranted.value = true;
      mockSelectedDevice.value = 'device1';
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group1',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      const radioButton = wrapper.find('input[type="radio"]');
      expect((radioButton.element as HTMLInputElement).checked).toBe(true);
    });

    it('should display current selection section when device is selected', async () => {
      mockPermissionGranted.value = true;
      mockSelectedDevice.value = 'device1';
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Built-in Microphone',
          groupId: 'group1',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      expect(wrapper.find('.current-selection').exists()).toBe(true);
      expect(wrapper.text()).toContain('Current Selection');
      expect(wrapper.text()).toContain('Built-in Microphone');
    });

    it('should display error message when device selection fails', async () => {
      mockPermissionGranted.value = true;
      mockSelectDevice.mockRejectedValue(new Error('Device selection failed'));
      
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'device1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group1',
          toJSON: () => ({})
        }
      ];
      
      mockAvailableDevices.value = mockDevices;
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      const radioButton = wrapper.find('input[type="radio"]');
      await radioButton.trigger('change');
      await flushPromises();
      
      expect(wrapper.text()).toContain('Device selection failed');
    });
  });

  describe('Refresh Devices Functionality', () => {
    it('should display refresh devices button when permission is granted', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      const buttons = wrapper.findAll('button');
      const refreshButton = buttons.find(btn => btn.text().includes('Refresh Devices'));
      
      expect(refreshButton).toBeDefined();
    });

    it('should call enumerateDevices when refresh button is clicked', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      // Clear the initial call from onMounted
      mockEnumerateDevices.mockClear();
      
      const buttons = wrapper.findAll('button');
      const refreshButton = buttons.find(btn => btn.text().includes('Refresh Devices'));
      
      await refreshButton?.trigger('click');
      await flushPromises();
      
      expect(mockEnumerateDevices).toHaveBeenCalledOnce();
    });

    it('should disable refresh button while refreshing', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      // Clear the initial call
      mockEnumerateDevices.mockClear();
      
      // Set up a delayed promise
      let resolveEnumerate: () => void;
      const enumeratePromise = new Promise<MediaDeviceInfo[]>((resolve) => {
        resolveEnumerate = () => resolve([]);
      });
      mockEnumerateDevices.mockReturnValue(enumeratePromise);
      
      const buttons = wrapper.findAll('button');
      const refreshButton = buttons.find(btn => btn.text().includes('Refresh Devices'));
      
      expect(refreshButton).toBeDefined();
      
      // Trigger the click (don't await yet)
      refreshButton!.trigger('click');
      await wrapper.vm.$nextTick();
      
      // Check that button shows "Refreshing..."
      const updatedButtons = wrapper.findAll('button');
      const refreshingButton = updatedButtons.find(btn => btn.text().includes('Refreshing'));
      expect(refreshingButton).toBeDefined();
      
      // Resolve the promise
      resolveEnumerate!();
      await flushPromises();
      await wrapper.vm.$nextTick();
      
      // Button should show "Refresh Devices" again
      const finalButtons = wrapper.findAll('button');
      const finalRefreshButton = finalButtons.find(btn => btn.text().includes('Refresh Devices'));
      expect(finalRefreshButton).toBeDefined();
    });

    it('should display error message when refresh fails', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      const wrapper = mount(SettingsPage);
      await flushPromises();
      
      // Make the next call fail
      mockEnumerateDevices.mockRejectedValue(new Error('Failed to enumerate devices'));
      
      const buttons = wrapper.findAll('button');
      const refreshButton = buttons.find(btn => btn.text().includes('Refresh Devices'));
      
      await refreshButton?.trigger('click');
      await flushPromises();
      
      expect(wrapper.text()).toContain('Failed to enumerate devices');
    });

    it('should automatically enumerate devices on mount when permission is granted', async () => {
      mockPermissionGranted.value = true;
      mockEnumerateDevices.mockResolvedValue([]);
      
      mount(SettingsPage);
      await flushPromises();
      
      expect(mockEnumerateDevices).toHaveBeenCalled();
    });
  });
});
