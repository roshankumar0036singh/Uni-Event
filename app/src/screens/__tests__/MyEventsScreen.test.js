import React from 'react';

import { render, waitFor } from '@testing-library/react-native';

import MyEventsScreen from '../MyEventsScreen';

const unsubscribeMock = jest.fn();
const mockOnSnapshot = jest.fn(() => {
    return unsubscribeMock;
});

let mockIsFocused = true;

jest.mock('@react-navigation/native', () => ({
    useIsFocused: jest.fn(() => mockIsFocused),
}));

jest.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'user-1' },
    }),
}));

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                primary: '#0f62fe',
                surface: '#ffffff',
                border: '#d0d0d0',
                text: '#111111',
                error: '#da1e28',
                success: '#24a148',
                textSecondary: '#666666',
            },
        },
    }),
}));

jest.mock('../../lib/firebaseConfig', () => ({
    db: {},
}));

jest.mock('../../components/ScreenWrapper', () => {
    const { View } = require('react-native');
    const PropTypes = require('prop-types');

    function MockScreenWrapper({ children }) {
        return <View>{children}</View>;
    }

    MockScreenWrapper.propTypes = {
        children: PropTypes.node,
    };

    return MockScreenWrapper;
});

jest.mock('../../components/EventCard', () => {
    const { View } = require('react-native');

    function MockEventCard() {
        return <View testID="event-card" />;
    }

    return MockEventCard;
});

jest.mock('../../components/LiquidPullToRefresh', () => {
    const { View } = require('react-native');

    function MockLiquidPullToRefresh() {
        return <View testID="liquid-pull-to-refresh" />;
    }

    return MockLiquidPullToRefresh;
});

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    deleteDoc: jest.fn(),
    doc: jest.fn(),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    query: jest.fn(),
    where: jest.fn(),
}));

describe('MyEventsScreen focus cleanup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsFocused = true;
    });

    it('unsubscribes the Firestore listener when the screen loses focus', async () => {
        const navigation = {
            navigate: jest.fn(),
        };

        const { rerender } = render(<MyEventsScreen navigation={navigation} />);

        await waitFor(() => {
            expect(mockOnSnapshot).toHaveBeenCalled();
        });

        mockIsFocused = false;
        rerender(<MyEventsScreen navigation={navigation} />);

        await waitFor(() => {
            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });
});
