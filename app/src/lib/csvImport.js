/**
 * CSV bulk attendee import helpers (#559).
 *
 * Hand-rolled RFC-4180-ish parser (quoted fields, embedded commas,
 * CRLF) so no new dependencies are needed in the Expo app.
 */

/** Splits CSV text into rows of cells, handling quoted fields. */
export const parseCsv = text => {
    if (typeof text !== 'string') return [];
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    const flushRow = () => {
        row.push(cell);
        if (row.length > 1 || row[0].trim() !== '') rows.push(row);
        row = [];
        cell = '';
    };

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                cell += '"';
                i += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                cell += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(cell);
            cell = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && next === '\n') i += 1;
            flushRow();
        } else {
            cell += char;
        }
    }

    if (inQuotes) {
        cell += '"';
    }
    if (cell.length > 0 || row.length > 0) {
        flushRow();
    }

    return rows;
};

/**
 * Converts parsed CSV rows into validated attendee records.
 *
 * Accepts headers: email (required), name, rollNumber / roll_no / roll.
 * Rows without a valid email are reported as errors, not silently dropped.
 *
 * @param rows parsed CSV rows (first row treated as header when it
 *   contains 'email')
 * @param existingEmails emails already registered for the event
 * @returns {{ attendees: Array, errors: Array, skipped: number }}
 */
export const parseAttendeeRows = (rows, existingEmails = []) => {
    const attendees = [];
    const errors = [];
    if (!Array.isArray(rows) || rows.length === 0) {
        return { attendees, errors, skipped: 0 };
    }

    const headerRow = rows[0].map(cell => cell.trim().toLowerCase());
    const looksLikeHeader = headerRow.includes('email') || headerRow.includes('e-mail');

    const dataRows = looksLikeHeader ? rows.slice(1) : rows;
    const col = {
        email: looksLikeHeader ? headerRow.indexOf('email') : 0,
        name: looksLikeHeader ? headerRow.findIndex(c => c === 'name' || c === 'full name') : 1,
        roll: looksLikeHeader ? headerRow.findIndex(c => c.includes('roll')) : 2,
    };

    const existing = new Set(existingEmails.map(e => e.trim().toLowerCase()));
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let skipped = 0;

    dataRows.forEach((cells, index) => {
        const email = String(cells[col.email] ?? '')
            .trim()
            .toLowerCase();
        const name = String(cells[col.name] ?? '').trim() || undefined;
        const roll = String(cells[col.roll] ?? '').trim() || undefined;

        if (!email) {
            if (cells.length > 1 || cells[0].trim() !== '') {
                errors.push(`Row ${index + 2}: missing email.`);
            }
            return;
        }
        if (!EMAIL_RE.test(email)) {
            errors.push(`Row ${index + 2}: invalid email "${cells[col.email]}".`);
            return;
        }
        if (existing.has(email)) {
            skipped += 1;
            return;
        }

        attendees.push({ email, name, rollNumber: roll });
        existing.add(email);
    });

    return { attendees, errors, skipped };
};

/** Deterministic participant document id from an email (stable, unique). */
export const participantIdForEmail = email => {
    const input = String(email).trim().toLowerCase();
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
    }
    return ('00000000000000000000' + hash.toString(16)).slice(-20);
};
