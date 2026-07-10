import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import VolunteerDashboard from '../VolunteerDashboard';

const unsubscribeMock = jest.fn();
const mockOnSnapshot = jest.fn(() => unsubscribeMock);

jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native');
    const PropTypes = require('prop-types');

    function MockIonicons({ name }) {
        return <Text>{name}</Text>;
    }

    MockIonicons.propTypes = {
        name: PropTypes.string,
    };

    return {
        Ionicons: MockIonicons,
    };
});

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                primary: '#FF6B35',
                surface: '#ffffff',
                border: '#d0d0d0',
                text: '#111111',
                textSecondary: '#666666',
                background: '#f5f5f5',
            },
            shadows: {
                small: { shadowColor: '#000', shadowOpacity: 0.1 },
                large: { shadowColor: '#000', shadowOpacity: 0.2 },
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

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    deleteDoc: jest.fn(),
    doc: jest.fn(),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    updateDoc: jest.fn(),
}));

jest.mock('react-native-gesture-handler', () => {
    const { View } = require('react-native');
    return {
        GestureHandlerRootView: View,
    };
});

describe('VolunteerDashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing', async () => {
        mockOnSnapshot.mockImplementation((_collection, callback) => {
            callback({
                forEach: jest.fn(),
            });
            return unsubscribeMock;
        });

        render(<VolunteerDashboard />);

        await waitFor(() => {
            expect(mockOnSnapshot).toHaveBeenCalled();
        });
    });

    it('displays loading state initially', () => {
        mockOnSnapshot.mockImplementation(() => unsubscribeMock);

        const { getByText } = render(<VolunteerDashboard />);

        expect(getByText('Loading tasks...')).toBeTruthy();
    });

    it('displays empty state when no tasks exist', async () => {
        mockOnSnapshot.mockImplementation((_collection, callback) => {
            callback({
                forEach: jest.fn(),
            });
            return unsubscribeMock;
        });

        const { getByText } = render(<VolunteerDashboard />);

        await waitFor(() => {
            expect(getByText('Volunteer Tasks')).toBeTruthy();
        });
    });

    it('renders task columns', async () => {
        mockOnSnapshot.mockImplementation((_collection, callback) => {
            callback({
                forEach: jest.fn(),
            });
            return unsubscribeMock;
        });

        const { getByText } = render(<VolunteerDashboard />);

        await waitFor(() => {
            expect(getByText('To Do')).toBeTruthy();
            expect(getByText('In Progress')).toBeTruthy();
            expect(getByText('Done')).toBeTruthy();
        });
    });
});
