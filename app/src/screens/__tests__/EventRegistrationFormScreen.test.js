/* eslint-disable import/first */

jest.mock('@expo/vector-icons', () => {
    const React = require('react');

    return {
        Ionicons: () => React.createElement('Icon'),
        MaterialIcons: () => React.createElement('Icon'),
        FontAwesome: () => React.createElement('Icon'),
    };
});

jest.mock('expo-font', () => ({
    isLoaded: jest.fn(() => true),
    loadAsync: jest.fn(),
}));

jest.mock('../../components/ScreenWrapper', () => {
    const PropTypes = require('prop-types');
    const { View } = require('react-native');

    function MockScreenWrapper({ children }) {
        return <View>{children}</View>;
    }

    MockScreenWrapper.propTypes = {
        children: PropTypes.node,
    };

    MockScreenWrapper.displayName = 'MockScreenWrapper';

    return MockScreenWrapper;
});

jest.mock('react-native-confetti-cannon', () => 'ConfettiCannon');

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('../../lib/notificationService', () => ({
    scheduleEventReminder: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    increment: jest.fn(),
    getDoc: jest.fn(() =>
        Promise.resolve({
            exists: () => true,
            data: () => ({}),
        }),
    ),
    arrayUnion: jest.fn(),
    runTransaction: jest.fn(),
}));

jest.mock('../../lib/firebaseConfig', () => ({
    db: {},
}));

jest.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        user: {
            uid: '123',
        },
    }),
}));

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                text: '#000',
                primary: '#000',
                textSecondary: '#666',
                surface: '#fff',
                border: '#ddd',
            },
        },
    }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import EventRegistrationFormScreen from '../EventRegistrationFormScreen';

describe('EventRegistrationFormScreen', () => {
    it('renders registration screen', () => {
        const route = {
            params: {
                event: {
                    id: 'event-1',
                    title: 'Test Event',
                    customFormSchema: [],
                },
            },
        };

        const navigation = {
            navigate: jest.fn(),
            goBack: jest.fn(),
            popToTop: jest.fn(),
        };

        const { getByText } = render(
            <EventRegistrationFormScreen navigation={navigation} route={route} />,
        );

        expect(getByText('Registration')).toBeTruthy();
        expect(getByText('Test Event')).toBeTruthy();
    });
});
