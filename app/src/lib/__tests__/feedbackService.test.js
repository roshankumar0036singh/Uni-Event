import { submitFeedback, calculateAverageRating } from '../feedbackService';
import { runTransaction } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    increment: jest.fn(value => value),
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
    runTransaction: jest.fn(),
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

describe('feedbackService', () => {
    let mockTransaction;

    beforeEach(() => {
        mockTransaction = {
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
        };

        runTransaction.mockImplementation(async (db, callback) => {
            return await callback(mockTransaction);
        });

        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('submits attended feedback successfully', async () => {
        mockTransaction.get
            .mockResolvedValueOnce({ exists: () => false }) // feedbackDoc
            .mockResolvedValueOnce({ exists: () => true }); // clubDoc

        const result = await submitFeedback({
            feedbackRequestId: 'req1',
            eventId: 'event1',
            clubId: 'club1',
            userId: 'user1',
            attended: true,
            eventRating: 5,
            clubRating: 4,
            feedback: 'Great event',
        });

        expect(mockTransaction.get).toHaveBeenCalledTimes(2); // feedback + club
        expect(mockTransaction.set).toHaveBeenCalledTimes(2); // feedback + event
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                userId: 'user1',
                attended: true,
                eventRating: 5,
                clubRating: 4,
                feedback: 'Great event',
            }),
        );
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                stats: expect.objectContaining({ feedbackCount: 1, totalAttendees: 1 }),
            }),
            { merge: true },
        );

        expect(mockTransaction.update).toHaveBeenCalledTimes(3); // club + user points + request
        expect(mockTransaction.update).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                'reputation.totalPoints': 4,
            }),
        );
        expect(result).toEqual({ success: true });
    });

    test('handles no-show attendee feedback', async () => {
        mockTransaction.get.mockResolvedValueOnce({ exists: () => false }); // feedbackDoc

        const result = await submitFeedback({
            feedbackRequestId: 'req1',
            eventId: 'event1',
            clubId: 'club1',
            userId: 'user1',
            attended: false,
            feedback: '',
        });

        expect(mockTransaction.get).toHaveBeenCalledTimes(1); // feedback only
        expect(mockTransaction.set).toHaveBeenCalledTimes(2); // feedback + event
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                userId: 'user1',
                attended: false,
                feedback: null,
            }),
        );
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                stats: expect.objectContaining({ feedbackCount: 1, totalNoShows: 1 }),
            }),
            { merge: true },
        );

        expect(mockTransaction.update).toHaveBeenCalledTimes(1); // request only
        expect(mockTransaction.update).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                status: 'completed',
            }),
        );
        expect(result).toEqual({ success: true });
    });

    test('creates reputation if club document does not exist', async () => {
        mockTransaction.get
            .mockResolvedValueOnce({ exists: () => false }) // feedbackDoc
            .mockResolvedValueOnce({ exists: () => false }); // clubDoc

        await submitFeedback({
            feedbackRequestId: 'req1',
            eventId: 'event1',
            clubId: 'club1',
            userId: 'user1',
            attended: true,
            eventRating: 5,
            clubRating: 4,
            feedback: 'Nice',
        });

        expect(mockTransaction.get).toHaveBeenCalledTimes(2); // feedback + club
        expect(mockTransaction.set).toHaveBeenCalledTimes(3); // feedback + event + club(reputation create)
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                reputation: expect.objectContaining({ totalPoints: 4, totalRatings: 1 }),
            }),
            { merge: true },
        );

        expect(mockTransaction.update).toHaveBeenCalledTimes(2); // user points + request
    });

    test('throws error if transaction fails', async () => {
        runTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

        await expect(
            submitFeedback({
                feedbackRequestId: 'req1',
                eventId: 'event1',
                clubId: 'club1',
                userId: 'user1',
                attended: true,
                eventRating: 5,
                clubRating: 4,
                feedback: 'Nice',
            }),
        ).rejects.toThrow('Transaction failed');
    });

    test('throws error if feedback already exists', async () => {
        mockTransaction.get.mockResolvedValueOnce({ exists: () => true }); // feedbackDoc

        await expect(
            submitFeedback({
                feedbackRequestId: 'req1',
                eventId: 'event1',
                clubId: 'club1',
                userId: 'user1',
                attended: true,
                eventRating: 5,
                clubRating: 4,
                feedback: 'Nice',
            }),
        ).rejects.toThrow('Feedback already submitted for this event.');
    });

    test('calculates average rating correctly', () => {
        const result = calculateAverageRating({
            totalPoints: 20,
            totalRatings: 4,
        });

        expect(result).toBe('5.0');
    });

    test('returns 0 when no ratings exist', () => {
        expect(calculateAverageRating(null)).toBe(0);

        expect(
            calculateAverageRating({
                totalRatings: 0,
            }),
        ).toBe(0);
    });
});
