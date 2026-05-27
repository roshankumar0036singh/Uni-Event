import { predictAttendance, fetchShowUpRatios, _resetCache } from '../capacityPredictor';
import { getDoc } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => 'mock-doc'),
    getDoc: jest.fn(),
}));

jest.mock('../firebaseConfig', () => ({
    db: {},
}));

jest.mock('../logger', () => ({
    error: jest.fn(),
}));

describe('capacityPredictor', () => {
    beforeEach(() => {
        _resetCache();
        getDoc.mockReset();
    });

    describe('predictAttendance', () => {
        it('returns null when capacity is missing', async () => {
            const result = await predictAttendance({ rsvpCount: 100, capacity: null });
            expect(result).toBeNull();
        });

        it('returns null when capacity is zero', async () => {
            const result = await predictAttendance({ rsvpCount: 100, capacity: 0 });
            expect(result).toBeNull();
        });

        it('returns null when capacity is negative', async () => {
            const result = await predictAttendance({ rsvpCount: 100, capacity: -1 });
            expect(result).toBeNull();
        });

        it('returns zero prediction when no RSVPs', async () => {
            const result = await predictAttendance({ rsvpCount: 0, capacity: 100 });
            expect(result).toEqual({ predicted: 0, ratio: 0, warning: null });
        });

        it('returns null when ratios document does not exist', async () => {
            getDoc.mockResolvedValue({ exists: () => false });
            const result = await predictAttendance({ rsvpCount: 100, capacity: 100 });
            expect(result).toBeNull();
        });

        it('uses overall ratio when no category match', async () => {
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    overall: { ratio: 0.6 },
                    categoryRatios: {},
                }),
            });
            const result = await predictAttendance({ rsvpCount: 100, capacity: 50 });
            expect(result.predicted).toBe(60);
            expect(result.ratio).toBe(0.6);
            expect(result.severity).toBe('high');
        });

        it('uses category-specific ratio when available', async () => {
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    overall: { ratio: 0.6 },
                    categoryRatios: {
                        Tech: { ratio: 0.75 },
                    },
                }),
            });
            const result = await predictAttendance({
                category: 'Tech',
                rsvpCount: 100,
                capacity: 50,
            });
            expect(result.predicted).toBe(75);
            expect(result.ratio).toBe(0.75);
            expect(result.severity).toBe('high');
        });

        it('returns warning severity medium when predicted equals capacity', async () => {
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    overall: { ratio: 0.5 },
                    categoryRatios: {},
                }),
            });
            const result = await predictAttendance({ rsvpCount: 100, capacity: 50 });
            expect(result.predicted).toBe(50);
            expect(result.severity).toBe('medium');
        });

        it('returns no warning when predicted is below capacity', async () => {
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    overall: { ratio: 0.5 },
                    categoryRatios: {},
                }),
            });
            const result = await predictAttendance({ rsvpCount: 50, capacity: 100 });
            expect(result.predicted).toBe(25);
            expect(result.warning).toBeNull();
            expect(result.severity).toBe('ok');
        });

        it('falls back to 0.6 when no ratios data at all', async () => {
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({}),
            });
            const result = await predictAttendance({ rsvpCount: 100, capacity: 50 });
            expect(result.predicted).toBe(60);
            expect(result.ratio).toBe(0.6);
        });

        it('caches ratios and avoids duplicate Firestore reads', async () => {
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    overall: { ratio: 0.5 },
                    categoryRatios: {},
                }),
            });
            await predictAttendance({ rsvpCount: 100, capacity: 100 });
            await predictAttendance({ rsvpCount: 100, capacity: 100 });
            expect(getDoc).toHaveBeenCalledTimes(1);
        });
    });

    describe('fetchShowUpRatios', () => {
        it('returns null when document does not exist', async () => {
            getDoc.mockResolvedValue({ exists: () => false });
            const result = await fetchShowUpRatios();
            expect(result).toBeNull();
        });

        it('returns data when document exists', async () => {
            const mockData = { overall: { ratio: 0.6 } };
            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => mockData,
            });
            const result = await fetchShowUpRatios();
            expect(result).toEqual(mockData);
        });

        it('returns null on error', async () => {
            getDoc.mockRejectedValue(new Error('network error'));
            const result = await fetchShowUpRatios();
            expect(result).toBeNull();
        });
    });
});
