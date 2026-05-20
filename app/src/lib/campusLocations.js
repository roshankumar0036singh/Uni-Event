
export const CAMPUS_LOCATIONS = {
    // ── Core Academic Buildings ───────────────────────────────────────────────
    auditorium: { lat: 23.5504, lng: 87.2933 },
    'main auditorium': { lat: 23.5504, lng: 87.2933 },
    'seminar hall': { lat: 23.551, lng: 87.294 },
    'seminar hall a': { lat: 23.551, lng: 87.294 },
    'seminar hall b': { lat: 23.5512, lng: 87.2942 },

    // ── Lecture Halls ─────────────────────────────────────────────────────────
    'lecture hall 1': { lat: 23.5498, lng: 87.2928 },
    'lecture hall 2': { lat: 23.5499, lng: 87.293 },
    'lh 1': { lat: 23.5498, lng: 87.2928 },
    'lh 2': { lat: 23.5499, lng: 87.293 },

    // ── Labs ──────────────────────────────────────────────────────────────────
    'lab 1': { lat: 23.5495, lng: 87.292 },
    'lab 2': { lat: 23.5496, lng: 87.2921 },
    'lab 3': { lat: 23.5497, lng: 87.2922 },
    'computer lab': { lat: 23.5494, lng: 87.2919 },
    'networking lab': { lat: 23.5493, lng: 87.2918 },
    'electronics lab': { lat: 23.5492, lng: 87.2917 },

    // ── Department Buildings ──────────────────────────────────────────────────
    'cse department': { lat: 23.5507, lng: 87.2945 },
    'ece department': { lat: 23.5508, lng: 87.2947 },
    'ee department': { lat: 23.5509, lng: 87.2949 },
    'me department': { lat: 23.5506, lng: 87.2943 },
    'civil department': { lat: 23.5505, lng: 87.2941 },

    // ── Sports & Common ───────────────────────────────────────────────────────
    'sports ground': { lat: 23.552, lng: 87.296 },
    ground: { lat: 23.552, lng: 87.296 },
    'basketball court': { lat: 23.5519, lng: 87.2958 },
    'football ground': { lat: 23.5521, lng: 87.2962 },
    gymnasium: { lat: 23.5518, lng: 87.2956 },

    // ── Admin & Common ────────────────────────────────────────────────────────
    'admin block': { lat: 23.5502, lng: 87.2935 },
    library: { lat: 23.5503, lng: 87.2937 },
    canteen: { lat: 23.5515, lng: 87.295 },
    cafeteria: { lat: 23.5515, lng: 87.295 },
    'main gate': { lat: 23.549, lng: 87.291 },

    // ── Hostels ───────────────────────────────────────────────────────────────
    'boys hostel': { lat: 23.553, lng: 87.297 },
    'girls hostel': { lat: 23.5532, lng: 87.2972 },
    hostel: { lat: 23.553, lng: 87.297 },

    // ── Online fallback (skip in heatmap) ─────────────────────────────────────
    online: null,
    virtual: null,
    zoom: null,
    'google meet': null,
};

/**
 * Resolve a raw location string from Firestore to { lat, lng }.
 *
 * Strategy:
 *   1. Exact match (case-insensitive, trimmed)
 *   2. Partial/contains match (e.g. "Lab 3 - Ground Floor" → "lab 3")
 *   3. Returns null if no match found (caller skips it in heatmap)
 *
 * @param {string} locationString - Raw location string from Firestore event
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveCoordinate(locationString) {
    if (!locationString) return null;

    const normalized = locationString.trim().toLowerCase();

    // 1. Exact match
    if (CAMPUS_LOCATIONS[normalized] !== undefined) {
        return CAMPUS_LOCATIONS[normalized]; // could be null for online
    }

    // 2. Partial match: find any key that is contained in the input string
    const keys = Object.keys(CAMPUS_LOCATIONS);
    for (const key of keys) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return CAMPUS_LOCATIONS[key];
        }
    }

    // 3. No match
    return null;
}

export function getAllCampusLocationNames() {
    return Object.keys(CAMPUS_LOCATIONS).filter(k => CAMPUS_LOCATIONS[k] !== null);
}
