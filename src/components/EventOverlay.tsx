typescript
import React, { ReactNode, useMemo } from 'react';
import { Modal, StyleSheet, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Device } from 'expo-device';

// ---------------------------------------------------------------------------
// Logging utility (replace with a real logger in production)
// ---------------------------------------------------------------------------
const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.debug('[EventOverlay]', ...args);
  },
  warn: (...args: unknown[]) => console.warn('[EventOverlay]', ...args),
  error: (...args: unknown[]) => console.error('[EventOverlay]', ...args),
};

// ---------------------------------------------------------------------------
// Import the shared GlassOverlay component (must exist in codebase)
// ---------------------------------------------------------------------------
import { GlassOverlay } from '../components/GlassOverlay';

// ---------------------------------------------------------------------------
// Import performance heuristics from the shared module
// ---------------------------------------------------------------------------
import {
  getBlurReductionFactor,
  defaultBlurIntensity,
} from '../utils/glassPerformance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EventOverlayProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Override base blur intensity (before reduction factor). */
  intensity?: number;
  /** 'light' | 'dark' | 'default' */
  tint?: 'light' | 'dark' | 'default';
  /**
   * Optional custom reduction factor (0.0–1.0). Overrides the automatic
   * device‑based reduction if provided.
   */
  blurReductionFactor?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MIN_INTENSITY = 1;
const MAX_INTENSITY = 100;
const DEFAULT_TINT: 'default' = 'default';

// ---------------------------------------------------------------------------
// Helper: calculate final blur intensity with safety & performance checks
// ---------------------------------------------------------------------------
function calculateBlurIntensity(
  intensity?: number,
  blurReductionFactor?: number,
): number {
  try {
    // 1. Validate base intensity
    let baseIntensity = intensity ?? defaultBlurIntensity;
    if (typeof baseIntensity !== 'number' || isNaN(baseIntensity)) {
      logger.warn(`Invalid intensity (${baseIntensity}), falling back to ${defaultBlurIntensity}`);
      baseIntensity = defaultBlurIntensity;
    }
    baseIntensity = Math.max(MIN_INTENSITY, Math.min(MAX_INTENSITY, baseIntensity));

    // 2. Determine reduction factor
    let reduction: number;
    if (blurReductionFactor !== undefined) {
      if (typeof blurReductionFactor !== 'number' || isNaN(blurReductionFactor)) {
        logger.warn(`Invalid blurReductionFactor (${blurReductionFactor}), using automatic`);
        reduction = getBlurReductionFactor();
      } else {
        reduction = Math.max(0, Math.min(1, blurReductionFactor));
      }
    } else {
      reduction = getBlurReductionFactor();
    }

    // 3. Apply reduction and ensure integer
    const finalIntensity = Math.round(baseIntensity * reduction);
    logger.debug(
      `Intensity: base=${baseIntensity}, reduction=${reduction}, final=${finalIntensity}`,
    );
    return finalIntensity;
  } catch (error) {
    logger.error('Failed to calculate blur intensity, using safe default', error);
    return 20;
  }
}

// ---------------------------------------------------------------------------
// EventOverlay component
// ---------------------------------------------------------------------------
const EventOverlay: React.FC<EventOverlayProps> = ({
  visible,
  onClose,
  children,
  intensity,
  tint = DEFAULT_TINT,
  blurReductionFactor,
}) => {
  // Validate onClose
  const validatedOnClose = useMemo(() => {
    if (typeof onClose !== 'function') {
      logger.warn('onClose prop is not a function – overlay will not be closable');
      return () => {};
    }
    return onClose;
  }, [onClose]);

  // Ensure children exist for accessibility
  const validatedChildren = useMemo(() => {
    if (!children) {
      logger.warn('No children provided – overlay will render empty');
      return null;
    }
    return children;
  }, [children]);

  // Memoize final blur intensity
  const finalIntensity = useMemo(
    () => calculateBlurIntensity(intensity, blurReductionFactor),
    [intensity, blurReductionFactor],
  );

  // Validate tint (catch invalid values)
  const validatedTint = useMemo(() => {
    const validTints: Array<'light' | 'dark' | 'default'> = ['light', 'dark', 'default'];
    if (tint && validTints.includes(tint)) return tint;
    logger.warn(`Invalid tint "${tint}", falling back to "default"`);
    return 'default' as const;
  }, [tint]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={validatedOnClose}
      statusBarTranslucent
      hardwareAccelerated={Platform.OS === 'android'}
    >
      <GlassOverlay
        intensity={finalIntensity}
        tint={validatedTint}
        // Prevent accidental dismiss by ignoring touches on the BlurView itself
        // (proper dismiss should be handled via close button or backdrop)
      >
        <View style={styles.glassContent}>
          {validatedChildren}
        </View>
      </GlassOverlay>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles (small, clean, no direct glass effect – that's in GlassOverlay)
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  glassContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 24,
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Elevation (Android)
    elevation: 8,
  },
});

export default EventOverlay;