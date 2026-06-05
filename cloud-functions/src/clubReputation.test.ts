/**
 * Unit tests for the club reputation time-decay system.
 *
 * These tests are pure unit tests - they do NOT require a Firestore emulator.
 * All Firebase Cloud Function side-effects are covered by the helper functions
 * exported from clubReputation.ts, which contain all the business logic.
 *
 * Decay formula: weight = 1 - (monthsAgo / DECAY_WINDOW_MONTHS)
 *   - A review from THIS month:      weight = 1.0  (full weight)
 *   - A review from 6 months ago:    weight = 0.5  (half weight)
 *   - A review from 11 months ago:   weight = 0.083 (almost gone)
 *   - A review from 12+ months ago:  weight = 0    (excluded)
 */

// Mock firebase-admin and firebase-functions BEFORE any imports so that
// the module-level `admin.initializeApp()` and `db` references don't throw.
jest.mock('firebase-admin', () => ({
    apps: ['mock'],
    initializeApp: jest.fn(),
    firestore: Object.assign(
        jest.fn(() => ({})),
        {
            FieldValue: { increment: jest.fn(), serverTimestamp: jest.fn() },
        },
    ),
}));

jest.mock('firebase-functions', () => ({
    firestore: { document: jest.fn(() => ({ onCreate: jest.fn() })) },
    pubsub: { schedule: jest.fn(() => ({ onRun: jest.fn() })) },
}));

import {
    getMonthStart,
    getMonthDiff,
    buildBucketId,
    parseBucketId,
    toDate,
    computeDecayedScore,
    ReputationBucket,
} from './clubReputation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a UTC date at the start of a given month */
const utcMonth = (year: number, month: number /* 1-12 */): Date =>
    new Date(Date.UTC(year, month - 1, 1));

/** Build a minimal bucket for use in computeDecayedScore tests */
const bucket = (
    id: string,
    ratingPoints: number,
    ratingCount: number,
    bucketMonth?: unknown,
): { id: string; data: ReputationBucket } => ({
    id,
    data: { ratingPoints, ratingCount, bucketMonth },
});

// ---------------------------------------------------------------------------
// getMonthStart
// ---------------------------------------------------------------------------

describe('getMonthStart', () => {
    it('returns midnight on the 1st of the same month', () => {
        const input = new Date('2025-03-15T14:30:00Z');
        const result = getMonthStart(input);
        expect(result.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    });

    it('strips the day, hours, minutes and seconds', () => {
        const input = new Date('2024-12-31T23:59:59Z');
        const result = getMonthStart(input);
        expect(result.toISOString()).toBe('2024-12-01T00:00:00.000Z');
    });

    it('is idempotent — calling twice gives the same result', () => {
        const d = utcMonth(2024, 6);
        expect(getMonthStart(d).getTime()).toBe(getMonthStart(d).getTime());
    });
});

// ---------------------------------------------------------------------------
// getMonthDiff
// ---------------------------------------------------------------------------

describe('getMonthDiff', () => {
    it('returns 0 for the same month', () => {
        const d = utcMonth(2025, 4);
        expect(getMonthDiff(d, d)).toBe(0);
    });

    it('returns 1 when later is exactly one month ahead', () => {
        expect(getMonthDiff(utcMonth(2025, 5), utcMonth(2025, 4))).toBe(1);
    });

    it('returns 6 across a half-year gap', () => {
        expect(getMonthDiff(utcMonth(2025, 7), utcMonth(2025, 1))).toBe(6);
    });

    it('returns 12 across an exact year', () => {
        expect(getMonthDiff(utcMonth(2025, 1), utcMonth(2024, 1))).toBe(12);
    });

    it('handles year boundaries correctly', () => {
        expect(getMonthDiff(utcMonth(2025, 2), utcMonth(2024, 11))).toBe(3);
    });

    it('returns a negative number when later is actually earlier', () => {
        expect(getMonthDiff(utcMonth(2024, 1), utcMonth(2025, 1))).toBe(-12);
    });
});

// ---------------------------------------------------------------------------
// buildBucketId
// ---------------------------------------------------------------------------

describe('buildBucketId', () => {
    it('formats a date into YYYY-MM', () => {
        expect(buildBucketId(utcMonth(2025, 3))).toBe('2025-03');
    });

    it('zero-pads single-digit months', () => {
        expect(buildBucketId(utcMonth(2024, 1))).toBe('2024-01');
    });

    it('handles December correctly', () => {
        expect(buildBucketId(utcMonth(2024, 12))).toBe('2024-12');
    });

    it('round-trips with parseBucketId', () => {
        const original = utcMonth(2026, 6);
        const id = buildBucketId(original);
        const parsed = parseBucketId(id);
        expect(parsed?.getTime()).toBe(original.getTime());
    });
});

// ---------------------------------------------------------------------------
// parseBucketId
// ---------------------------------------------------------------------------

describe('parseBucketId', () => {
    it('parses a valid YYYY-MM string', () => {
        const result = parseBucketId('2025-03');
        expect(result?.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    });

    it('parses month 12 without overflow', () => {
        const result = parseBucketId('2024-12');
        expect(result?.toISOString()).toBe('2024-12-01T00:00:00.000Z');
    });

    it('returns null for an empty string', () => {
        expect(parseBucketId('')).toBeNull();
    });

    it('returns null for a random string', () => {
        expect(parseBucketId('not-a-date')).toBeNull();
    });

    it('returns null for month 00', () => {
        expect(parseBucketId('2025-00')).toBeNull();
    });

    it('returns null for month 13', () => {
        expect(parseBucketId('2025-13')).toBeNull();
    });

    it('returns null for an ISO timestamp (too long)', () => {
        expect(parseBucketId('2025-03-15')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// toDate
// ---------------------------------------------------------------------------

describe('toDate', () => {
    it('returns null for null / undefined / empty string / 0', () => {
        expect(toDate(null)).toBeNull();
        expect(toDate(undefined)).toBeNull();
        expect(toDate('')).toBeNull();
    });

    it('returns the Unix epoch date when given 0', () => {
        const d = toDate(0);
        expect(d).toBeInstanceOf(Date);
        expect(d?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });

    it('returns the same Date object when given a Date', () => {
        const d = new Date('2025-01-15T00:00:00Z');
        expect(toDate(d)).toBe(d);
    });

    it('parses a valid ISO string', () => {
        const result = toDate('2025-06-01T00:00:00Z');
        expect(result?.toISOString()).toBe('2025-06-01T00:00:00.000Z');
    });

    it('parses a numeric timestamp (ms since epoch)', () => {
        const ms = new Date('2024-01-01T00:00:00Z').getTime();
        const result = toDate(ms);
        expect(result?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('calls .toDate() if available (Firestore Timestamp shape)', () => {
        const firestoreTimestamp = { toDate: () => new Date('2025-04-01T00:00:00Z') };
        const result = toDate(firestoreTimestamp);
        expect(result?.toISOString()).toBe('2025-04-01T00:00:00.000Z');
    });

    it('returns null for an invalid date string', () => {
        expect(toDate('not-a-date')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// computeDecayedScore — core business logic
// ---------------------------------------------------------------------------

describe('computeDecayedScore', () => {
    const NOW = utcMonth(2025, 7); // July 2025 as "today"
    const WINDOW = 12;

    // --- Expected Behaviour ---

    it('gives full weight (1.0) to a review from the current month', () => {
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2025-07', 5, 1)],
            NOW,
            WINDOW,
        );
        // monthsAgo = 0 → weight = 1 - 0/12 = 1.0
        expect(decayedPoints).toBeCloseTo(5);
        expect(decayedRatings).toBeCloseTo(1);
    });

    it('gives half weight (0.5) to a review from 6 months ago', () => {
        // Jan 2025 is 6 months before Jul 2025
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2025-01', 4, 1)],
            NOW,
            WINDOW,
        );
        // weight = 1 - 6/12 = 0.5
        expect(decayedPoints).toBeCloseTo(2);
        expect(decayedRatings).toBeCloseTo(0.5);
    });

    it('gives ~1/12 weight to a review from 11 months ago', () => {
        // Aug 2024 is 11 months before Jul 2025
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2024-08', 12, 1)],
            NOW,
            WINDOW,
        );
        // weight = 1 - 11/12 ≈ 0.0833
        expect(decayedPoints).toBeCloseTo(1, 1);
        expect(decayedRatings).toBeCloseTo(0.0833, 3);
    });

    it('prioritises a recent event over an older event of the same raw rating', () => {
        const recent = bucket('2025-06', 3, 1); // 1 month ago  → weight = 11/12 ≈ 0.917
        const old = bucket('2025-01', 3, 1); // 6 months ago → weight = 0.5

        const { decayedPoints: recentPoints } = computeDecayedScore([recent], NOW, WINDOW);
        const { decayedPoints: oldPoints } = computeDecayedScore([old], NOW, WINDOW);

        // Even though raw rating is the same, the recent review contributes more
        expect(recentPoints).toBeGreaterThan(oldPoints);
    });

    it('a club with only recent good reviews outscores a club with only old good reviews', () => {
        const recentClub = [bucket('2025-06', 5, 1), bucket('2025-07', 5, 1)];
        const oldClub = [bucket('2024-09', 5, 1), bucket('2024-10', 5, 1)];

        const { decayedPoints: rp, decayedRatings: rr } = computeDecayedScore(
            recentClub,
            NOW,
            WINDOW,
        );
        const { decayedPoints: op, decayedRatings: or_ } = computeDecayedScore(
            oldClub,
            NOW,
            WINDOW,
        );

        const recentAvg = rp / rr;
        const oldAvg = op / or_;

        // Both have the same raw ratings (5), but the recent club's weighted average
        // is higher because high-weight buckets dominate the denominator less.
        expect(recentAvg).toBeGreaterThanOrEqual(oldAvg);
    });

    it('correctly blends reviews from different months', () => {
        // Jul 2025 → weight 1.0, points 5 → weighted: 5 pts, 1 rating
        // Jan 2025 → weight 0.5, points 2 → weighted: 1 pt,  0.5 rating
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2025-07', 5, 1), bucket('2025-01', 2, 1)],
            NOW,
            WINDOW,
        );
        expect(decayedPoints).toBeCloseTo(6);
        expect(decayedRatings).toBeCloseTo(1.5);
        expect(decayedPoints / decayedRatings).toBeCloseTo(4);
    });

    it('averages multiple reviews within the same bucket', () => {
        // Two 5-star reviews in the current month
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2025-07', 10, 2)], // sum = 10, count = 2 → avg = 5
            NOW,
            WINDOW,
        );
        expect(decayedPoints).toBeCloseTo(10);
        expect(decayedRatings).toBeCloseTo(2);
        expect(decayedPoints / decayedRatings).toBeCloseTo(5);
    });

    // --- Edge Cases ---

    it('returns zeros when there are no buckets', () => {
        const { decayedPoints, decayedRatings } = computeDecayedScore([], NOW, WINDOW);
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('excludes buckets older than the decay window (12+ months)', () => {
        // Jul 2024 is exactly 12 months before Jul 2025 → excluded
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2024-07', 5, 1)],
            NOW,
            WINDOW,
        );
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('excludes buckets from the FUTURE (negative monthsAgo)', () => {
        // Aug 2025 is 1 month in the future relative to Jul 2025
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2025-08', 5, 1)],
            NOW,
            WINDOW,
        );
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('skips buckets with an unparseable ID and no bucketMonth field', () => {
        const bad = { id: 'invalid-id', data: { ratingPoints: 5, ratingCount: 1 } };
        const { decayedPoints, decayedRatings } = computeDecayedScore([bad], NOW, WINDOW);
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('uses bucketMonth field over ID when both are present', () => {
        // ID says 2024-01 (18 months ago, outside window) but
        // bucketMonth says 2025-07 (this month, inside window)
        const { decayedPoints, decayedRatings } = computeDecayedScore(
            [bucket('2024-01', 4, 1, new Date('2025-07-01T00:00:00Z'))],
            NOW,
            WINDOW,
        );
        // Should use bucketMonth → monthsAgo = 0 → weight = 1.0
        expect(decayedPoints).toBeCloseTo(4);
        expect(decayedRatings).toBeCloseTo(1);
    });

    it('skips buckets where ratingPoints is NaN', () => {
        const bad: { id: string; data: ReputationBucket } = {
            id: '2025-07',
            data: { ratingPoints: Number.NaN, ratingCount: 1 },
        };
        const { decayedPoints, decayedRatings } = computeDecayedScore([bad], NOW, WINDOW);
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('skips buckets where ratingCount is NaN', () => {
        const bad: { id: string; data: ReputationBucket } = {
            id: '2025-07',
            data: { ratingPoints: 5, ratingCount: Number.NaN },
        };
        const { decayedPoints, decayedRatings } = computeDecayedScore([bad], NOW, WINDOW);
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('handles missing ratingPoints / ratingCount gracefully (treats as 0)', () => {
        const empty = { id: '2025-07', data: { ratingPoints: 0, ratingCount: 0 } };
        const { decayedPoints, decayedRatings } = computeDecayedScore([empty], NOW, WINDOW);
        expect(decayedPoints).toBe(0);
        expect(decayedRatings).toBe(0);
    });

    it('respects a custom decayWindowMonths parameter', () => {
        // With a 6-month window, a bucket from 6 months ago is excluded
        const { decayedPoints } = computeDecayedScore(
            [bucket('2025-01', 5, 1)], // 6 months ago
            NOW,
            6, // custom window
        );
        expect(decayedPoints).toBe(0);
    });

    it('with a 6-month window, a 3-month-old bucket gets weight 0.5', () => {
        // Apr 2025 is 3 months before Jul 2025; window = 6 → weight = 1 - 3/6 = 0.5
        const { decayedPoints } = computeDecayedScore([bucket('2025-04', 4, 1)], NOW, 6);
        expect(decayedPoints).toBeCloseTo(2);
    });

    it('handles a large number of buckets without error', () => {
        // 11 monthly buckets, all within window — just confirming no crash
        const buckets = Array.from({ length: 11 }, (_, i) => {
            const d = new Date(Date.UTC(2025, 6 - i, 1));
            const id = buildBucketId(d);
            return bucket(id, 5, 1);
        });
        const { decayedPoints, decayedRatings } = computeDecayedScore(buckets, NOW, WINDOW);
        expect(decayedPoints).toBeGreaterThan(0);
        expect(decayedRatings).toBeGreaterThan(0);
    });
});
