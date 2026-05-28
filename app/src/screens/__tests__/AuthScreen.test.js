import React from 'react';
import { render } from '@testing-library/react-native';
import AuthScreen from '../AuthScreen';

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    return {
        Ionicons: () => React.createElement('Icon'),
    };
});

jest.mock('expo-font', () => ({
    isLoaded: jest.fn(() => true),
    loadAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
    makeRedirectUri: jest.fn(() => 'mock-redirect-uri'),
}));

jest.mock('expo-auth-session/providers/google', () => ({
    useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));

jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => ({
    LinearGradient: ({ children }) => children,
}));

jest.mock('firebase/auth', () => ({
    GoogleAuthProvider: {
        credential: jest.fn(),
    },
    signInWithCredential: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
}));

jest.mock('../../lib/firebaseConfig', () => ({
    auth: {},
    db: {},
}));

jest.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        signIn: jest.fn(),
        signUp: jest.fn(),
        saveGoogleAccountCredentials: jest.fn(),
    }),
}));

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                background: '#fff',
                surface: '#fff',
                text: '#000',
                textSecondary: '#666',
                primary: '#000',
                border: '#ddd',
                error: '#f00',
            },
        },
    }),
}));

describe('AuthScreen', () => {
    it('renders login screen', () => {
        const { getAllByText } = render(<AuthScreen />);
        expect(getAllByText(/sign in/i).length).toBeGreaterThan(0);
    });
});
