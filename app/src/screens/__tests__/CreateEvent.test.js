/* eslint-disable import/first */

jest.mock('@expo/vector-icons', () => {
    const React = require('react');

    return {
        Ionicons: () => React.createElement('Icon'),
    };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
    launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
    MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('react-native-maps', () => ({
    __esModule: true,
    default: 'MapView',
    Marker: 'Marker',
}));

jest.mock('../../components/ScreenWrapper', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { View } = require('react-native');

    function MockScreenWrapper({ children }) {
        return React.createElement(View, null, children);
    }

    MockScreenWrapper.propTypes = {
        children: PropTypes.node,
    };

    return MockScreenWrapper;
});

jest.mock('../../components/PremiumInput', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { TextInput, View, Text } = require('react-native');

    function MockPremiumInput({ label, value, onChangeText, placeholder }) {
        return React.createElement(
            View,
            null,
            React.createElement(Text, null, label),
            React.createElement(TextInput, {
                value,
                onChangeText,
                placeholder,
            }),
        );
    }

    MockPremiumInput.propTypes = {
        label: PropTypes.string,
        value: PropTypes.any,
        onChangeText: PropTypes.func,
        placeholder: PropTypes.any,
    };

    return MockPremiumInput;
});

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                text: '#000',
                primary: '#0066cc',
                textSecondary: '#666',
                surface: '#fff',
                border: '#ddd',
            },
        },
    }),
}));

jest.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        user: {
            uid: 'organizer-1',
            email: 'organizer@example.com',
            displayName: 'Organizer One',
        },
    }),
}));

jest.mock('../../lib/firebaseConfig', () => ({
    db: { __name: 'mock-db' },
    storage: { __name: 'mock-storage' },
}));

jest.mock('../../lib/CalendarService', () => ({
    useCalendarAuth: () => ({
        request: null,
        response: null,
        promptAsync: jest.fn(),
    }),
    createMeetEvent: jest.fn(),
}));

jest.mock('../../lib/tagExtractor', () => ({
    extractTags: jest.fn(() => []),
}));

jest.mock('../../lib/capacityPredictor', () => ({
    predictAttendance: jest.fn(() => null),
}));

const mockEnforceRateLimit = jest.fn(async () => {});
jest.mock('../../lib/rateLimiter', () => ({
    enforceRateLimit: (...args) => mockEnforceRateLimit(...args),
}));

jest.mock('firebase/storage', () => ({
    ref: jest.fn(),
    uploadBytes: jest.fn(),
    getDownloadURL: jest.fn(),
}));

const mockIncrement = jest.fn(value => ({ __op: 'increment', value }));
const mockServerTimestamp = jest.fn(() => ({ __op: 'serverTimestamp' }));
const mockExistingDocs = new Set(['users/organizer-1']);

const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockTransactionGet = jest.fn(async ref => ({
    exists: () => mockExistingDocs.has(ref.path),
    data: () => ({}),
}));
const mockRunTransaction = jest.fn(async (dbArg, callback) => {
    const tx = {
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
    };
    return callback(tx);
});

const mockCollection = jest.fn((dbArg, ...segments) => ({
    __isCollectionRef: true,
    path: segments.join('/'),
}));

const mockDoc = jest.fn((firstArg, ...segments) => {
    if (firstArg?.__isCollectionRef && segments.length === 0) {
        return { id: 'event_tx_1', path: `${firstArg.path}/event_tx_1` };
    }

    const parts = [...(typeof firstArg === 'string' ? [firstArg] : []), ...segments];

    return {
        id: parts.at(-1),
        path: parts.join('/'),
    };
});

jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    updateDoc: jest.fn(),
    runTransaction: (...args) => mockRunTransaction(...args),
    increment: (...args) => mockIncrement(...args),
    serverTimestamp: (...args) => mockServerTimestamp(...args),
}));

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateEvent from '../CreateEvent';

describe('CreateEvent transaction flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates event, attendance placeholder, and organizer counter atomically', async () => {
        const navigation = {
            goBack: jest.fn(),
            setOptions: jest.fn(),
            navigate: jest.fn(),
        };
        const route = { params: {} };

        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const { getByPlaceholderText, getByText, getAllByText } = render(
            <CreateEvent navigation={navigation} route={route} />,
        );

        fireEvent.changeText(
            getByPlaceholderText('e.g. Annual Tech Symposium'),
            'Atomicity Test Event',
        );
        fireEvent.changeText(
            getByPlaceholderText('What is this event about?'),
            'Verify event creation transaction behavior.',
        );
        fireEvent.changeText(getByPlaceholderText('e.g. Auditorium / Room 302'), 'Main Hall');

        fireEvent.press(getByText('Tech'));
        fireEvent.press(getAllByText('Create Event').at(1));

        await waitFor(() => {
            expect(mockRunTransaction).toHaveBeenCalledTimes(1);
        });

        expect(mockEnforceRateLimit).toHaveBeenCalledWith(true);
        expect(mockTransactionGet).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'users/organizer-1' }),
        );

        expect(mockTransactionSet).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'events/event_tx_1' }),
            expect.objectContaining({
                title: 'Atomicity Test Event',
                ownerId: 'organizer-1',
                ownerEmail: 'organizer@example.com',
                organizerName: 'Organizer One',
                participantCount: 0,
                participantsPreview: [],
                createdAt: { __op: 'serverTimestamp' },
            }),
        );

        expect(mockTransactionSet).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'events/event_tx_1/attendance/bootstrap' }),
            expect.objectContaining({
                eventId: 'event_tx_1',
                ownerId: 'organizer-1',
                type: 'bootstrap',
                checkInCount: 0,
                createdAt: { __op: 'serverTimestamp' },
                updatedAt: { __op: 'serverTimestamp' },
            }),
        );

        expect(mockTransactionUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'users/organizer-1' }),
            expect.objectContaining({
                'organizerStats.eventsCreated': { __op: 'increment', value: 1 },
                lastEventCreatedAt: { __op: 'serverTimestamp' },
            }),
        );

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Success', 'Event Created!');
            expect(navigation.goBack).toHaveBeenCalled();
        });

        alertSpy.mockRestore();
    });
});
