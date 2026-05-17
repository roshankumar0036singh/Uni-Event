import { getEarlyBirdInfo, isEarlyBirdEligible } from '../earlyBird';

describe('earlyBird utility', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-05-17T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('getEarlyBirdInfo', () => {
        it('Path A: Explicit early bird, eligible', () => {
            const event = {
                hasEarlyBird: true,
                earlyBirdDeadline: '2026-05-17T12:30:00.000Z',
                earlyBirdPrice: 50,
                price: 100
            };
            const result = getEarlyBirdInfo(event);
            expect(result.isEligible).toBe(true);
            expect(result.currentPrice).toBe(50);
            expect(result.isExplicit).toBe(true);
        });

        it('Path A: Explicit early bird, not eligible (past deadline)', () => {
            const event = {
                hasEarlyBird: true,
                earlyBirdDeadline: '2026-05-17T11:30:00.000Z',
                earlyBirdPrice: 50,
                price: 100
            };
            const result = getEarlyBirdInfo(event);
            expect(result.isEligible).toBe(false);
            expect(result.currentPrice).toBe(100);
            expect(result.isExplicit).toBe(true);
        });

        it('Path B: Fallback (first 1 hour), eligible', () => {
            const event = {
                createdAt: '2026-05-17T11:30:00.000Z',
                price: 100
            };
            const result = getEarlyBirdInfo(event);
            expect(result.isEligible).toBe(true);
            expect(result.currentPrice).toBe(100);
            expect(result.isExplicit).toBe(false);
        });

        it('Path B: Fallback, not eligible (past 1 hour)', () => {
            const event = {
                createdAt: '2026-05-17T10:30:00.000Z',
                price: 100
            };
            const result = getEarlyBirdInfo(event);
            expect(result.isEligible).toBe(false);
            expect(result.currentPrice).toBe(100);
        });

        it('Path B: Fallback, missing createdAt', () => {
            const event = { price: 100 };
            const result = getEarlyBirdInfo(event);
            expect(result.isEligible).toBe(false);
        });
        
        it('Path B: Future createdAt (elapsed < 0)', () => {
            const event = {
                createdAt: '2026-05-17T13:00:00.000Z',
                price: 100
            };
            const result = getEarlyBirdInfo(event);
            expect(result.isEligible).toBe(false);
        });
    });

    describe('isEarlyBirdEligible', () => {
        it('eligible within 1 hour', () => {
            expect(isEarlyBirdEligible('2026-05-17T11:30:00.000Z')).toBe(true);
        });

        it('not eligible after 1 hour', () => {
            expect(isEarlyBirdEligible('2026-05-17T10:30:00.000Z')).toBe(false);
        });

        it('returns false for null timestamp', () => {
            expect(isEarlyBirdEligible(null)).toBe(false);
        });
    });
    
    describe('getTimestampMs coverage', () => {
        it('handles Firestore Timestamp with toMillis', () => {
            const event = {
                createdAt: { toMillis: () => new Date('2026-05-17T11:30:00.000Z').getTime() },
            };
            expect(getEarlyBirdInfo(event).isEligible).toBe(true);
        });

        it('handles object with toDate', () => {
            const event = {
                createdAt: { toDate: () => new Date('2026-05-17T11:30:00.000Z') },
            };
            expect(getEarlyBirdInfo(event).isEligible).toBe(true);
        });

        it('handles object with seconds', () => {
            const event = {
                createdAt: { seconds: new Date('2026-05-17T11:30:00.000Z').getTime() / 1000 },
            };
            expect(getEarlyBirdInfo(event).isEligible).toBe(true);
        });
        
        it('handles invalid string', () => {
            expect(isEarlyBirdEligible('invalid-date')).toBe(false);
        });
        
        it('returns null for unsupported object type', () => {
             const event = {
                createdAt: { unknownProp: 'foo' },
            };
            expect(getEarlyBirdInfo(event).isEligible).toBe(false);
        });
    });
});
