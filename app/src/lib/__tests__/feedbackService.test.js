import { submitFeedback, calculateAverageRating } from '../feedbackService';
import { setDoc } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    setDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

describe('feedbackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('submits attended feedback successfully', async () => {
        setDoc.mockResolvedValueOnce();

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

        expect(setDoc).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
    });

    test('handles no-show attendee feedback', async () => {
        setDoc.mockResolvedValueOnce();

        const result = await submitFeedback({
            feedbackRequestId: 'req1',
            eventId: 'event1',
            clubId: 'club1',
            userId: 'user1',
            attended: false,
            feedback: '',
        });

        expect(setDoc).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
    });

    test('throws error if setDoc fails', async () => {
        setDoc.mockRejectedValueOnce(new Error('Commit failed'));

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
