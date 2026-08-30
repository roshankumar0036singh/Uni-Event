import { parseCsv, parseAttendeeRows, participantIdForEmail } from '../csvImport';

describe('parseCsv', () => {
    it('parses simple rows', () => {
        expect(parseCsv('a,b\nc,d')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });

    it('handles quoted fields with commas and quotes', () => {
        expect(parseCsv('"Doe, Jane",jane@x.com\n"Doe, ""Big"" Jim",jim@x.com')).toEqual([
            ['Doe, Jane', 'jane@x.com'],
            ['Doe, "Big" Jim', 'jim@x.com'],
        ]);
    });

    it('handles CRLF line endings and trailing newline', () => {
        expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });

    it('ignores empty rows', () => {
        expect(parseCsv('a,b\n\n\nc,d\n')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });

    it('returns [] for non-string input', () => {
        expect(parseCsv(null)).toEqual([]);
        expect(parseCsv('')).toEqual([]);
    });
});

describe('parseAttendeeRows', () => {
    const header = [['email', 'name', 'roll']];

    it('parses header + rows', () => {
        const result = parseAttendeeRows([
            ...header,
            ['alice@example.com', 'Alice', 'CS21B001'],
            ['bob@example.com', 'Bob', ''],
        ]);
        expect(result.attendees).toEqual([
            { email: 'alice@example.com', name: 'Alice', rollNumber: 'CS21B001' },
            { email: 'bob@example.com', name: 'Bob', rollNumber: undefined },
        ]);
        expect(result.errors).toEqual([]);
        expect(result.skipped).toBe(0);
    });

    it('treats headerless csv as email-first', () => {
        const result = parseAttendeeRows([
            ['alice@example.com', 'Alice'],
            ['bob@example.com', 'Bob'],
        ]);
        expect(result.attendees).toHaveLength(2);
        expect(result.attendees[0]).toEqual({
            email: 'alice@example.com',
            name: 'Alice',
            rollNumber: undefined,
        });
    });

    it('reports invalid and missing emails as errors', () => {
        const result = parseAttendeeRows([...header, ['not-an-email', 'Nope'], ['', 'No Email']]);
        expect(result.attendees).toHaveLength(0);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('invalid email');
    });

    it('skips duplicates against existing registrations', () => {
        const result = parseAttendeeRows(
            [...header, ['alice@example.com', 'Alice'], ['ALICE@example.com', 'Alice Again']],
            ['alice@example.com'],
        );
        expect(result.attendees).toHaveLength(0);
        expect(result.skipped).toBe(2);
    });

    it('normalizes email case', () => {
        const result = parseAttendeeRows([['CAROL@Example.Com', 'Carol']]);
        expect(result.attendees[0].email).toBe('carol@example.com');
    });

    it('returns empty result for empty input', () => {
        expect(parseAttendeeRows([])).toEqual({ attendees: [], errors: [], skipped: 0 });
    });
});

describe('participantIdForEmail', () => {
    it('is stable and case-insensitive', () => {
        expect(participantIdForEmail('Alice@Example.com')).toBe(
            participantIdForEmail('alice@example.com'),
        );
        expect(participantIdForEmail('x@y.com')).toHaveLength(20);
    });
});
