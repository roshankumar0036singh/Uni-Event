import { getReadTime } from '../readTimeEstimator';

describe('Read Time Estimator', () => {
    test('returns 0 for null, undefined, or non-string inputs', () => {
        expect(getReadTime(null)).toBe(0);
        expect(getReadTime(undefined)).toBe(0);
        expect(getReadTime(123)).toBe(0);
        expect(getReadTime('')).toBe(0);
        expect(getReadTime('   ')).toBe(0);
    });

    test('returns 1 minute for a short sentence', () => {
        expect(getReadTime('Hello world! This is a simple test.')).toBe(1);
    });

    test('returns 1 minute for exactly 200 words at default speed', () => {
        const text = Array(200).fill('word').join(' ');
        expect(getReadTime(text)).toBe(1);
    });

    test('rounds up to 2 minutes for 201 words at default speed', () => {
        const text = Array(201).fill('word').join(' ');
        expect(getReadTime(text)).toBe(2);
    });

    test('respects a custom WPM rate', () => {
        const text = Array(150).fill('word').join(' ');
        // 150 words at 100 WPM should be 2 minutes
        expect(getReadTime(text, 100)).toBe(2);
    });
});
