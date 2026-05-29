import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Share,
    Alert,
} from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import WebQRScanner from '../components/WebQRScanner';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { queueOfflineCheckIn, checkInAttendee, checkInParticipant } from '../lib/checkInService';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

const isNetworkError = error => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === 'unavailable' || message.includes('offline') || message.includes('network')
    );
};

const getOperatorName = user => user?.displayName || user?.name || user?.email || 'Organizer';

const parseScannedTicket = (data, eventId) => {
    let ticketData;

    try {
        ticketData = JSON.parse(data);
    } catch (err) {
        console.error('Invalid QR code JSON format:', err);
        return { errorMessage: 'Invalid QR code format.' };
    }

    if (!ticketData?.userId) {
        return { errorMessage: 'Invalid QR code format.' };
    }

    if (ticketData.eventId !== eventId) {
        return { errorMessage: 'This ticket is for a different event!' };
    }

    return {
        ticketData,
        scannedUserId: ticketData.userId,
    };
};

const getScannedUserData = async (scannedUserId, hasTicketId) => {
    const userRef = doc(db, 'users', scannedUserId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        return { userData: userSnap.data() || {} };
    }

    if (hasTicketId) {
        return { errorMessage: 'Invalid User QR Code' };
    }

    return { userData: {} };
};

const buildCheckInPayload = (ticketData, userData, scannedUserId) => ({
    id: ticketData?.ticketId,
    userId: scannedUserId,
    userName: userData?.name || ticketData?.attendeeName,
    userEmail: userData?.email || ticketData?.attendeeEmail || '',
    userYear: userData?.year || ticketData?.year,
    userBranch: userData?.branch || ticketData?.branch,
    receiverId: scannedUserId,
});

const submitCheckIn = ({ hasTicketId, checkInPayload, eventId, userId, operatorName }) =>
    hasTicketId
        ? checkInAttendee(checkInPayload, eventId, userId, operatorName)
        : checkInParticipant(checkInPayload, eventId, userId, operatorName);

export default function QRScannerScreen({ navigation, route }) {
    const { eventId, eventTitle, eventUrl } = route.params ?? {};
    const { user } = useAuth();
    const { theme } = useTheme();

    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { status: 'success' | 'error', message: '' }
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (Platform.OS !== 'web') {
            (async () => {
                const { status } = await Camera.requestCameraPermissionsAsync();
                setHasPermission(status === 'granted');
            })();
        } else {
            setHasPermission(true); // Web handles permission via browser prompt
        }
    }, []);

    const handleOfflineCheckIn = async (eventId, scannedUserId, ticketData, userData) => {
        const queued = await queueOfflineCheckIn(eventId, {
            userId: scannedUserId,
            userName: userData?.name || ticketData?.attendeeName || 'Guest',
            userEmail: userData?.email || ticketData?.attendeeEmail || '',
            userBranch: userData?.branch || ticketData?.branch || 'N/A',
            userYear: userData?.year || ticketData?.year || 'N/A',
            ticketId: ticketData?.ticketId || null,
        });

        if (!queued) {
            setScanResult({
                status: 'error',
                message: 'Offline — failed to save check-in locally.',
            });
            return;
        }

        setScanResult({
            status: 'success',
            message: `Queued offline check-in for ${userData?.name || ticketData?.attendeeName || 'Guest'}.`,
            user: userData || { name: ticketData?.attendeeName || 'Guest' },
        });
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);

        try {
            const parsedScan = parseScannedTicket(data, eventId);
            if (parsedScan.errorMessage) {
                setScanResult({ status: 'error', message: parsedScan.errorMessage });
                return;
            }

            const { ticketData, scannedUserId } = parsedScan;
            const hasTicketId = Boolean(ticketData?.ticketId);
            const operatorName = getOperatorName(user);

            console.log(`Scanned user: ${scannedUserId} for event: ${eventId}`);

            let userData = {};
            try {
                const userLookup = await getScannedUserData(scannedUserId, hasTicketId);

                if (userLookup.errorMessage) {
                    setScanResult({ status: 'error', message: userLookup.errorMessage });
                    return;
                }

                userData = userLookup.userData;
            } catch (err) {
                if (isNetworkError(err)) {
                    await handleOfflineCheckIn(eventId, scannedUserId, ticketData, null);
                    return;
                }

                if (hasTicketId) {
                    throw err;
                }

                console.warn('User profile unavailable; validating free RSVP participant.');
            }

            try {
                const checkInPayload = buildCheckInPayload(ticketData, userData, scannedUserId);
                const result = await submitCheckIn({
                    hasTicketId,
                    checkInPayload,
                    eventId,
                    userId: user.uid,
                    operatorName,
                });

                if (!result.success) {
                    setScanResult({
                        status: 'error',
                        message: result.message || 'Check-in failed.',
                    });
                    return;
                }

                setScanResult({
                    status: 'success',
                    message:
                        result.message ||
                        `Checked in ${userData.name || ticketData?.attendeeName}!`,
                    user: userData,
                });
            } catch (err) {
                if (isNetworkError(err)) {
                    await handleOfflineCheckIn(eventId, scannedUserId, ticketData, userData);
                    return;
                }
                throw err;
            }
        } catch (error) {
            console.error(error);
            setScanResult({ status: 'error', message: 'Check-in failed. Try again.' });
        }
    };

    const handleCopyLink = async () => {
        if (!eventUrl) {
            Alert.alert('Missing Link', 'Event URL is unavailable.');
            return;
        }
        try {
            await Clipboard.setStringAsync(eventUrl);
            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (error) {
            Alert.alert('Copy Failed', error?.message || 'Unable to copy event link.');
        }
    };

    const handleShare = async () => {
        if (!eventUrl) {
            Alert.alert('Missing Link', 'Event URL is unavailable.');
            return;
        }
        const message = `Join ${eventTitle}\n${eventUrl}`;
        try {
            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({
                        title: eventTitle,
                        text: message,
                        url: eventUrl,
                    });
                } else {
                    await Clipboard.setStringAsync(message);

                    Alert.alert(
                        'Copied!',
                        'Event link copied to clipboard. You can now share it manually.',
                    );
                }

                return;
            }

            await Share.share({
                message,
                url: eventUrl,
                title: eventTitle,
            });
        } catch (error) {
            Alert.alert('Share Failed', error?.message || 'Unable to share event link.');
        }
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <Text>Requesting camera permission...</Text>
            </View>
        );
    }
    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <Text>No access to camera</Text>
            </View>
        );
    }

    return (
        <ScreenWrapper edges={['top', 'bottom']} showLogo={false} style={{ paddingHorizontal: 0 }}>
            <View style={styles.overlayHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scanning: {eventTitle}</Text>
            </View>

            <View style={styles.cameraContainer}>
                {Platform.OS === 'web' ? (
                    <WebQRScanner
                        onScan={data => !scanned && handleBarCodeScanned({ type: 'qr', data })}
                        style={styles.camera}
                    />
                ) : (
                    <Camera
                        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                        style={styles.camera}
                    />
                )}

                <View style={styles.overlayFrame}>
                    <View style={styles.scanFrame} />
                </View>
            </View>

            <View style={styles.shareContainer}>
                <TouchableOpacity
                    style={[styles.shareButton, copied && { backgroundColor: '#0bdd43' }]}
                    onPress={handleCopyLink}
                >
                    <Ionicons name="copy-outline" size={20} color="#fff" />
                    <Text style={styles.shareButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={20} color="#fff" />
                    <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
            </View>

            {/* Result Modal / Feedback */}
            {scanned && (
                <View style={[styles.resultOverlay, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.resultContent}>
                        {scanResult?.status === 'success' ? (
                            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
                        ) : (
                            <Ionicons name="alert-circle" size={60} color="#F44336" />
                        )}

                        <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                            {scanResult?.status === 'success' ? 'Success!' : 'Error'}
                        </Text>

                        <Text style={[styles.resultMessage, { color: theme.colors.textSecondary }]}>
                            {scanResult?.message}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.actionBtn,
                                {
                                    backgroundColor:
                                        scanResult?.status === 'success'
                                            ? '#4CAF50'
                                            : theme.colors.primary,
                                },
                            ]}
                            onPress={() => {
                                setScanned(false);
                                setScanResult(null);
                            }}
                        >
                            <Text style={styles.actionBtnText}>Scan Next</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    cameraContainer: { flex: 1, position: 'relative' },
    camera: { flex: 1, width: width },
    overlayHeader: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowRadius: 4,
    },
    overlayFrame: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    resultOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 30,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    resultContent: { alignItems: 'center' },
    resultTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 10 },
    resultMessage: { fontSize: 16, textAlign: 'center', marginTop: 5, marginBottom: 20 },
    actionBtn: { paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25 },
    actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    shareContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        backgroundColor: '#111',
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#333',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
    },
    shareButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});

QRScannerScreen.propTypes = {
    navigation: PropTypes.object,
    route: PropTypes.object,
};
