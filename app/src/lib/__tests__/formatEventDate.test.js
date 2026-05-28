import {
    formatEventDate,
    formatEventDateTime,
    formatEventTime,
    toEventDate,
} from '../formatEventDate';

describe('formatEventDate', () => {
    test('formats date values consistently', () => {
        expect(formatEventDate(new Date(2026, 4, 26, 10, 30))).toBe('May 26, 2026');
    });

    test('formats Firestore timestamp-like values', () => {
        const timestamp = {
            toDate: () => new Date(2026, 10, 5, 14, 0),
        };

        expect(formatEventDate(timestamp)).toBe('Nov 5, 2026');
    });

    test('formats event time and date-time consistently', () => {
        const date = new Date(2026, 4, 26, 10, 30);

        expect(formatEventTime(date)).toMatch(/10:30\s?AM/);
        expect(formatEventDateTime(date)).toMatch(/^May 26, 2026 at 10:30\s?AM$/);
    });

    test('returns fallback labels for missing or invalid dates', () => {
        expect(formatEventDate()).toBe('Date TBD');
        expect(formatEventTime('not-a-date')).toBe('Time TBD');
        expect(formatEventDateTime(null)).toBe('Date TBD');
        expect(toEventDate('not-a-date')).toBeNull();
    });
});
