typescript
import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';

// ---- Types ----
/**
 * Performance tier used to adapt visual effects.
 * - `low`: minimal blur for older devices
 * - `medium`: moderate blur for mid-range devices
 * - `high`: full blur for high-end devices
 */
export type PerformanceLevel = 'low' | 'medium' | 'high';

/**
 * Normalised device capability scores (0‑1) for performance estimation.
 */
interface DeviceCapability {
  /** Memory capacity score based on total RAM in GB (0‑1). */
  memoryScore: number;
  /** CPU capability score based on the device generation and platform (0‑1). */
  cpuScore: number;
  /** OS version recency score (0‑1). */
  osVersionScore: number;
  /** Platform performance advantage score (iOS > Android > web) (0‑1). */
  platformScore: number;
}

/** Props for the {@link GlassOverlay} component. */
export interface GlassOverlayProps {
  /** Content to be displayed on top of the frosted glass background. */
  children: React.ReactNode;
  /**
   * Optional override for blur intensity (0‑100).
   * If not provided, the intensity is automatically determined based on device performance.
   */
  intensity?: number;
  /**
   * Optional tint style passed to `BlurView`.
   * @default "light"
   */
  tint?: BlurTint;
  /**
   * Additional styles to apply to the container view.
   */
  style?: object;
}

/** Allowed tint values for `BlurView` (from expo-blur). */
type BlurTint = 'light' | 'dark' | 'default' | 'regular' | 'prominent' | 'extraLight' | 'systemThickMaterial'  | 'systemThinMaterial' | 'systemUltraThinMaterial' | 'systemChromeMaterial' | 'systemChromeMaterialLight' | 'systemChromeMaterialDark';

// ---- Constants ----

/** Mapping from performance level to recommended blur intensity. */
const BLUR_INTENSITY_MAP: Record<PerformanceLevel, number> = {
  low: 6,
  medium: 15,
  high: 25,
};

/** Default blur intensity used when detection fails. */
const DEFAULT_BLUR_INTENSITY = 20;

/** Cached performance level to avoid re‑computing every render. */
let cachedLevel: PerformanceLevel | null = null;

/** Cached blur intensity to avoid re‑computing. */
let cachedIntensity: number | null = null;

// ---- Helper Functions ----

/**
 * Normalise a semantic version string to a numeric score (0‑1).
 * Accepts numbers, strings like "14.5.1", or null/undefined.
 *
 * @param version - OS version from device data.
 * @returns Score between 0 and 1.
 */
function osVersionToScore(version: number | string | null | undefined): number {
  if (version == null) return 0.5;
  const num = typeof version === 'string' ? parseFloat(version) : version;
  if (isNaN(num)) return 0.5;
  // Maps range 5–17 to 0–1 (iOS 5+ / Android 5+).
  return Math.min(1, Math.max(0, (num - 5) / 12));
}

/**
 * Convert memory in bytes to a normalised score (0‑1).
 * **Note:** A null or zero value results in a conservative score of 0.2,
 * preventing overestimation of capability on devices without memory data.
 *
 * @param bytes - Total device memory in bytes.
 * @returns Score between 0 and 1.
 */
function memoryToScore(bytes: number | null | undefined): number {
  if (bytes == null || bytes <= 0) return 0.2; // conservative default (was 0.4)
  const gb = bytes / (1024 * 1024 * 1024);
  return Math.min(1, Math.max(0, gb / 12));
}

/**
 * Estimate CPU capability based on platform and OS version.
 * Instead of incorrectly using `deviceYearClass` as core count (which always produced max score),
 * this uses a proxy: devices with newer OS versions are assumed to have better CPU performance.
 *
 * @returns Score between 0 and 1.
 */
function cpuScore(): number {
  // iOS devices with recent OS (e.g., iOS 16+) likely have faster chips.
  // Android devices similarly.
  const versionScore = osVersionToScore(Device.osVersion ?? Platform.Version);
  const platformBonus = Platform.OS === 'ios' ? 0.15 : Platform.OS === 'android' ? 0.1 : 0;
  return Math.min(1, Math.max(0, versionScore * 0.7 + platformBonus));
}

/**
 * Convert platform identifier to a performance score.
 * iOS tends to handle `BlurView` more efficiently.
 *
 * @returns Score between 0 and 1.
 */
function platformToScore(): number {
  switch (Platform.OS) {
    case 'ios':
      return 0.9;
    case 'android':
      return 0.7;
    case 'web':
      return 0.5;
    default:
      return 0.6;
  }
}

/**
 * Assemble device capability scores from available information.
 * All returned scores are in the range [0, 1].
 *
 * @returns A {@link DeviceCapability} object.
 */
function getCapability(): DeviceCapability {
  const osVersion = Device.osVersion ?? Platform.Version;
  const memory = Device.totalMemory;

  return {
    memoryScore: memoryToScore(memory),
    cpuScore: cpuScore(), // fixed: no longer uses deviceYearClass
    osVersionScore: osVersionToScore(osVersion),
    platformScore: platformToScore(),
  };
}

/**
 * Compute a single performance level from the capability scores.
 * Uses weighted combination.
 *
 * @param scores - The device capability breakdown.
 * @returns The computed performance level.
 */
function computeLevel(scores: DeviceCapability): PerformanceLevel {
  const combined =
    scores.memoryScore * 0.35 +
    scores.cpuScore * 0.30 +
    scores.osVersionScore * 0.25 +
    scores.platformScore * 0.10;

  if (combined < 0.45) return 'low';
  if (combined > 0.72) return 'high';
  return 'medium';
}

/**
 * Detect device performance level using `expo-device` APIs.
 * Falls back to a simpler OS‑version heuristic if the primary method fails.
 *
 * @returns The estimated device performance tier.
 * @throws {Error} Only if an unexpected system error occurs (rare – caller catches it).
 */
function detectPerformanceLevel(): PerformanceLevel {
  // First, try the robust method using expo-device
  try {
    if (Device && Device.osVersion) {
      const scores = getCapability();
      return computeLevel(scores);
    }
  } catch (error: unknown) {
    // expo-device may fail on some emulators or custom builds – fall through to heuristic
    console.warn(
      '[glassDetection] expo-device API call failed, falling back to OS‑version heuristic.',
      error instanceof Error ? error.message : String(error),
    );
  }

  // Fallback: basic OS‑version heuristic (used when expo-device is missing or throws)
  if (Platform.OS === 'ios') {
    const major = parseInt(String(Platform.Version), 10);
    if (major < 13) return 'low';
    if (major >= 16) return 'high';
    return 'medium';
  }
  // Android
  const sdk = Platform.Version;
  const sdkNum = typeof sdk === 'number' ? sdk : parseInt(String(sdk), 10);
  if (isNaN(sdkNum)) return 'medium';
  if (sdkNum < 23) return 'low';
  if (sdkNum >= 33) return 'high';
  return 'medium';
}

// ---- Public API Functions ----

/**
 * Get the cached or freshly detected device performance level.
 * Results are cached for the lifetime of the app to avoid repeated API calls.
 *
 * @returns The performance tier (`'low'`, `'medium'`, or `'high'`).
 */
export function getDevicePerformanceLevel(): PerformanceLevel {
  if (cachedLevel === null) {
    cachedLevel = detectPerformanceLevel();
    console.info(`[glassPerformance] Detected device performance level: ${cachedLevel}`);
  }
  return cachedLevel;
}

/**
 * Return an appropriate blur intensity (0–100) for use with `BlurView` / `expo-blur`.
 * The intensity adapts to the device’s performance capabilities to avoid lag on older devices.
 *
 * Results are cached after the first call.
 *
 * @returns Blur intensity value (range 6–25).
 * @throws Never throws; falls back to default on error.
 */
export function getBlurIntensity(): number {
  if (cachedIntensity !== null) {
    return cachedIntensity;
  }
  try {
    const level = getDevicePerformanceLevel();
    cachedIntensity = BLUR_INTENSITY_MAP[level] ?? DEFAULT_BLUR_INTENSITY;
    return cachedIntensity;
  } catch (error: unknown) {
    console.error(
      '[glassPerformance] Unexpected error while determining blur intensity. Returning default.',
      error instanceof Error ? error.message : String(error),
    );
    cachedIntensity = DEFAULT_BLUR_INTENSITY;
    return cachedIntensity;
  }
}

// ---- BlurView Component ----

/**
 * A glass‐morphism overlay component that wraps content in a frosted glass effect.
 * Automatically adapts blur intensity based on device performance when no explicit `intensity` is given.
 *
 * @example
 *