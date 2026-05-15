export const palette = {
    // Brand Colors - From User Image (Orange/Yellow accents)
    primary: '#FFB74D', // Softer Orange (Less Vibrant)
    primaryVariant: '#F57C00', // Darker Orange
    secondary: '#FFD600', // Bright Yellow (Price tags/Badges)

    // Neutral - Light
    backgroundLight: '#F4F6F8',
    surfaceLight: '#FFFFFF',
    textLight: '#121212',
    textSecondaryLight: '#555555',
    borderLight: '#E0E0E0',

    // Neutral - Dark
    backgroundDark: '#121212',
    surfaceDark: '#1E1E1E',
    textDark: '#FFFFFF',
    textSecondaryDark: '#B0B0B0',
    borderDark: '#333333',

    // Semantic
    success: '#00C853',
    error: '#FF3D00',
    warning: '#FFAB00',
    info: '#2979FF',
};

const typography = {
    h1: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    h2: {
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 0.25,
    },
    h3: {
        fontSize: 18,
        fontWeight: '700',
    },
    body: {
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
    button: {
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    caption: {
        fontSize: 12,
        fontWeight: '500',
    },
};

const shadows = {
    light: {
        default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        small: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
    },
    dark: {
        default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
        },
        small: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 2,
        },
    },
};

export const lightTheme = {
    dark: false,
    colors: {
        background: palette.backgroundLight,
        surface: palette.surfaceLight,
        primary: palette.primary,
        secondary: palette.secondary,
        text: palette.textLight,
        textSecondary: palette.textSecondaryLight,
        border: palette.borderLight,
        error: palette.error,
        success: palette.success,
        warning: palette.warning,
        info: palette.info,
        card: palette.surfaceLight,
        notification: palette.error,
    },
    typography: { ...typography },
    shadows: shadows.light,
    spacing: { s: 8, m: 16, l: 24, xl: 32 },
};

export const darkTheme = {
    dark: true,
    colors: {
        background: palette.backgroundDark,
        surface: palette.surfaceDark,
        primary: palette.primary,
        secondary: palette.secondary,
        text: palette.textDark,
        textSecondary: palette.textSecondaryDark,
        border: palette.borderDark,
        error: palette.error,
        success: palette.success,
        warning: palette.warning,
        info: palette.info,
        card: palette.surfaceDark,
        notification: palette.error,
    },
    typography: { ...typography },
    shadows: shadows.dark,
    spacing: { s: 8, m: 16, l: 24, xl: 32 },
};

// Default export
export const theme = lightTheme;
