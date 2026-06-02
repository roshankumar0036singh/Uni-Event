import { submitFeedback, calculateAverageRating } from '../feedbackService';
import { runTransaction } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('../logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

describe('feedbackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('submits attended feedback successfully', async () => {
        let mockTransaction;
        runTransaction.mockImplementationOnce(async (_, callback) => {
            mockTransaction = {
                get: jest.fn().mockResolvedValue({ exists: () => false }),
                set: jest.fn(),
            };
            return await callback(mockTransaction);
        });

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

        expect(runTransaction).toHaveBeenCalled();
        expect(mockTransaction.set).toHaveBeenCalledTimes(1);
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                feedbackRequestId: 'req1',
                eventId: 'event1',
                clubId: 'club1',
                userId: 'user1',
                attended: true,
                eventRating: 5,
                clubRating: 4,
                feedback: 'Great event',
            }),
        );
        expect(result).toEqual({ success: true });
    });

    test('handles no-show attendee feedback', async () => {
        let mockTransaction;
        runTransaction.mockImplementationOnce(async (_, callback) => {
            mockTransaction = {
                get: jest.fn().mockResolvedValue({ exists: () => false }),
                set: jest.fn(),
            };
            return await callback(mockTransaction);
        });

        const result = await submitFeedback({
            feedbackRequestId: 'req1',
            eventId: 'event1',
            clubId: 'club1',
            userId: 'user1',
            attended: false,
            feedback: '',
        });

        expect(runTransaction).toHaveBeenCalled();
        expect(mockTransaction.set).toHaveBeenCalledTimes(1);
        expect(mockTransaction.set).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                feedbackRequestId: 'req1',
                eventId: 'event1',
                clubId: 'club1',
                userId: 'user1',
                attended: false,
                feedback: null,
            }),
        );
        expect(result).toEqual({ success: true });
    });

    test('throws error if feedback already exists', async () => {
        runTransaction.mockImplementationOnce(async (_, callback) => {
            const mockTransaction = {
                get: jest.fn().mockResolvedValue({ exists: () => true }),
                set: jest.fn(),
            };
            return await callback(mockTransaction);
        });

        await expect(
            submitFeedback({
                feedbackRequestId: 'req1',
                eventId: 'event1',
                clubId: 'club1',
                userId: 'user1',
                attended: true,
            }),
        ).rejects.toThrow('Feedback already submitted');
    });

    test('throws error if transaction fails', async () => {
        runTransaction.mockRejectedValueOnce(new Error('Commit failed'));

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
        ).rejects.toThrow('Commit failed');
    });

    test('calculates average rating correctly', () => {
        const result = calculateAverageRating({
            totalPoints: 20,
            totalRatings: 4,
        });

        expect(result).toBe(5);
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
