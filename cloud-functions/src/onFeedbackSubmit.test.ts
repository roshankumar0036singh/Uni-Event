jest.mock('firebase-admin', () => {
    const incrementMock = jest.fn(val => val);
    const serverTimestampMock = jest.fn(() => 'timestamp');
    const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(true),
    };

    // We will provide mock implementations for get() in tests
    const docMock = jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ clubId: 'club1' }) }),
    }));
    const collectionMock = jest.fn(() => ({
        doc: docMock,
    }));

    return {
        apps: ['mock'],
        initializeApp: jest.fn(),
        firestore: Object.assign(
            jest.fn(() => ({
                collection: collectionMock,
                batch: jest.fn(() => mockBatch),
            })),
            {
                FieldValue: { increment: incrementMock, serverTimestamp: serverTimestampMock },
            },
        ),
    };
});

jest.mock('firebase-functions', () => {
    return {
        firestore: {
            document: jest.fn(() => ({
                onCreate: jest.fn(handler => handler),
            })),
        },
        https: {
            HttpsError: class HttpsError extends Error {
                constructor(code: string, message: string) {
                    super(message);
                    this.name = 'HttpsError';
                }
            },
        },
        logger: {
            info: jest.fn(),
            error: jest.fn(),
        },
    };
});

import { onFeedbackSubmit } from './onFeedbackSubmit';
import * as admin from 'firebase-admin';

describe('onFeedbackSubmit', () => {
    let mockBatch: any;
    let mockDb: any;
    let mockDoc: any;
    let mockGet: any;
    let mockCollection: any;
    let mockCheckInGet: any;
    let mockParticipantGet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb = admin.firestore();
        mockBatch = mockDb.batch();

        mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ clubId: 'club1', userId: 'user1' }),
        });

        mockCheckInGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ status: 'checked-in' }),
        });

        const checkInDocMock = jest.fn().mockReturnValue({
            get: mockCheckInGet,
        });

        const checkInsCollectionMock = jest.fn().mockReturnValue({
            doc: checkInDocMock,
        });

        mockParticipantGet = jest.fn().mockResolvedValue({
            exists: true,
        });

        const participantDocMock = jest.fn().mockReturnValue({
            get: mockParticipantGet,
        });

        const participantsCollectionMock = jest.fn().mockReturnValue({
            doc: participantDocMock,
        });

        mockDoc = jest.fn().mockReturnValue({
            get: mockGet,
            collection: jest.fn(colPath => {
                if (colPath === 'checkIns') return checkInsCollectionMock();
                if (colPath === 'participants') return participantsCollectionMock();
                return { doc: jest.fn() };
            }),
        });

        mockCollection = jest.fn().mockReturnValue({
            doc: mockDoc,
        });
        mockDb.collection.mockImplementation(mockCollection);
    });

    it('should ignore null data', async () => {
        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => null };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await handler(snap, context);
        expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it('should throw if event does not exist', async () => {
        mockGet.mockResolvedValueOnce({ exists: false });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: true, clubId: 'club1' }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Event e1 not found');
    });

    it('should throw if club ID mismatches', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'wrongClub' }) });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: true, clubId: 'club1' }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Club ID mismatch');
    });

    it('should throw if request user ID mismatches', async () => {
        // Event get
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });
        // Request get
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ userId: 'wrongUser' }) });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: true, clubId: 'club1', feedbackRequestId: 'r1' }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow(
            'User u1 does not own feedback request r1',
        );
    });

    it('should throw if clubId is missing or not a string', async () => {
        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: true, clubId: { obj: true } }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Invalid clubId');
    });

    it('should throw if feedbackRequestId has invalid format', async () => {
        const handler = onFeedbackSubmit as unknown as Function;
        const snap = {
            data: () => ({ attended: true, clubId: 'club1', feedbackRequestId: 'bad/id' }),
        };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Invalid feedbackRequestId');
    });

    it('should throw if user did not check in', async () => {
        // Event get
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });
        // Request get (not called here since feedbackRequestId is undefined)
        // CheckIn get
        mockCheckInGet.mockResolvedValueOnce({ exists: false });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: true, clubId: 'club1' }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow(
            'User u1 did not check in to event e1',
        );
    });

    it('should throw if no-show user is not registered', async () => {
        // Event get
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });
        // Participants get
        mockParticipantGet.mockResolvedValueOnce({ exists: false });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: false, clubId: 'club1' }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow(
            'User u1 is not registered for event e1',
        );
    });

    it('should throw for invalid event rating', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = { data: () => ({ attended: true, clubId: 'club1', eventRating: 6 }) };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Invalid event rating');
    });

    it('should throw for invalid club rating', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = {
            data: () => ({ attended: true, clubId: 'club1', eventRating: 4, clubRating: 0 }),
        };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Invalid club rating');
    });

    it('should process successfully and commit batch for attended feedback', async () => {
        // Event get
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });
        // Request get
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ userId: 'u1' }) });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = {
            data: () => ({
                attended: true,
                clubId: 'club1',
                eventRating: 5,
                clubRating: 4,
                feedbackRequestId: 'r1',
            }),
        };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await handler(snap, context);
        expect(mockBatch.set).toHaveBeenCalledTimes(4); // event, club, user, request
        expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should process successfully for no-shows', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = {
            data: () => ({
                attended: false,
                clubId: 'club1',
            }),
        };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await handler(snap, context);
        expect(mockBatch.set).toHaveBeenCalledTimes(1); // event only
        expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should throw when batch commit fails', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clubId: 'club1' }) });
        mockBatch.commit.mockRejectedValueOnce(new Error('Commit error'));

        const handler = onFeedbackSubmit as unknown as Function;
        const snap = {
            data: () => ({
                attended: false,
                clubId: 'club1',
            }),
        };
        const context = { params: { eventId: 'e1', userId: 'u1' } };

        await expect(handler(snap, context)).rejects.toThrow('Commit error');
    });
});
