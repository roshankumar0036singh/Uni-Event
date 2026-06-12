import React from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Camera } from 'expo-camera';
import { getDoc } from 'firebase/firestore';
import { checkInAttendee, checkInParticipant, queueOfflineCheckIn } from '../../lib/checkInService';
import QRScannerScreen from '../QRScannerScreen';

let mockOnBarCodeScanned;
let mockAppStateChange;

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

    const MockCameraView = props => {
        mockOnBarCodeScanned = props.onBarcodeScanned;
        return React.createElement(View, { testID: 'camera' });
    };
    MockCameraView.propTypes = {
        onBarcodeScanned: PropTypes.func,
    };

    const MockCamera = {
        requestCameraPermissionsAsync: jest.fn(() =>
            Promise.resolve({
                status: 'denied',
            }),
        ),
        getCameraPermissionsAsync: jest.fn(() =>
            Promise.resolve({
                status: 'denied',
            }),
        ),
    };

    return {
        Camera: MockCamera,
        CameraView: MockCameraView,
    };
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
    mockAppStateChange = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
        mockAppStateChange = callback;
        return { remove: jest.fn() };
    });
    Camera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
    });
    Camera.getCameraPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('QRScannerScreen', () => {
    it('allows retrying when camera permission can be requested again', async () => {
        Camera.requestCameraPermissionsAsync
            .mockResolvedValueOnce({
                status: 'denied',
                granted: false,
                canAskAgain: true,
            })
            .mockResolvedValueOnce({
                status: 'granted',
                granted: true,
                canAskAgain: true,
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

        const { getByText, getByTestId } = render(
            <QRScannerScreen navigation={navigation} route={route} />,
        );

        await waitFor(() => {
            expect(getByText('Try Again')).toBeTruthy();
        });

        fireEvent.press(getByText('Try Again'));

        await waitFor(() => {
            expect(Camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(2);
            expect(getByTestId('camera')).toBeTruthy();
        });
    });

    it('opens device settings when camera permission cannot be requested again', async () => {
        Camera.requestCameraPermissionsAsync.mockResolvedValueOnce({
            status: 'denied',
            granted: false,
            canAskAgain: false,
        });
        jest.spyOn(Linking, 'openSettings').mockResolvedValue();

        const navigation = {
            goBack: jest.fn(),
        };
        const route = {
            params: {
                eventId: '1',
                eventTitle: 'Test Event',
            },
        };

        const { getByText, queryByText } = render(
            <QRScannerScreen navigation={navigation} route={route} />,
        );

        await waitFor(() => {
            expect(getByText('Open Settings')).toBeTruthy();
            expect(queryByText('Try Again')).toBeNull();
        });

        fireEvent.press(getByText('Open Settings'));
        expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    });

    it('refreshes camera permission after returning from device settings', async () => {
        Camera.requestCameraPermissionsAsync.mockResolvedValueOnce({
            status: 'denied',
            granted: false,
            canAskAgain: false,
        });
        Camera.getCameraPermissionsAsync.mockResolvedValueOnce({
            status: 'granted',
            granted: true,
            canAskAgain: true,
        });

        const navigation = {
            goBack: jest.fn(),
        };
        const route = {
            params: {
                eventId: '1',
                eventTitle: 'Test Event',
            },
        };

        const { getByText, getByTestId } = render(
            <QRScannerScreen navigation={navigation} route={route} />,
        );

        await waitFor(() => {
            expect(getByText('Open Settings')).toBeTruthy();
        });

        act(() => {
            mockAppStateChange('background');
            mockAppStateChange('active');
        });

        await waitFor(() => {
            expect(Camera.getCameraPermissionsAsync).toHaveBeenCalledTimes(1);
            expect(getByTestId('camera')).toBeTruthy();
        });
    });

    it('recovers from a failed camera permission request', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        Camera.requestCameraPermissionsAsync
            .mockRejectedValueOnce(new Error('Permission request failed'))
            .mockResolvedValueOnce({
                status: 'granted',
                granted: true,
                canAskAgain: true,
            });

        const navigation = {
            goBack: jest.fn(),
        };
        const route = {
            params: {
                eventId: '1',
                eventTitle: 'Test Event',
            },
        };

        const { getByText, getByTestId } = render(
            <QRScannerScreen navigation={navigation} route={route} />,
        );

        await waitFor(() => {
            expect(getByText('Try Again')).toBeTruthy();
        });

        fireEvent.press(getByText('Try Again'));

        await waitFor(() => {
            expect(getByTestId('camera')).toBeTruthy();
        });
    });

    it('routes ticketless QR payloads to participant check-in', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        Camera.requestCameraPermissionsAsync.mockResolvedValueOnce({
            status: 'granted',
            granted: true,
            canAskAgain: true,
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
