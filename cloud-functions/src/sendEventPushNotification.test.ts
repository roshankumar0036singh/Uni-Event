const mockSendPushNotifications = jest.fn();
const mockIsExpoPushToken = jest.fn();
const mockHistoryAdd = jest.fn();
const mockParticipantsGet = jest.fn();
const mockEventGet = jest.fn();
const mockGetAll = jest.fn();

jest.mock('./utils/push', () => ({
    isExpoPushToken: (token: string) => mockIsExpoPushToken(token),
    sendPushNotifications: (messages: unknown[]) => mockSendPushNotifications(messages),
}));

jest.mock('firebase-admin', () => ({
    firestore: Object.assign(
        jest.fn(() => ({
            collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                    get: mockEventGet,
                    collection: jest.fn((name: string) => {
                        if (name === 'participants') {
                            return { get: mockParticipantsGet };
                        }
                        return { add: mockHistoryAdd };
                    }),
                })),
            })),
            getAll: mockGetAll,
        })),
        {
            FieldValue: {
                serverTimestamp: jest.fn(() => 'server-timestamp'),
            },
        },
    ),
}));

jest.mock('firebase-functions', () => ({
    https: {
        onCall: jest.fn((handler: unknown) => handler),
        HttpsError: class HttpsError extends Error {
            code: string;
            details?: unknown;

            constructor(code: string, message: string, details?: unknown) {
                super(message);
                this.code = code;
                this.details = details;
            }
        },
    },
}));

import { sendEventPushNotification } from './sendEventPushNotification';

const callFunction = (data: Record<string, unknown>, auth?: Record<string, unknown>) =>
    (sendEventPushNotification as unknown as Function)(data, {
        auth,
    });

const participantSnapshot = (participants: Array<{ id: string; userId?: string }>) => ({
    docs: participants.map(participant => ({
        id: participant.id,
        data: () => (participant.userId ? { userId: participant.userId } : {}),
    })),
});

describe('sendEventPushNotification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockEventGet.mockResolvedValue({
            exists: true,
            data: () => ({ ownerId: 'organizer-1', status: 'active' }),
        });
        mockParticipantsGet.mockResolvedValue(participantSnapshot([]));
        mockGetAll.mockResolvedValue([]);
        mockSendPushNotifications.mockResolvedValue([]);
        mockHistoryAdd.mockResolvedValue({ id: 'history-1' });
        mockIsExpoPushToken.mockImplementation(token => token.startsWith('ExponentPushToken'));
    });

    it('rejects unauthenticated requests', async () => {
        await expect(
            callFunction({
                eventId: 'event-1',
                title: 'Update',
                message: 'Venue changed.',
            }),
        ).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('validates title and message lengths', async () => {
        await expect(
            callFunction(
                { eventId: 'event-1', title: ' ', message: 'Venue changed.' },
                { uid: 'organizer-1', token: {} },
            ),
        ).rejects.toMatchObject({ code: 'invalid-argument' });

        await expect(
            callFunction(
                { eventId: 'event-1', title: 'Update', message: 'x'.repeat(501) },
                { uid: 'organizer-1', token: {} },
            ),
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects users who do not own the event', async () => {
        await expect(
            callFunction(
                {
                    eventId: 'event-1',
                    title: 'Update',
                    message: 'Venue changed.',
                },
                { uid: 'other-user', token: {} },
            ),
        ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects requests for events that do not exist', async () => {
        mockEventGet.mockResolvedValueOnce({ exists: false });

        await expect(
            callFunction(
                {
                    eventId: 'missing-event',
                    title: 'Update',
                    message: 'Venue changed.',
                },
                { uid: 'organizer-1', token: {} },
            ),
        ).rejects.toMatchObject({ code: 'not-found' });
    });

    it('allows administrators to notify attendees', async () => {
        const result = await callFunction(
            {
                eventId: 'event-1',
                title: 'Update',
                message: 'Venue changed.',
            },
            { uid: 'admin-1', token: { admin: true } },
        );

        expect(result).toMatchObject({ success: true, participantCount: 0 });
    });

    it('records notification history when there are no participants', async () => {
        const result = await callFunction(
            {
                eventId: 'event-1',
                title: 'Event update',
                message: 'The venue has changed.',
            },
            { uid: 'organizer-1', token: {} },
        );

        expect(mockSendPushNotifications).toHaveBeenCalledWith([]);
        expect(mockHistoryAdd).toHaveBeenCalledWith({
            title: 'Event update',
            message: 'The venue has changed.',
            sentBy: 'organizer-1',
            participantCount: 0,
            targetedCount: 0,
            sentCount: 0,
            failedCount: 0,
            skippedCount: 0,
            createdAt: 'server-timestamp',
        });
        expect(result).toEqual({
            success: true,
            participantCount: 0,
            targetedCount: 0,
            sentCount: 0,
            failedCount: 0,
            skippedCount: 0,
        });
    });

    it('rejects deleted events', async () => {
        mockEventGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ ownerId: 'organizer-1', status: 'deleted' }),
        });

        await expect(
            callFunction(
                {
                    eventId: 'event-1',
                    title: 'Update',
                    message: 'Venue changed.',
                },
                { uid: 'organizer-1', token: {} },
            ),
        ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('deduplicates valid push tokens and returns delivery counts', async () => {
        mockParticipantsGet.mockResolvedValueOnce(
            participantSnapshot([
                { id: 'user-1' },
                { id: 'participant-2', userId: 'user-2' },
                { id: 'user-3' },
            ]),
        );
        mockGetAll.mockResolvedValueOnce([
            {
                exists: true,
                data: () => ({ pushToken: 'ExponentPushToken[token-1]' }),
            },
            {
                exists: true,
                data: () => ({ pushToken: 'ExponentPushToken[token-1]' }),
            },
            {
                exists: true,
                data: () => ({ pushToken: 'invalid-token' }),
            },
        ]);
        mockSendPushNotifications.mockResolvedValueOnce([{ status: 'ok', id: 'ticket-1' }]);

        const result = await callFunction(
            {
                eventId: 'event-1',
                title: ' Room change ',
                message: ' Meet in Hall B. ',
            },
            { uid: 'organizer-1', token: {} },
        );

        expect(mockSendPushNotifications).toHaveBeenCalledWith([
            expect.objectContaining({
                to: 'ExponentPushToken[token-1]',
                title: 'Room change',
                body: 'Meet in Hall B.',
                data: expect.objectContaining({ eventId: 'event-1' }),
            }),
        ]);
        expect(result).toEqual({
            success: true,
            participantCount: 3,
            targetedCount: 1,
            sentCount: 1,
            failedCount: 0,
            skippedCount: 2,
        });
        expect(mockHistoryAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                sentBy: 'organizer-1',
                sentCount: 1,
                skippedCount: 2,
            }),
        );
    });

    it('counts unsuccessful and missing tickets as failed deliveries', async () => {
        mockParticipantsGet.mockResolvedValueOnce(
            participantSnapshot([{ id: 'user-1' }, { id: 'user-2' }]),
        );
        mockGetAll.mockResolvedValueOnce([
            {
                exists: true,
                data: () => ({ pushToken: 'ExponentPushToken[token-1]' }),
            },
            {
                exists: true,
                data: () => ({ pushToken: 'ExponentPushToken[token-2]' }),
            },
        ]);
        mockSendPushNotifications.mockResolvedValueOnce([
            { status: 'error', message: 'DeviceNotRegistered' },
        ]);

        const result = await callFunction(
            {
                eventId: 'event-1',
                title: 'Update',
                message: 'Venue changed.',
            },
            { uid: 'organizer-1', token: {} },
        );

        expect(result).toMatchObject({
            targetedCount: 2,
            sentCount: 0,
            failedCount: 2,
        });
    });
});
