import { containsProfanity, findProfanity, maskProfanity, normalizeText } from './profanity';

describe('normalizeText', () => {
    it('lowercases and maps leet digits', () => {
        expect(normalizeText('SH1T h4cker')).toBe('shit hacker');
    });
    it('collapses separators to spaces', () => {
        expect(normalizeText('f***k f.u.c.k')).toBe('fk f u c k');
    });
    it('handles non-strings', () => {
        expect(normalizeText(undefined)).toBe('');
        expect(normalizeText(42)).toBe('');
    });
});

describe('findProfanity', () => {
    it('detects plain words case-insensitively', () => {
        expect(findProfanity('You are an ASSHOLE!')).toBe('asshole');
        expect(findProfanity('well done')).toBeNull();
    });

    it('detects leet variants', () => {
        expect(findProfanity('sh1t')).toBe('shit');
        expect(findProfanity('4sshole, b1tch')).toBe('asshole');
        expect(findProfanity('b4st4rd')).toBe('bastard');
    });

    it('detects separator padding', () => {
        expect(findProfanity('f.u.c.k')).toBe('fuck');
        expect(findProfanity('F U C K')).toBe('fuck');
        expect(findProfanity('f***k')).toBe('fuck');
    });

    it('does not flag innocent substrings', () => {
        expect(findProfanity('The classic album')).toBeNull();
        expect(findProfanity('grass is green')).toBeNull();
        expect(findProfanity('cucumber salad')).toBeNull();
        expect(findProfanity('pass the salt')).toBeNull();
    });

    it('returns null for empty and non-string input', () => {
        expect(findProfanity('')).toBeNull();
        expect(findProfanity('   ')).toBeNull();
        expect(findProfanity(null)).toBeNull();
    });

    it('containsProfanity mirrors findProfanity', () => {
        expect(containsProfanity('no bad words here')).toBe(false);
        expect(containsProfanity('what the f***')).toBe(true);
    });
});

describe('maskProfanity', () => {
    it('masks the matched word, preserving length', () => {
        expect(maskProfanity('say shit twice')).toBe('say **** twice');
        expect(maskProfanity('FUCK off')).toBe('**** off');
        expect(maskProfanity('a f***k is bad')).toBe('a ***** is bad');
    });

    it('returns input unchanged when clean', () => {
        expect(maskProfanity('hello world')).toBe('hello world');
        expect(maskProfanity('')).toBe('');
        expect(maskProfanity(undefined)).toBe(undefined);
    });
});
