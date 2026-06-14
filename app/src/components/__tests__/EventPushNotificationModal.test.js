import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import EventPushNotificationModal from '../EventPushNotificationModal';
import { sendEventPushNotification } from '../../lib/eventPushNotificationService';

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { Text } = require('react-native');
    const MockIonicons = ({ name }) => React.createElement(Text, null, name);
    MockIonicons.propTypes = {
        name: PropTypes.string.isRequired,
    };

    return {
        Ionicons: MockIonicons,
    };
});

jest.mock('../../lib/eventPushNotificationService', () => ({
    sendEventPushNotification: jest.fn(),
}));

const theme = {
    colors: {
        surface: '#fff',
        primary: '#f5a623',
        text: '#111',
        textSecondary: '#666',
        border: '#ddd',
    },
};

describe('EventPushNotificationModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('requires a title and message before sending', () => {
        const { getByText } = render(
            <EventPushNotificationModal
                visible
                eventId="event-1"
                eventTitle="Tech Talk"
                theme={theme}
                onClose={jest.fn()}
            />,
        );

        fireEvent.press(getByText('Send Push Update'));

        expect(Alert.alert).toHaveBeenCalledWith(
            'Missing Details',
            'Enter both a notification title and message.',
        );
        expect(sendEventPushNotification).not.toHaveBeenCalled();
    });

    it('sends the update and closes after success', async () => {
        const onClose = jest.fn();
        sendEventPushNotification.mockResolvedValueOnce({
            targetedCount: 2,
            sentCount: 2,
            failedCount: 0,
            skippedCount: 1,
        });

        const { getByPlaceholderText, getByText } = render(
            <EventPushNotificationModal
                visible
                eventId="event-1"
                eventTitle="Tech Talk"
                theme={theme}
                onClose={onClose}
            />,
        );

        fireEvent.changeText(getByPlaceholderText('Update for Tech Talk'), 'Room change');
        fireEvent.changeText(
            getByPlaceholderText('Share a venue, schedule, or event update...'),
            'Meet in Hall B.',
        );
        fireEvent.press(getByText('Send Push Update'));

        await waitFor(() => {
            expect(sendEventPushNotification).toHaveBeenCalledWith(
                'event-1',
                'Room change',
                'Meet in Hall B.',
            );
            expect(Alert.alert).toHaveBeenCalledWith(
                'Push Update Sent',
                'Sent to 2 attendee(s).\n1 attendee(s) could not receive push.',
            );
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
