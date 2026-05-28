import logger from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Platform, useColorScheme, Animated } from 'react-native';
import { darkTheme, lightTheme } from './theme';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');
    const [theme, setTheme] = useState(systemScheme === 'dark' ? darkTheme : lightTheme);
    const [loading, setLoading] = useState(true);

    // Context states initialized to fix 'not defined' errors
    const [textScale, setTextScale] = useState(1);
    const [isHighContrast, setIsHighContrast] = useState(false);

    // Animated value for smooth color transitions (0 = light, 1 = dark)
    const themeAnimationProgress = useMemo(
        () => new Animated.Value(systemScheme === 'dark' ? 1 : 0),
        [systemScheme],
    );

    useEffect(() => {
        loadPersistedSettings();
    }, []);

    useEffect(() => {
        setTheme(isDarkMode ? darkTheme : lightTheme);

        Animated.timing(themeAnimationProgress, {
            toValue: isDarkMode ? 1 : 0,
            duration: 500,
            useNativeDriver: false,
        }).start();

        if (Platform.OS === 'web') {
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) {
                meta.setAttribute('content', isDarkMode ? '#000000' : '#ffffff');
            }
        }
    }, [isDarkMode, themeAnimationProgress]);

    const loadPersistedSettings = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem('themePreference');
            const storedScale = await AsyncStorage.getItem('textScalePreference');
            const storedContrast = await AsyncStorage.getItem('highContrastPreference');

            if (storedTheme) setIsDarkMode(storedTheme === 'dark');
            if (storedScale) setTextScale(parseFloat(storedScale));
            if (storedContrast) setIsHighContrast(storedContrast === 'true');
        } catch (e) {
            logger.debug('Failed to load theme preferences', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = useCallback(async () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        try {
            await AsyncStorage.setItem('themePreference', newMode ? 'dark' : 'light');
        } catch (e) {
            logger.debug('Failed to save theme preference', e);
        }
    }, [isDarkMode]);

    const updateTextScale = useCallback(async scale => {
        setTextScale(scale);
        try {
            await AsyncStorage.setItem('textScalePreference', scale.toString());
        } catch (e) {
            logger.debug('Failed to save text scale', e);
        }
    }, []);

    const toggleHighContrast = useCallback(async () => {
        const newContrast = !isHighContrast;
        setIsHighContrast(newContrast);
        try {
            await AsyncStorage.setItem('highContrastPreference', newContrast ? 'true' : 'false');
        } catch (e) {
            logger.debug('Failed to save high contrast status', e);
        }
    }, [isHighContrast]);

    const interpolateThemeColor = useCallback(
        (lightColor, darkColor) => {
            return themeAnimationProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [lightColor, darkColor],
            });
        },
        [themeAnimationProgress],
    );

    const value = useMemo(
        () => ({
            theme,
            isDarkMode,
            toggleTheme,
            textScale,
            updateTextScale,
            isHighContrast,
            toggleHighContrast,
            themeAnimationProgress,
            interpolateThemeColor,
        }),
        [
            theme,
            isDarkMode,
            toggleTheme,
            textScale,
            updateTextScale,
            isHighContrast,
            toggleHighContrast,
            themeAnimationProgress,
            interpolateThemeColor,
        ],
    );

    if (loading) return null;

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

ThemeProvider.propTypes = {
    children: PropTypes.any,
};
