import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import WebQRScanner from '../components/WebQRScanner';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

const { width } = Dimensions.get('window');

export default function QRScannerScreen({ navigation, route }) {
    const { eventId, eventTitle } = route.params;
    const { user } = useAuth();
    const { theme } = useTheme();

    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { status: 'success' | 'error', message: '' }

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

    const handleBarCodeScanned = async ({ type, data }) => {
        if (scanned) return;
        setScanned(true);

        try {
            // Parse QR code data - it's a JSON object from TicketScreen
            let scannedUserId;
            let ticketData;

            try {
                // Try to parse as JSON first (from TicketScreen)
                ticketData = JSON.parse(data);
                scannedUserId = ticketData.userId;

                // Validate that this ticket is for the current event
                if (ticketData.eventId !== eventId) {
                    setScanResult({
                        status: 'error',
                        message: 'This ticket is for a different event!',
                    });
                    return;
                }
            } catch (_e) {
                // If JSON parsing fails, treat as plain userId string (fallback)
                scannedUserId = data;
            }

            console.log(`Scanned user: ${scannedUserId} for event: ${eventId}`);

            // 1. Verify User
            const userRef = doc(db, 'users', scannedUserId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                setScanResult({ status: 'error', message: 'Invalid User QR Code' });
                return;
            }

            const userData = userSnap.data();

            // 2. CheckIn Logic
            const checkInRef = collection(db, 'events', eventId, 'checkIns');
            await addDoc(checkInRef, {
                userId: scannedUserId,
                userName: userData.name || ticketData?.attendeeName,
                userBranch: userData.branch || ticketData?.branch,
                userYear: userData.year || ticketData?.year,
                checkedInAt: serverTimestamp(),
                checkedBy: user.uid,
                ticketId: ticketData?.ticketId || null,
            });

            // 3. Mark registration as attended (optional, if separate collection)
            const registrationRef = doc(db, 'events', eventId, 'registrations', scannedUserId);
            // Check if registration exists first or just set merge
            await updateDoc(registrationRef, { status: 'attended' }).catch(err =>
                console.log('No reg doc, skipping update'),
            );

            setScanResult({
                status: 'success',
                message: `Checked in ${userData.name || ticketData?.attendeeName}!`,
                user: userData,
            });
        } catch (error) {
            console.error(error);
            setScanResult({ status: 'error', message: 'Check-in failed. Try again.' });
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
});

QRScannerScreen.propTypes = {
    navigation: PropTypes.object,
    route: PropTypes.object,
};
