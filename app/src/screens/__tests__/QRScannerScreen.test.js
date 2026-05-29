import React from 'react';
import { Platform } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { Camera } from 'expo-camera';
import { getDoc } from 'firebase/firestore';
import { checkInAttendee, checkInParticipant, queueOfflineCheckIn } from '../../lib/checkInService';
import QRScannerScreen from '../QRScannerScreen';

let mockOnBarCodeScanned;

jest.mock('../../lib/checkInService', () => ({
    queueOfflineCheckIn: jest.fn(),
    checkInAttendee: jest.fn(),
    checkInParticipant: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn(),
    getStringAsync: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { Text } = require('react-native');

    const MockIcon = ({ name }) => React.createElement(Text, null, name);
    MockIcon.propTypes = {
        name: PropTypes.string,
    };

    return {
        Ionicons: MockIcon,
    };
});

jest.mock('expo-camera', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const { View } = require('react-native');

    const MockCamera = props => {
        mockOnBarCodeScanned = props.onBarCodeScanned;
        return React.createElement(View, { testID: 'camera' });
    };
    MockCamera.propTypes = {
        onBarCodeScanned: PropTypes.func,
    };

    MockCamera.requestCameraPermissionsAsync = jest.fn(() =>
        Promise.resolve({
            status: 'denied',
        }),
    );

    return { Camera: MockCamera };
});

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
            displayName: 'Organizer User',
        },
    }),
}));

jest.mock('../../lib/ThemeContext', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                surface: '#fff',
                background: '#fff',
                text: '#000',
                textSecondary: '#666',
                primary: '#000',
            },
            spacing: {
                m: 16,
            },
        },
        interpolateThemeColor: lightColor => lightColor,
    }),
}));

const originalPlatform = Platform.OS;

beforeAll(() => {
    Platform.OS = 'android';
});

afterAll(() => {
    Platform.OS = originalPlatform;
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockOnBarCodeScanned = undefined;
    Camera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied',
    });
});

afterEach(() => {
    jest.restoreAllMocks();
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

    it('routes ticketless QR payloads to participant check-in', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        Camera.requestCameraPermissionsAsync.mockResolvedValueOnce({
            status: 'granted',
        });
        getDoc.mockResolvedValueOnce({
            exists: () => false,
        });
        checkInParticipant.mockResolvedValueOnce({
            success: true,
            message: 'Checked in successfully!',
        });

        const route = {
            params: {
                eventId: '1',
                eventTitle: 'Test Event',
            },
        };

        const navigation = {
            goBack: jest.fn(),
        };

        const { getByTestId } = render(<QRScannerScreen navigation={navigation} route={route} />);

        await waitFor(() => {
            expect(getByTestId('camera')).toBeTruthy();
            expect(mockOnBarCodeScanned).toEqual(expect.any(Function));
        });

        await act(async () => {
            await mockOnBarCodeScanned({
                type: 'qr',
                data: JSON.stringify({
                    eventId: '1',
                    userId: 'attendee-1',
                    attendeeName: 'QR Name',
                    attendeeEmail: 'qr@example.com',
                }),
            });
        });

        await waitFor(() => {
            expect(checkInParticipant).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: undefined,
                    userId: 'attendee-1',
                    userName: 'QR Name',
                    userEmail: 'qr@example.com',
                }),
                '1',
                '123',
                'Organizer User',
            );
        });
        expect(checkInAttendee).not.toHaveBeenCalled();
        expect(queueOfflineCheckIn).not.toHaveBeenCalled();
    });
});
