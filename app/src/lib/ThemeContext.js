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

    // Declared states to fix the 'not defined' lint errors
    const [textScale, setTextScale] = useState(1);
    const [isHighContrast, setIsHighContrast] = useState(false);
    
    // Animated value for smooth color transitions (0 = light, 1 = dark)
    const themeAnimationProgress = useMemo(() => new Animated.Value(systemScheme === 'dark' ? 1 : 0), []);

    useEffect(() => {
        loadThemePreference();
    }, []);

    useEffect(() => {
        setTheme(isDarkMode ? darkTheme : lightTheme);
        
        // Animated the transition 500ms for a smoother feel
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

    const loadThemePreference = async () => {
        try {
            const stored = await AsyncStorage.getItem('themePreference');
            if (stored) {
                setIsDarkMode(stored === 'dark');
            }
        } catch (e) {
            console.log('Failed to load theme preference', e);
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
            console.log('Failed to save theme preference', e);
        }
    }, [isDarkMode]);

    const interpolateThemeColor = useCallback((lightColor, darkColor) => {
        return themeAnimationProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [lightColor, darkColor],
        });
    }, [themeAnimationProgress]);

    const value = useMemo(
        () => ({
            theme,
            isDarkMode,
            toggleTheme,
            textScale,          // 👈 Added
            updateTextScale,    // 👈 Added
            isHighContrast,     // 👈 Added
            toggleHighContrast, // 👈 Added
            themeAnimationProgress,
            interpolateThemeColor,
        }),
        [theme, 
         isDarkMode,
         toggleTheme,
         textScale,          // 👈 Added
         updateTextScale,    // 👈 Added
         isHighContrast,     // 👈 Added
         toggleHighContrast, // 👈 Added 
         themeAnimationProgress, interpolateThemeColor]
    );

    if (loading) return null;

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

ThemeProvider.propTypes = {
    children: PropTypes.any,
};
