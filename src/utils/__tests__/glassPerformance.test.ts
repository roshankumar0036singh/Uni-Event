typescript
// __tests__/glassPerformance.test.ts
import { getBlurIntensity, BlurIntensityError, IntensityLevel } from '../glassPerformance';

jest.mock('expo-device', () => ({
  DeviceType: {
    PHONE: 1,
    TABLET: 2,
    DESKTOP: 3,
    TV: 4,
  },
  getDeviceTypeAsync: jest.fn(),
}));

import { DeviceType, getDeviceTypeAsync } from 'expo-device';

// Declare global __DEVICE_MEMORY__ for tests
declare global {
  // eslint-disable-next-line no-var
  var __DEVICE_MEMORY__: number | undefined;
}

describe('glassPerformance utility – getBlurIntensity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).__DEVICE_MEMORY__; // reset global mock
  });

  // -----------------------------------------------------------------------
  // Positive tests – known device types and memory
  // -----------------------------------------------------------------------

  it('returns low intensity (10) for old devices with low memory', async () => {
    getDeviceTypeAsync.mockResolvedValue(DeviceType.PHONE);
    globalThis.__DEVICE_MEMORY__ = 512;

    const intensity = await getBlurIntensity({ deviceType: DeviceType.PHONE, memory: 512 });
    expect(intensity).toBe(IntensityLevel.LOW); // 10
  });

  it('returns high intensity (30) for new devices with high memory', async () => {
    getDeviceTypeAsync.mockResolvedValue(DeviceType.PHONE);
    globalThis.__DEVICE_MEMORY__ = 4096;

    const intensity = await getBlurIntensity({ deviceType: DeviceType.PHONE, memory: 4096 });
    expect(intensity).toBe(IntensityLevel.HIGH);
  });

  it('returns medium intensity (20) for medium devices (tablet, 2GB)', async () => {
    getDeviceTypeAsync.mockResolvedValue(DeviceType.TABLET);
    globalThis.__DEVICE_MEMORY__ = 2048;

    const intensity = await getBlurIntensity({ deviceType: DeviceType.TABLET, memory: 2048 });
    expect(intensity).toBe(IntensityLevel.MEDIUM);
  });

  it('returns high intensity for desktop with any memory', async () => {
    getDeviceTypeAsync.mockResolvedValue(DeviceType.DESKTOP);
    globalThis.__DEVICE_MEMORY__ = 1024; // low, but desktop overrides

    const intensity = await getBlurIntensity({ deviceType: DeviceType.DESKTOP, memory: 1024 });
    // Base for desktop is high, low memory does not reduce below 30 because desktop is assumed capable
    expect(intensity).toBe(IntensityLevel.HIGH);
  });

  // -----------------------------------------------------------------------
  // Edge case – unknown device type
  // -----------------------------------------------------------------------

  it('returns medium intensity for unknown device type', async () => {
    // Use a value not in DeviceType enum (e.g., 99)
    getDeviceTypeAsync.mockResolvedValue(99 as unknown as DeviceType);

    const intensity = await getBlurIntensity({ deviceType: 99 as unknown as DeviceType, memory: 4096 });
    // Unknown type → medium base; high memory should bring it to high? Actually memory adjustment:
    // memory >=4096 and base < HIGH => set to HIGH. But base is MEDIUM, so final = HIGH.
    // However the fallback logic: unknown type gets MEDIUM, then memory >=4096 -> upgrade to HIGH.
    // Let's test exact expected value.
    expect(intensity).toBe(IntensityLevel.HIGH);
  });

  // -----------------------------------------------------------------------
  // Error handling – missing device info (detection fails)
  // -----------------------------------------------------------------------

  it('throws BlurIntensityError when detection fails and no explicit data provided', async () => {
    // Force getDeviceTypeAsync to reject
    getDeviceTypeAsync.mockRejectedValue(new Error('No device info available'));

    // No explicit deviceType or memory → both will be missing and fail
    await expect(getBlurIntensity()).rejects.toThrow(BlurIntensityError);
    await expect(getBlurIntensity()).rejects.toThrow('Blur intensity detection failed');
  });

  it('does not throw when at least one explicit parameter is provided even if detection fails', async () => {
    getDeviceTypeAsync.mockRejectedValue(new Error('No device info'));
    // Provide memory explicitly, device type will be auto-detected and fail, but we have memory
    // The fallback returns MEDIUM intensity.
    const intensity = await getBlurIntensity({ memory: 2048 });
    expect(intensity).toBe(IntensityLevel.MEDIUM);
  });

  // -----------------------------------------------------------------------
  // Validation – invalid input
  // -----------------------------------------------------------------------

  it('throws error for negative memory', async () => {
    await expect(getBlurIntensity({ deviceType: DeviceType.PHONE, memory: -100 })).rejects.toThrow(
      'Invalid memory value: -100. Must be a non‑negative number.'
    );
  });

  it('throws error for invalid device type', async () => {
    await expect(getBlurIntensity({ deviceType: 999 as DeviceType, memory: 2048 })).rejects.toThrow(
      'Invalid device type: 999. Must be a DeviceType enum value.'
    );
  });

  // -----------------------------------------------------------------------
  // Auto-detection without explicit parameters (using global mock)
  // -----------------------------------------------------------------------

  it('auto-detects device type and memory when not provided', async () => {
    getDeviceTypeAsync.mockResolvedValue(DeviceType.PHONE);
    globalThis.__DEVICE_MEMORY__ = 3072; // between 2048 and 4096

    const intensity = await getBlurIntensity(); // no options
    // PHONE base = MEDIUM (20), memory 3072 >=2048 && <4096 → no upgrade, stays 20
    expect(intensity).toBe(IntensityLevel.MEDIUM);
  });

  // -----------------------------------------------------------------------
  // Performance: ensure function returns quickly under normal conditions
  // -----------------------------------------------------------------------

  it('resolves within a reasonable time (sync path)', async () => {
    getDeviceTypeAsync.mockResolvedValue(DeviceType.TABLET);
    globalThis.__DEVICE_MEMORY__ = 2048;

    const start = Date.now();
    const intensity = await getBlurIntensity({ deviceType: DeviceType.TABLET, memory: 2048 });
    const elapsed = Date.now() - start;

    expect(intensity).toBe(IntensityLevel.MEDIUM);
    // Should be nearly instant (async but no real delay)
    expect(elapsed).toBeLessThan(100);
  });
});