import { palette, lightTheme, darkTheme, theme } from '../theme';

describe('Theme Configuration', () => {
    test('palette contains primary color', () => {
        expect(palette.primary).toBe('#FFB74D');
    });

    test('lightTheme should not be dark', () => {
        expect(lightTheme.dark).toBe(false);
    });

    test('darkTheme should be dark', () => {
        expect(darkTheme.dark).toBe(true);
    });

    test('default theme should be lightTheme', () => {
        expect(theme).toEqual(lightTheme);
    });

    test('lightTheme contains spacing values', () => {
        expect(lightTheme.spacing.m).toBe(16);
    });

    test('darkTheme contains typography', () => {
        expect(darkTheme.typography.h1.fontSize).toBe(28);
    });
});
