import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { BlurView, BlurTint } from 'expo-blur';

interface GlassOverlayProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: BlurTint;
  blurReductionFactor?: number;
  style?: ViewStyle;
}

/**
 * GlassOverlay - A reusable frosted glass overlay component using expo-blur's BlurView.
 * 
 * @param children - Content to render over the blurred background.
 * @param intensity - Blur intensity (1-100), default 50.
 * @param tint - Blur tint ('dark', 'light', 'default'), default 'dark'.
 * @param blurReductionFactor - Multiplier for intensity to reduce blur on low-end devices, default 1.
 * @param style - Additional styles for the container.
 */
const GlassOverlay: React.FC<GlassOverlayProps> = ({
  children,
  intensity = 50,
  tint = 'dark',
  blurReductionFactor = 1,
  style,
}) => {
  // Apply blur reduction factor while ensuring intensity stays within valid range
  const adjustedIntensity = Math.max(1, Math.min(100, intensity * blurReductionFactor));

  // Log warning if adjusted intensity differs significantly
  if (adjustedIntensity !== intensity && __DEV__) {
    console.warn(
      `[GlassOverlay] Blur intensity adjusted: ${intensity} -> ${adjustedIntensity} (factor: ${blurReductionFactor})`
    );
  }

  return (
    <BlurView
      intensity={adjustedIntensity}
      tint={tint}
      style={[styles.container, style]}
    >
      {children}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GlassOverlay;