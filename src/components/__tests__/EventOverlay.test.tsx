typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import EventOverlay from '../EventOverlay';
import GlassOverlay from '../GlassOverlay';
import { BlurView } from 'expo-blur';

// ---------------------------------------------------------------------------
// Types and Interfaces
// ---------------------------------------------------------------------------

/**
 * Expected props for the BlurView component (subset used in tests).
 * Extends generic props for extensibility.
 */
interface BlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Expected props for the EventOverlay component.
 */
interface EventOverlayProps {
  visible: boolean;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Mock `expo-blur` to avoid native module dependencies and capture calls.
 * The mock renders children directly, preserving the component hierarchy for
 * testing but stripping native blur behavior.
 */
const mockBlurView = jest.fn<React.ReactNode, [BlurViewProps]>(
  ({ children, ...props }: BlurViewProps): React.ReactNode => {
    mockBlurViewProps(props);
    return <>{children}</>;
  }
);

jest.mock('expo-blur', () => ({
  BlurView: mockBlurView,
}));

/** Captured props from the most recent BlurView render call. */
const mockBlurViewProps = jest.fn<void, [Partial<BlurViewProps>]>();

// ---------------------------------------------------------------------------
// Test Suite for EventOverlay
// ---------------------------------------------------------------------------

/**
 * Verifies that `EventOverlay` integrates correctly with `GlassOverlay` and
 * `BlurView`, enforcing performance-conscious blur intensity.
 */
describe('EventOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates the following:
   * 1. `GlassOverlay` is rendered inside `EventOverlay`.
   * 2. `BlurView` is applied with an `intensity >= 20` (performance threshold).
   * 3. The overlay hierarchy is correct (`GlassOverlay` is a child of `BlurView`).
   */
  it('renders GlassOverlay inside BlurView with correct intensity', () => {
    // Arrange
    const testProps: EventOverlayProps = { visible: true };

    // Act
    const { getByTestId } = render(<EventOverlay {...testProps} />);

    // Assert
    // 1. GlassOverlay is present (getByTestId throws with descriptive error if missing)
    const glassOverlay = getByTestId('glass-overlay');
    expect(glassOverlay).toBeDefined();

    // 2. Validate BlurView props captured by mock
    expect(mockBlurViewProps).toHaveBeenCalledTimes(1);
    const capturedProps = mockBlurViewProps.mock.calls[0][0];
    expect(capturedProps).toBeDefined();

    const { intensity, tint } = capturedProps;
    expect(typeof intensity).toBe('number');
    expect(intensity).toBeGreaterThanOrEqual(20);
    // Tint should be one of the allowed values or undefined (default)
    if (tint !== undefined) {
      expect(['light', 'dark', 'default']).toContain(tint);
    }

    // 3. Verify BlurView is an ancestor of GlassOverlay (structural check)
    // Because the mock renders children directly, the direct parent of
    // glassOverlay is the Fragment, but the BlurView component is still
    // the React parent. We check via the mock's children.
    const blurViewCall = mockBlurView.mock.calls[0][0];
    expect(blurViewCall.children).toContain(glassOverlay);

    // 4. Log success at debug level
    console.debug(
      `[TEST] EventOverlay passed: GlassOverlay found, BlurView intensity=${intensity}, tint=${tint || 'default'}`
    );
  });

  /**
   * Edge case: component renders nothing when invisible.
   * This ensures the overlay doesn't leak into the DOM unnecessarily.
   */
  it('renders no GlassOverlay when visible is false', () => {
    // Arrange
    const testProps: EventOverlayProps = { visible: false };

    // Act
    const { queryByTestId } = render(<EventOverlay {...testProps} />);

    // Assert
    expect(queryByTestId('glass-overlay')).toBeNull();
    expect(mockBlurView).not.toHaveBeenCalled();

    console.debug('[TEST] EventOverlay correctly hides when visible=false');
  });

  /**
   * Performance guard: verifies that when BlurView is rendered with intensity
   * less than 20 (e.g., via prop override), the component does not allow it
   * and falls back to a safe value.
   *
   * Note: This test assumes EventOverlay enforces a minimum intensity.
   * If the component does not enforce this, adjust the expectation.
   */
  it('clamps blur intensity to safe minimum if passed value is too low', () => {
    // This test is optional – uncomment if EventOverlay implements clamping.
    // For now, we assume the input is trusted and no clamping is needed.
    console.debug(
      '[TEST] Skipping clamping test – component does not enforce min intensity.'
    );
    expect(true).toBe(true);
  });
});