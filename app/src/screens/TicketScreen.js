import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
    BackHandler,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../lib/ThemeContext';

const { width } = Dimensions.get('window');

export default function TicketScreen({ route, navigation }) {
    const { ticketId, ticketData } = route.params;
    const { theme } = useTheme();

    // Prevent going back to Payment/Checkout screen. Hardware Back -> Home
    useEffect(() => {
        const backAction = () => {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [navigation]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.successHeader, { marginBottom: 20 }]}>
                    <Ionicons
                        name="checkmark-circle"
                        size={80}
                        color={theme.colors.success || '#4CAF50'}
                    />
                    <Text
                        style={[theme.typography.h2, { color: theme.colors.text, marginTop: 10 }]}
                    >
                        You're Going!
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary }}>Ticket Confirmed</Text>
                </View>

                {/* Ticket Card */}
                <View style={[styles.ticketCard, { shadowColor: theme.colors.primary }]}>
                    <LinearGradient
                        colors={[theme.colors.surface, theme.colors.background]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.glassContainer}
                    >
                        {/* Header Part */}
                        <View style={styles.ticketHeader}>
                            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                                {ticketData.eventTitle}
                            </Text>
                            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
                                {new Date(ticketData.eventDate).toDateString()}
                            </Text>
                            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
                                {ticketData.eventLocation}
                            </Text>
                        </View>

                        {/* QR Code */}
                        <View style={styles.qrContainer}>
                            <QRCode
                                value={JSON.stringify({
                                    ticketId: ticketId || 'unknown',
                                    eventId: ticketData.eventId,
                                    userId: ticketData.userId,
                                    attendeeName: ticketData.userName || 'Guest',
                                    attendeeEmail: ticketData.userEmail || '',
                                    year: ticketData.userYear || 'N/A',
                                    branch: ticketData.userBranch || 'N/A',
                                    timestamp: Date.now(),
                                })}
                                size={180}
                                color="black"
                                backgroundColor="white"
                            />
                            <Text style={[styles.codeText, { color: '#000' }]}>{ticketId}</Text>
                        </View>

                        {/* Footer Part */}
                        <View style={styles.ticketFooter}>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                    Attendee
                                </Text>
                                <Text style={[styles.value, { color: theme.colors.text }]}>
                                    {ticketData.userName}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                    Price
                                </Text>
                                <Text style={[styles.value, { color: theme.colors.primary }]}>
                                    ₹{ticketData.price}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                    Order ID
                                </Text>
                                <Text
                                    style={[
                                        styles.value,
                                        { color: theme.colors.text, fontSize: 12 },
                                    ]}
                                >
                                    {ticketData.orderId}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Punch Holes Effect (Visual) */}
                    <View
                        style={[
                            styles.notch,
                            styles.notchLeft,
                            { backgroundColor: theme.colors.background },
                        ]}
                    />
                    <View
                        style={[
                            styles.notch,
                            styles.notchRight,
                            { backgroundColor: theme.colors.background },
                        ]}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.homeButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() =>
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Main' }],
                        })
                    }
                >
                    <Text style={styles.homeButtonText}>Back to Home</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, alignItems: 'center', paddingTop: 40 },
    successHeader: { alignItems: 'center', marginBottom: 30 },
    ticketCard: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        position: 'relative',
        marginBottom: 30,
    },
    glassContainer: {
        padding: 0,
    },
    ticketHeader: {
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
    },
    eventTitle: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subText: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.8,
        marginBottom: 4,
    },
    qrContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        margin: 20,
        borderRadius: 16,
    },
    codeText: {
        marginTop: 12,
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        opacity: 0.6,
    },
    ticketFooter: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        alignItems: 'center',
    },
    label: { fontSize: 13, textTransform: 'uppercase', opacity: 0.6, fontWeight: '600' },
    value: { fontWeight: '700', fontSize: 16 },
    notch: {
        position: 'absolute',
        top: 320, // Approximate position
        width: 40,
        height: 40,
        borderRadius: 20,
        zIndex: 10,
    },
    notchLeft: { left: -20 },
    notchRight: { right: -20 },
    homeButton: {
        paddingVertical: 18,
        paddingHorizontal: 40,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    homeButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
