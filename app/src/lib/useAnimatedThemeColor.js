import { useMemo } from 'react';
import { useTheme } from './ThemeContext';

/**
 * Hook to create animated color styles that smoothly transition between light and dark themes
 * @param {string} lightColor - Color for light mode
 * @param {string} darkColor - Color for dark mode
 * @returns {Animated.Value} Interpolated animated value
 */
export const useAnimatedThemeColor = (lightColor, darkColor) => {
    const { interpolateThemeColor } = useTheme();
    return useMemo(() => interpolateThemeColor(lightColor, darkColor), [
        lightColor,
        darkColor,
        interpolateThemeColor,
    ]);
};

/**
 * Hook to create animated text color that transitions smoothly
 * @param {string} lightColor - Text color for light mode
 * @param {string} darkColor - Text color for dark mode
 * @returns {object} Style object with animated color
 */
export const useAnimatedTextColor = (lightColor, darkColor) => {
    const animatedColor = useAnimatedThemeColor(lightColor, darkColor);
    return useMemo(() => ({ color: animatedColor }), [animatedColor]);
};

/**
 * Hook to create animated background color that transitions smoothly
 * @param {string} lightColor - Background color for light mode
 * @param {string} darkColor - Background color for dark mode
 * @returns {object} Style object with animated backgroundColor
 */
export const useAnimatedBackgroundColor = (lightColor, darkColor) => {
    const animatedColor = useAnimatedThemeColor(lightColor, darkColor);
    return useMemo(() => ({ backgroundColor: animatedColor }), [animatedColor]);
};

