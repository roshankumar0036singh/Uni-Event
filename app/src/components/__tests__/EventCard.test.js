import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import EventCard from '../EventCard';

const mockNavigate = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}));

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { Text } = require('react-native');

    const MockIcon = ({ name }) => React.createElement(Text, null, name);
    MockIcon.propTypes = {
        name: PropTypes.string,
    };

    return {
        Ionicons: MockIcon,
    };
});

jest.mock('expo-linear-gradient', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { View } = require('react-native');

    const LinearGradient = ({ children, style }) => React.createElement(View, { style }, children);

    LinearGradient.propTypes = {
        children: PropTypes.node,
        style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    };

    return {
        LinearGradient,
    };
});

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    updateDoc: mockUpdateDoc,
    where: jest.fn(),
}));

jest.mock('../../lib/firebaseConfig', () => ({
    db: {},
}));

jest.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        user: {
            uid: 'user-1',
            displayName: 'Test User',
        },
    }),
}));

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                background: '#ffffff',
                border: '#dddddd',
                error: '#dc2626',
                primary: '#2563eb',
                secondary: '#16a34a',
                success: '#15803d',
                surface: '#ffffff',
                text: '#111111',
                textSecondary: '#555555',
            },
            shadows: {
                default: {},
                small: {},
            },
        },
    }),
}));

jest.mock('../../lib/notificationService', () => ({
    triggerBuddyMatchNotification: jest.fn(),
}));

jest.mock('../SkeletonLoader', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { View } = require('react-native');

    const ShimmerItem = ({ style }) => React.createElement(View, { style });

    ShimmerItem.propTypes = {
        style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    };

    return {
        ShimmerItem,
    };
});

const paidEvent = {
    id: 'paid-event-1',
    bannerUrl: 'https://example.com/banner.png',
    category: 'Tech',
    detailImageUrl: 'https://example.com/detail.png',
    endAt: '2099-01-01T12:00:00.000Z',
    eventMode: 'offline',
    isPaid: true,
    location: 'Auditorium',
    organization: 'CS Club',
    price: 499,
    startAt: '2099-01-01T10:00:00.000Z',
    title: 'Paid Workshop',
};

describe('EventCard registration', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('routes register presses to the authoritative event detail flow', () => {
        const { getByTestId } = render(<EventCard event={paidEvent} />);

        fireEvent.press(getByTestId('event-card-register-button'));
        fireEvent.press(getByTestId('event-card-register-button'));

        expect(mockNavigate).toHaveBeenCalledWith('EventDetail', {
            eventId: 'paid-event-1',
        });
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
});
