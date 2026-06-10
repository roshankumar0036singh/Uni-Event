import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { getDoc, doc } from 'firebase/firestore';
import { db, functions } from '../lib/firebaseConfig';
import { getEarlyBirdInfo } from '../lib/earlyBird';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import PaymentSuccessAnimation from '../components/PaymentSuccessAnimation';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../lib/ThemeContext';
import { formatEventDate } from '../lib/formatEventDate';
import PropTypes from 'prop-types';

export default function PaymentScreen({ route, navigation }) {
    const { event, price, formResponses } = route.params;
    const { theme } = useTheme();

    const [loading, setLoading] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [utr, setUtr] = useState('');
    const [showUtrInput, setShowUtrInput] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const { width: screenWidth } = Dimensions.get('window');

    const fetchFreshEvent = async () => {
        const eventSnap = await getDoc(doc(db, 'events', event.id));
        if (!eventSnap.exists()) {
            throw new Error('Event not found');
        }
        return { id: eventSnap.id, ...eventSnap.data() };
    };

    const handlePay = async () => {
        if (!selectedMethod) {
            Alert.alert('Select Payment', 'Please choose a payment method.');
            return;
        }

        if (selectedMethod === 'upi') {
            let paymentEvent = event;
            let paymentPrice;

            try {
                paymentEvent = await fetchFreshEvent();
                let { isEligible: earlyBird } = getEarlyBirdInfo(paymentEvent);
                if (earlyBird && paymentEvent.earlyBirdCapacity != null) {
                    const currentEarlyBirds = paymentEvent.stats?.earlyBirdRegistrations || 0;
                    if (currentEarlyBirds >= paymentEvent.earlyBirdCapacity) {
                        earlyBird = false;
                    }
                }
                paymentPrice =
                    earlyBird && paymentEvent.earlyBirdPrice != null
                        ? paymentEvent.earlyBirdPrice
                        : (paymentEvent.price ?? price ?? 0);
            } catch (error) {
                Alert.alert('Error', error.message || 'Unable to fetch event details.');
                return;
            }

            if (!paymentEvent.upiId) {
                Alert.alert(
                    'Error',
                    'Event Organizer has not provided a UPI ID. Please contact them.',
                );
                return;
            }
            const upiUrl = `upi://pay?pa=${paymentEvent.upiId}&pn=${encodeURIComponent(paymentEvent.organization || 'Event Organizer')}&tn=Event_${paymentEvent.id}&am=${paymentPrice}&cu=INR`;

            Linking.canOpenURL(upiUrl)
                .then(supported => {
                    if (supported) {
                        Linking.openURL(upiUrl);
                        setShowUtrInput(true);
                        Alert.alert(
                            'Payment Initiated',
                            'Please complete payment in your UPI app and enter the Transaction ID/UTR below to verify.',
                        );
                    } else {
                        Alert.alert(
                            'Error',
                            'No UPI App found. Please pay manually to ' + event.upiId,
                        );
                        setShowUtrInput(true);
                    }
                })
                .catch(err => {
                    Alert.alert('Error', 'Could not open UPI app.');
                    setShowUtrInput(true);
                });
            return;
        }

        // Mock Cards / Netbanking
        processTicketBooking('MOCK-CARD-' + Date.now());
    };

    const verifyAndBook = () => {
        if (!utr || utr.length < 10) {
            Alert.alert('Invalid UTR', 'Please enter a valid 12-digit UPI Transaction ID.');
            return;
        }
        processTicketBooking(utr);
    };

    const processTicketBooking = transactionId => {
        setLoading(true);

        // Simulate Validation Delay
        setTimeout(async () => {
            try {
                const orderId = transactionId || 'ORD-' + Date.now();

                const finalizeTicketPayment = httpsCallable(functions, 'finalizeTicketPayment');
                const result = await finalizeTicketPayment({
                    eventId: event.id,
                    transactionId: orderId,
                    selectedMethod: selectedMethod,
                    formResponses: formResponses,
                    expectedPrice: price,
                });

                const { earlyBird: finalEarlyBird, ticketId, ticketData } = result.data;

                setLoading(false);

                // Show success animation (badge info surfaced via ticketData so TicketScreen can display it)
                setShowSuccessAnimation(true);
                setShowConfetti(true);

                // Navigate to ticket after animation completes
                setTimeout(() => {
                    navigation.replace('TicketScreen', {
                        ticketId: ticketId,
                        ticketData,
                        earlyBirdEarned: finalEarlyBird,
                    });
                }, 2500);
            } catch (error) {
                console.error('Payment Error:', error);
                setLoading(false);
                Alert.alert('Payment Failed', 'Something went wrong. Please try again.');
            }
        }, 2000);
    };

    return (
        <>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Text
                        style={[
                            theme.typography.h2,
                            { color: theme.colors.text, marginBottom: 20 },
                        ]}
                    >
                        Checkout
                    </Text>

                    {/* Event Summary */}
                    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                            {event.title}
                        </Text>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: 10 }}>
                            {formatEventDate(event.startAt)} • {event.location}
                        </Text>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <Text style={{ color: theme.colors.text }}>General Admission</Text>
                            <Text style={[styles.price, { color: theme.colors.text }]}>
                                ₹{price}
                            </Text>
                        </View>
                        <View style={[styles.row, { marginTop: 10 }]}>
                            <Text style={{ color: theme.colors.textSecondary }}>Tax & Fees</Text>
                            <Text style={{ color: theme.colors.textSecondary }}>₹0</Text>
                        </View>
                        <View style={[styles.divider, { marginVertical: 15 }]} />
                        <View style={styles.row}>
                            <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
                                Total to Pay
                            </Text>
                            <Text style={[styles.totalAmount, { color: theme.colors.primary }]}>
                                ₹{price}
                            </Text>
                        </View>
                    </View>

                    {/* Payment Methods */}
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                        Payment Method
                    </Text>
                    <PaymentMethod
                        id="upi"
                        label="UPI / GPay / PhonePe"
                        icon="qr-code-outline"
                        selectedMethod={selectedMethod}
                        setSelectedMethod={setSelectedMethod}
                        setShowUtrInput={setShowUtrInput}
                    />
                    {selectedMethod === 'upi' && showUtrInput && (
                        <View
                            style={{
                                marginTop: 10,
                                padding: 15,
                                backgroundColor: theme.colors.surface,
                                borderRadius: 12,
                            }}
                        >
                            <Text style={{ color: theme.colors.textSecondary, marginBottom: 5 }}>
                                Enter UPI Transaction ID / UTR:
                            </Text>
                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: theme.colors.border,
                                    borderRadius: 8,
                                    padding: 10,
                                    color: theme.colors.text,
                                    marginBottom: 10,
                                }}
                                value={utr}
                                onChangeText={setUtr}
                                placeholder="e.g. 123456789012"
                                placeholderTextColor={theme.colors.textSecondary}
                            />
                            <TouchableOpacity
                                style={{
                                    backgroundColor: theme.colors.primary,
                                    padding: 10,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                }}
                                onPress={verifyAndBook}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                        Verify & Book Ticket
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                    <PaymentMethod
                        id="card"
                        label="Credit / Debit Card"
                        icon="card-outline"
                        selectedMethod={selectedMethod}
                        setSelectedMethod={setSelectedMethod}
                        setShowUtrInput={setShowUtrInput}
                    />
                    <PaymentMethod
                        id="netbanking"
                        label="Net Banking"
                        icon="globe-outline"
                        selectedMethod={selectedMethod}
                        setSelectedMethod={setSelectedMethod}
                        setShowUtrInput={setShowUtrInput}
                    />
                </ScrollView>

                {/* Footer */}
                <View
                    style={[
                        styles.footer,
                        {
                            borderTopColor: theme.colors.border,
                            backgroundColor: theme.colors.surface,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.payButton,
                            { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
                        ]}
                        onPress={handlePay}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.payButtonText}>Pay ₹{price}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {showConfetti && (
                <View pointerEvents="none" style={styles.confettiOverlay}>
                    <ConfettiCannon
                        count={120}
                        origin={{ x: screenWidth / 2, y: 0 }}
                        fadeOut
                        autoStart
                        onAnimationEnd={() => setShowConfetti(false)}
                    />
                </View>
            )}

            {/* Success Animation */}
            <PaymentSuccessAnimation
                visible={showSuccessAnimation}
                onComplete={() => setShowSuccessAnimation(false)}
                amount={price}
            />
        </>
    );
}

const PaymentMethod = ({ id, label, icon, selectedMethod, setSelectedMethod, setShowUtrInput }) => {
    const { theme } = useTheme();
    return (
        <TouchableOpacity
            style={[
                styles.methodCard,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: selectedMethod === id ? theme.colors.primary : theme.colors.border,
                    borderWidth: selectedMethod === id ? 2 : 1,
                },
            ]}
            onPress={() => {
                setSelectedMethod(id);
                setShowUtrInput(false);
            }}
        >
            <Ionicons
                name={icon}
                size={24}
                color={selectedMethod === id ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.methodLabel, { color: theme.colors.text }]}>{label}</Text>
            {selectedMethod === id && (
                <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.primary}
                    style={{ marginLeft: 'auto' }}
                />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    summaryCard: {
        padding: 20,
        borderRadius: 16,
        marginBottom: 30,
        elevation: 2,
    },
    eventTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    price: { fontWeight: '600', fontSize: 16 },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalAmount: { fontSize: 24, fontWeight: '900' },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 10,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        gap: 15,
    },
    methodLabel: { fontSize: 16, fontWeight: '500' },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    payButton: {
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    confettiOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        elevation: 999,
    },
});

PaymentScreen.propTypes = {
    route: PropTypes.object,
    navigation: PropTypes.object,
};
PaymentMethod.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    selectedMethod: PropTypes.string,
    setSelectedMethod: PropTypes.func.isRequired,
    setShowUtrInput: PropTypes.func.isRequired,
};
