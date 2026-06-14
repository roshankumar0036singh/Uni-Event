import { httpsCallable } from 'firebase/functions';
import { sendEventPushNotification } from '../eventPushNotificationService';

jest.mock('firebase/functions', () => ({
    httpsCallable: jest.fn(),
}));

jest.mock('../firebaseConfig', () => ({
    functions: {},
}));

describe('eventPushNotificationService', () => {
    let callable;

    beforeEach(() => {
        jest.clearAllMocks();
        callable = jest.fn();
        httpsCallable.mockReturnValue(callable);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends a trimmed notification payload to the callable function', async () => {
        const summary = {
            success: true,
            participantCount: 3,
            targetedCount: 2,
            sentCount: 2,
            failedCount: 0,
            skippedCount: 1,
        };
        callable.mockResolvedValueOnce({ data: summary });

        const result = await sendEventPushNotification(
            'event-1',
            '  Room change  ',
            '  Meet in Hall B.  ',
        );

        expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'sendEventPushNotification');
        expect(callable).toHaveBeenCalledWith({
            eventId: 'event-1',
            title: 'Room change',
            message: 'Meet in Hall B.',
        });
        expect(result).toEqual(summary);
    });

    it('rethrows callable errors', async () => {
        const error = new Error('Permission denied');
        callable.mockRejectedValueOnce(error);

        await expect(
            sendEventPushNotification('event-1', 'Update', 'Meet in Hall B.'),
        ).rejects.toBe(error);
        expect(console.error).toHaveBeenCalled();
    });
});
