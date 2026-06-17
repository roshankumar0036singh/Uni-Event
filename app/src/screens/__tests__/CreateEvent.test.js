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

jest.mock('../../components/EventPreview', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { Text, TouchableOpacity, View } = require('react-native');

    function MockEventPreview({ visible, onClose, eventData, organizerName }) {
        if (!visible) return null;
        return React.createElement(
            View,
            { testID: 'mock-event-preview' },
            React.createElement(Text, null, `Title: ${eventData.title}`),
            React.createElement(Text, null, `Organizer: ${organizerName}`),
            React.createElement(
                TouchableOpacity,
                { onPress: onClose, testID: 'close-preview-btn' },
                React.createElement(Text, null, 'Close'),
            ),
        );
    }

    MockEventPreview.propTypes = {
        visible: PropTypes.bool,
        onClose: PropTypes.func,
        eventData: PropTypes.object,
        organizerName: PropTypes.string,
    };

    return MockEventPreview;
});

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

const mockSetDoc = jest.fn(async () => {});
const mockGetDocs = jest.fn(async () => ({ docs: [] }));
const mockWhere = jest.fn((...args) => ({ __isWhereClause: true, args }));
const mockQuery = jest.fn((...args) => ({ __isQuery: true, args }));

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
    getDocs: (...args) => mockGetDocs(...args),
    setDoc: (...args) => mockSetDoc(...args),
    where: (...args) => mockWhere(...args),
    query: (...args) => mockQuery(...args),
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
    }, 15000);
});

describe('CreateEvent – saveAsTemplate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('saves a template to Firestore with correct fields', async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const { getByPlaceholderText, getByText } = render(
            <CreateEvent navigation={navigation} route={route} />,
        );

        fireEvent.changeText(getByPlaceholderText('e.g. Annual Tech Symposium'), 'Hackathon Night');
        fireEvent.changeText(
            getByPlaceholderText('What is this event about?'),
            'An overnight coding competition.',
        );
        fireEvent.press(getByText('Tech'));

        fireEvent.press(getByText('Save as Template'));

        await waitFor(() => {
            expect(mockSetDoc).toHaveBeenCalledTimes(1);
        });

        const [, templateData] = mockSetDoc.mock.calls[0];
        expect(templateData).toMatchObject({
            title: 'Hackathon Night',
            description: 'An overnight coding competition.',
            category: 'Tech',
            type: 'eventTemplate',
            ownerId: 'organizer-1',
            ownerEmail: 'organizer@example.com',
            organizerName: 'Organizer One',
        });
        expect(templateData.createdAt).toEqual({ __op: 'serverTimestamp' });
        expect(templateData.updatedAt).toEqual({ __op: 'serverTimestamp' });

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Saved', 'Template saved successfully!');
        });

        alertSpy.mockRestore();
    });

    it('shows validation alert when required fields are missing', async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const { getByText } = render(<CreateEvent navigation={navigation} route={route} />);

        // Press without filling anything
        fireEvent.press(getByText('Save as Template'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Missing Info',
                'Please fill Title, Description and Category.',
            );
        });
        expect(mockSetDoc).not.toHaveBeenCalled();

        alertSpy.mockRestore();
    });
});

describe('CreateEvent – fetchTemplates and applyTemplate', () => {
    const MOCK_TEMPLATES = [
        {
            id: 'tpl-1',
            title: 'Annual Hackathon',
            description: 'Overnight coding competition.',
            category: 'Tech',
            eventMode: 'offline',
            location: 'Auditorium',
            tags: ['hackathon', 'coding'],
            target: { departments: ['CSE'], years: [1, 2] },
            isPaid: false,
            price: 0,
            capacity: 150,
            hasCustomForm: false,
            customFormSchema: [],
            createdAt: { toMillis: () => 1000 },
        },
        {
            id: 'tpl-2',
            title: 'Cultural Fest',
            description: 'Annual cultural event.',
            category: 'Cultural',
            eventMode: 'offline',
            location: 'Main Ground',
            tags: [],
            target: { departments: ['All'], years: [1, 2, 3, 4] },
            isPaid: true,
            price: 50,
            capacity: 500,
            hasCustomForm: false,
            customFormSchema: [],
            createdAt: { toMillis: () => 2000 },
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetDocs.mockResolvedValue({
            docs: MOCK_TEMPLATES.map(t => ({
                id: t.id,
                data: () => t,
            })),
        });
    });

    it('opens the template modal and lists saved templates', async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };

        const { getByText } = render(<CreateEvent navigation={navigation} route={route} />);

        fireEvent.press(getByText('Use Template'));

        await waitFor(() => {
            expect(mockGetDocs).toHaveBeenCalledTimes(1);
            expect(getByText('Annual Hackathon')).toBeTruthy();
            expect(getByText('Cultural Fest')).toBeTruthy();
        });
    });

    it("queries Firestore by the current user's ownerId", async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };

        const { getByText } = render(<CreateEvent navigation={navigation} route={route} />);
        fireEvent.press(getByText('Use Template'));

        await waitFor(() => {
            expect(mockWhere).toHaveBeenCalledWith('ownerId', '==', 'organizer-1');
            expect(mockGetDocs).toHaveBeenCalledTimes(1);
        });
    });

    it('pre-fills form fields when a template is selected from the modal', async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };

        const { getByText, getByDisplayValue } = render(
            <CreateEvent navigation={navigation} route={route} />,
        );

        fireEvent.press(getByText('Use Template'));

        await waitFor(() => {
            expect(getByText('Annual Hackathon')).toBeTruthy();
        });

        // Tap the first template
        fireEvent.press(getByText('Annual Hackathon'));

        await waitFor(() => {
            expect(getByDisplayValue('Annual Hackathon')).toBeTruthy();
            expect(getByDisplayValue('Overnight coding competition.')).toBeTruthy();
        });
    });

    it('shows empty-state message when no templates exist', async () => {
        mockGetDocs.mockResolvedValue({ docs: [] });

        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };

        const { getByText } = render(<CreateEvent navigation={navigation} route={route} />);

        fireEvent.press(getByText('Use Template'));

        await waitFor(() => {
            expect(getByText('No templates saved yet.')).toBeTruthy();
        });
    });

    it('shows error alert when getDocs throws', async () => {
        mockGetDocs.mockRejectedValue(new Error('Network error'));
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };

        const { getByText } = render(<CreateEvent navigation={navigation} route={route} />);

        fireEvent.press(getByText('Use Template'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to load templates.');
        });

        alertSpy.mockRestore();
    });
});

describe('CreateEvent – applyTemplate via route.params', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('pre-fills all form fields from a template passed in route.params', async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const templateParam = {
            title: 'Workshop on AI',
            description: 'Intro to machine learning.',
            category: 'Workshop',
            eventMode: 'offline',
            location: 'Lab 4',
            tags: ['AI', 'ML'],
            target: { departments: ['CSE', 'ETC'], years: [3, 4] },
            isPaid: false,
            price: 0,
            capacity: 60,
            hasCustomForm: false,
            customFormSchema: [],
        };
        const route = { params: { template: templateParam } };

        const { getByDisplayValue } = render(<CreateEvent navigation={navigation} route={route} />);

        await waitFor(() => {
            expect(getByDisplayValue('Workshop on AI')).toBeTruthy();
            expect(getByDisplayValue('Intro to machine learning.')).toBeTruthy();
        });
    });
});

describe('CreateEvent – Preview Mode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders preview triggers and opens the preview modal', async () => {
        const navigation = { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
        const route = { params: {} };

        const { getByPlaceholderText, getByText, getByLabelText, getByTestId, queryByTestId } =
            render(<CreateEvent navigation={navigation} route={route} />);

        // Fill some data
        fireEvent.changeText(
            getByPlaceholderText('e.g. Annual Tech Symposium'),
            'Preview Event Title',
        );

        // Assert modal is not open initially
        expect(queryByTestId('mock-event-preview')).toBeNull();

        // Tap the header preview eye icon
        const headerPreviewBtn = getByLabelText('Preview Event');
        fireEvent.press(headerPreviewBtn);

        // Assert modal is now open with correct title
        expect(queryByTestId('mock-event-preview')).toBeTruthy();
        expect(getByText('Title: Preview Event Title')).toBeTruthy();
        expect(getByText('Organizer: Organizer One')).toBeTruthy();

        // Close it
        fireEvent.press(getByTestId('close-preview-btn'));
        expect(queryByTestId('mock-event-preview')).toBeNull();

        // Tap the bottom preview button
        const bottomPreviewBtn = getByText('Preview');
        fireEvent.press(bottomPreviewBtn);

        // Assert modal is open again
        expect(queryByTestId('mock-event-preview')).toBeTruthy();
    });
});
