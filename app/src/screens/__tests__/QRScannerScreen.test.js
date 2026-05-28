import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import QRScannerScreen from '../QRScannerScreen';

jest.mock('../../lib/checkInService', () => ({
    queueOfflineCheckIn: jest.fn(),
    checkInAttendee: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn(),
    getStringAsync: jest.fn(),
}));

jest.mock('expo-camera', () => ({
    Camera: {
        requestCameraPermissionsAsync: jest.fn(() =>
            Promise.resolve({
                status: 'denied',
            }),
        ),
    },
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
}));

jest.mock('../../lib/firebaseConfig', () => ({
    db: {},
}));

jest.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        user: {
            uid: '123',
        },
    }),
}));

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                surface: '#fff',
                text: '#000',
                textSecondary: '#666',
                primary: '#000',
            },
        },
    }),
}));

const originalPlatform = Platform.OS;

beforeAll(() => {
    Platform.OS = 'android';
});

afterAll(() => {
    Platform.OS = originalPlatform;
});

describe('QRScannerScreen', () => {
    it('shows no camera access message when permission denied', async () => {
        const route = {
            params: {
                eventId: '1',
                eventTitle: 'Test Event',
            },
        };

        const navigation = {
            goBack: jest.fn(),
        };

        const { getByText } = render(<QRScannerScreen navigation={navigation} route={route} />);

        await waitFor(() => {
            expect(getByText(/no access to camera/i)).toBeTruthy();
        });
    });
});
