import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { darkTheme, lightTheme } from './theme';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');
    const [theme, setTheme] = useState(systemScheme === 'dark' ? darkTheme : lightTheme);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadThemePreference();
    }, []);

    useEffect(() => {
        setTheme(isDarkMode ? darkTheme : lightTheme);
        if (Platform.OS === 'web') {
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) {
                meta.setAttribute('content', isDarkMode ? '#000000' : '#ffffff');
            }
        }
    }, [isDarkMode]);

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

    const toggleTheme = async () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        try {
            await AsyncStorage.setItem('themePreference', newMode ? 'dark' : 'light');
        } catch (e) {
            console.log('Failed to save theme preference', e);
        }
    };

    if (loading) return null;

    return (
        <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

ThemeProvider.propTypes = {
    children: PropTypes.any,
};
