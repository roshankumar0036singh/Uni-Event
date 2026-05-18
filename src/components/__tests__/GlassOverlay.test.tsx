tsx
import React from 'react';
import { Text, View } from 'react-native';
import { render, RenderAPI } from '@testing-library/react-native';
import GlassOverlay from '../GlassOverlay';

// ---------------------------------------------------------------------------
// Mock expo-blur with a simple View to avoid native module dependency
// ---------------------------------------------------------------------------
jest.mock('expo-blur', () => ({
  BlurView: jest.fn(({ children, ...rest }: Record<string, unknown>) => (
    <View {...rest}>{children}</View>
  )),
}));

import { BlurView } from 'expo-blur';

// ---------------------------------------------------------------------------
// Type-safe access to the mocked BlurView
// ---------------------------------------------------------------------------
const MockedBlurView = BlurView as jest.MockedFunction<typeof BlurView>;

describe('GlassOverlay', () => {
  // Spy on console.warn to capture performance warnings
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Helper: render the overlay and return the first BlurView call arguments
  // ---------------------------------------------------------------------------
  const getBlurViewCallProps = (): Record<string, unknown> | null => {
    if (MockedBlurView.mock.calls.length === 0) return null;
    return MockedBlurView.mock.calls[0][0] as Record<string, unknown>;
  };

  // ---------------------------------------------------------------------------
  // Basic rendering tests
  // ---------------------------------------------------------------------------

  /**
   * Verify that a default GlassOverlay renders BlurView with a numeric intensity.
   */
  it('renders BlurView with default intensity', () => {
    render(
      <GlassOverlay>
        <Text>Content</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props).toBeDefined();
    expect(props!.intensity).toEqual(expect.any(Number));
  });

  /**
   * Ensure custom intensity is forwarded to BlurView.
   */
  it('passes custom intensity props to BlurView', () => {
    render(
      <GlassOverlay intensity={85}>
        <Text>Custom</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props).toBeDefined();
    expect(props!.intensity).toBe(85);
  });

  /**
   * Verify that children are rendered inside the overlay.
   */
  it('renders children inside the overlay', () => {
    const { getByText }: RenderAPI = render(
      <GlassOverlay>
        <Text>Child Element</Text>
      </GlassOverlay>,
    );
    expect(getByText('Child Element')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // blurReductionFactor tests (missing coverage)
  // ---------------------------------------------------------------------------

  /**
   * When blurReductionFactor is provided (< 1), intensity should be reduced.
   */
  it('applies blur reduction factor to intensity when factor < 1', () => {
    render(
      <GlassOverlay intensity={100} blurReductionFactor={0.5}>
        <Text>Reduced</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props).toBeDefined();
    // Expect intensity to be multiplied: 100 * 0.5 = 50
    expect(props!.intensity).toBe(50);
  });

  /**
   * When blurReductionFactor is exactly 1, intensity should stay the same.
   */
  it('applies no reduction when blurReductionFactor is 1', () => {
    render(
      <GlassOverlay intensity={75} blurReductionFactor={1}>
        <Text>No reduction</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props).toBeDefined();
    expect(props!.intensity).toBe(75);
  });

  /**
   * When blurReductionFactor > 1, intensity should increase (edge case).
   */
  it('applies factor > 1 to increase intensity', () => {
    render(
      <GlassOverlay intensity={50} blurReductionFactor={2}>
        <Text>Increased</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props).toBeDefined();
    expect(props!.intensity).toBe(100);
  });

  // ---------------------------------------------------------------------------
  // Warning logging tests (missing coverage)
  // ---------------------------------------------------------------------------

  /**
   * When intensity is adjusted (e.g., due to blurReductionFactor),
   * a warning should be logged to help developers debug performance.
   */
  it('logs a warning when intensity is adjusted via blurReductionFactor', () => {
    render(
      <GlassOverlay intensity={80} blurReductionFactor={0.3}>
        <Text>Warning check</Text>
      </GlassOverlay>,
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('blurReductionFactor'),
    );
  });

  /**
   * When no reduction factor is given, no warning should appear.
   */
  it('does not log warning when no blurReductionFactor is used', () => {
    render(
      <GlassOverlay intensity={50}>
        <Text>No warning</Text>
      </GlassOverlay>,
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });

  /**
   * When intensity is within normal range and no reduction, no warning.
   */
  it('does not log warning with default intensity and no factor', () => {
    render(
      <GlassOverlay>
        <Text>Default</Text>
      </GlassOverlay>,
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Edge cases – input validation & security
  // ---------------------------------------------------------------------------

  /**
   * Negative intensity values should be clamped or ignored.
   */
  it('clamps negative intensity to default', () => {
    render(
      <GlassOverlay intensity={-10}>
        <Text>Negative intensity</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props!.intensity).toBeGreaterThanOrEqual(0);
  });

  /**
   * Very large intensity values should be capped.
   */
  it('caps intensity to a maximum reasonable value', () => {
    render(
      <GlassOverlay intensity={999}>
        <Text>High intensity</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props!.intensity).toBeLessThanOrEqual(100); // or a defined max
  });

  /**
   * Non-numeric intensity should fall back to default and log a warning.
   */
  it('falls back to default intensity for non-numeric value', () => {
    render(
      // @ts-expect-error – deliberately passing wrong type
      <GlassOverlay intensity="abc">
        <Text>String intensity</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    expect(props!.intensity).toEqual(expect.any(Number));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/invalid intensity/i),
    );
  });

  /**
   * blurReductionFactor of zero should not cause division by zero or crash.
   */
  it('handles blurReductionFactor of zero gracefully', () => {
    render(
      <GlassOverlay intensity={60} blurReductionFactor={0}>
        <Text>Zero factor</Text>
      </GlassOverlay>,
    );

    const props = getBlurViewCallProps();
    // Should result in zero intensity or fallback – component specific
    expect(props!.intensity).toBeDefined();
    expect(isNaN(props!.intensity as number)).toBe(false);
  });

  /**
   * undefiend/ null props should not crash.
   */
  it('renders without crashing when props are undefined/null', () => {
    expect(() =>
      render(
        // @ts-expect-error – intentionally missing required props
        <GlassOverlay intensity={undefined} blurReductionFactor={null}>
          <Text>Edge</Text>
        </GlassOverlay>,
      ),
    ).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Performance helper (optional – ensures BlurView is not re‑rendered
  // unnecessarily if props remain the same)
  // ---------------------------------------------------------------------------

  /**
   * BlurView should receive stable props when no changes occur (memoised).
   */
  it('does not re‑render BlurView when props are identical', () => {
    const { rerender } = render(
      <GlassOverlay intensity={50}>
        <Text>Stable</Text>
      </GlassOverlay>,
    );

    rerender(
      <GlassOverlay intensity={50}>
        <Text>Stable</Text>
      </GlassOverlay>,
    );

    // BlurView should only have been called once (first render)
    expect(MockedBlurView).toHaveBeenCalledTimes(1);
  });
});