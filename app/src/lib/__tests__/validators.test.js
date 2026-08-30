import { validateEventInput, validateProfileInput, isHttpUrl } from './validators';

describe('validateEventInput', () => {
    const baseEvent = {
        title: 'Hackathon 2026',
        description: 'A 24-hour hackathon.',
        startAt: '2026-09-01T10:00:00.000Z',
        endAt: '2026-09-02T10:00:00.000Z',
        price: 0,
        capacity: 100,
        meetLink: 'https://meet.example.com/hack',
        bannerUrl: 'https://img.example.com/banner.png',
    };

    it('accepts a valid event payload', () => {
        expect(validateEventInput(baseEvent)).toEqual({ valid: true, errors: [] });
    });

    it('rejects titles that are too short or too long', () => {
        const short = validateEventInput({ ...baseEvent, title: 'ab' });
        expect(short.valid).toBe(false);
        expect(short.errors[0]).toContain('Title');

        const long = validateEventInput({ ...baseEvent, title: 'x'.repeat(201) });
        expect(long.valid).toBe(false);
    });

    it('rejects missing or oversized descriptions', () => {
        expect(validateEventInput({ ...baseEvent, description: '' }).valid).toBe(false);
        expect(validateEventInput({ ...baseEvent, description: 'x'.repeat(5001) }).valid).toBe(
            false,
        );
    });

    it('rejects invalid dates and end-before-start ordering', () => {
        expect(validateEventInput({ ...baseEvent, startAt: 'not-a-date' }).valid).toBe(false);
        expect(validateEventInput({ ...baseEvent, endAt: '2026-08-01T00:00:00.000Z' }).valid).toBe(
            false,
        );
    });

    it('rejects out-of-range price and capacity', () => {
        expect(validateEventInput({ ...baseEvent, price: -1 }).valid).toBe(false);
        expect(validateEventInput({ ...baseEvent, price: 'free' }).valid).toBe(false);
        expect(validateEventInput({ ...baseEvent, capacity: 0 }).valid).toBe(false);
        expect(validateEventInput({ ...baseEvent, capacity: 1000000 }).valid).toBe(false);
    });

    it('rejects non-https links', () => {
        expect(
            validateEventInput({ ...baseEvent, meetLink: 'http://meet.example.com' }).valid,
        ).toBe(false);
        expect(
            validateEventInput({ ...baseEvent, registrationLink: 'javascript:alert(1)' }).valid,
        ).toBe(false);
    });

    it('allows null capacity and empty links', () => {
        const free = { ...baseEvent, capacity: null, meetLink: undefined };
        expect(validateEventInput(free).valid).toBe(true);
    });
});

describe('validateProfileInput', () => {
    it('accepts a valid profile', () => {
        expect(
            validateProfileInput({
                displayName: 'Ada Lovelace',
                bio: 'Student',
                instagram: 'ada_l',
                linkedin: 'https://linkedin.com/in/ada',
            }),
        ).toEqual({ valid: true, errors: [] });
    });

    it('rejects oversized bio and bad handles', () => {
        expect(validateProfileInput({ bio: 'x'.repeat(601) }).valid).toBe(false);
        expect(validateProfileInput({ instagram: 'bad handle!!' }).valid).toBe(false);
        expect(validateProfileInput({ linkedin: 'linkedin.com/in/ada' }).valid).toBe(false);
    });
});

describe('isHttpUrl', () => {
    it('matches https urls and rejects others', () => {
        expect(isHttpUrl('https://example.com/a')).toBe(true);
        expect(isHttpUrl('http://example.com/a')).toBe(false);
        expect(isHttpUrl('ftp://example.com')).toBe(false);
        expect(isHttpUrl('')).toBe(false);
        expect(isHttpUrl('https://' + 'x'.repeat(2100))).toBe(false);
    });
});
