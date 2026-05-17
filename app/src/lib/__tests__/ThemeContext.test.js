import React from 'react';

import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '../ThemeContext';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text, TouchableOpacity } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

const TestComponent = () => {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <>
            <Text testID="theme-mode">{isDarkMode ? 'dark' : 'light'}</Text>

            <TouchableOpacity testID="toggle-btn" onPress={toggleTheme}>
                <Text>Toggle</Text>
            </TouchableOpacity>
        </>
    );
};

describe('ThemeContext', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});

        AsyncStorage.getItem.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders with default light theme', async () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        await waitFor(() => {
            expect(getByTestId('theme-mode').props.children).toBe('light');
        });
    });

    test('loads saved dark theme preference', async () => {
        AsyncStorage.getItem.mockResolvedValueOnce('dark');

        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        await waitFor(() => {
            expect(getByTestId('theme-mode').props.children).toBe('dark');
        });
    });

    test('toggles theme successfully', async () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        const button = await waitFor(() => getByTestId('toggle-btn'));

        fireEvent.press(button);

        await waitFor(() => {
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });
    });

    test('handles storage load failure', async () => {
        AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage failed'));

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>,
        );

        await waitFor(() => {
            expect(console.log).toHaveBeenCalled();
        });
    });
});
