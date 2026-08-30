/**
 * Dependency-free automated profanity filter (#571).
 *
 * Detects blocked words despite common evasion tricks:
 * - case ("FUCK")
 * - leet digits ("sh1t", "4sshole", "b1tch")
 * - separator padding ("f.u.c.k", "f u c k", "f***k")
 *
 * Matching is token-boundary aware, so words that merely CONTAIN a
 * blocklist substring ("classic" -> "ass") are not flagged.
 */

const LEET_MAP = {
    0: 'o',
    1: 'i',
    2: 'z',
    3: 'e',
    4: 'a',
    5: 's',
    6: 'g',
    7: 't',
    8: 'b',
    9: 'q',
};

export const PROFANITY_WORD_LIST = [
    'asshole',
    'bastard',
    'bitch',
    'bollocks',
    'bullshit',
    'cunt',
    'damn',
    'dickhead',
    'dumbass',
    'fag',
    'fart',
    'fuck',
    'motherfucker',
    'nigga',
    'nigger',
    'piss',
    'prick',
    'pussy',
    'rape',
    'shit',
    'slut',
    'twat',
    'wanker',
    'whore',
];

export const normalizeText = value => {
    if (typeof value !== 'string') return '';
    const digitMapped = value
        .toLowerCase()
        .split('')
        .map(char => (LEET_MAP[char] !== undefined ? LEET_MAP[char] : char))
        .join('');
    return digitMapped.replace(/[^a-z]/g, ' ');
};

const WORD_REGEX_SOURCE = word => word.split('').join('[^a-z]*');

const MATCHERS = PROFANITY_WORD_LIST.map(word => ({
    word,
    regex: new RegExp(`(?<![a-z])${WORD_REGEX_SOURCE(word)}(?![a-z])`),
}));

/**
 * @returns {string|null} the first blocked word found (original casing), or null.
 */
export const findProfanity = value => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const normalized = normalizeText(value);
    for (const { word, regex } of MATCHERS) {
        if (regex.test(normalized)) return word;
    }
    return null;
};

export const containsProfanity = value => findProfanity(value) !== null;

/**
 * Replaces the first matched blocked word with asterisks (keeping the
 * original length, including any separator padding inside the span).
 */
export const maskProfanity = value => {
    if (typeof value !== 'string' || !value) return value;
    const normalized = normalizeText(value);
    for (const { word, regex } of MATCHERS) {
        const match = normalized.match(regex);
        if (!match || typeof match.index !== 'number') continue;
        const targetLetters = match[0].replace(/[^a-z]/g, '').length;
        const prefixLetters = (normalized.slice(0, match.index).match(/[a-z]/g) || []).length;
        let rawStart = -1;
        let rawEnd = -1;
        let lettersSeen = 0;
        for (let i = 0; i < value.length && rawEnd === -1; i += 1) {
            const char = value[i].toLowerCase();
            const mapped = LEET_MAP[char] !== undefined ? LEET_MAP[char] : char;
            if (/[a-z]/.test(mapped)) {
                if (lettersSeen === prefixLetters) rawStart = i;
                lettersSeen += 1;
                if (lettersSeen === prefixLetters + targetLetters) rawEnd = i + 1;
            }
        }
        if (rawStart === -1 || rawEnd === -1) return value;
        return value.slice(0, rawStart) + '*'.repeat(rawEnd - rawStart) + value.slice(rawEnd);
    }
    return value;
};
