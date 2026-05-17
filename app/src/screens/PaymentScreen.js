import { Ionicons } from '@expo/vector-icons';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    arrayUnion,
} from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

import { getEarlyBirdInfo } from '../lib/earlyBird';

export default function PaymentScreen({ route, navigation }) {
    const { event, price, formResponses } = route.params;
    const { user } = useAuth();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [utr, setUtr] = useState('');
    const [showUtrInput, setShowUtrInput] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

    const handlePay = async () => {
        if (!selectedMethod) {
            Alert.alert('Select Payment', 'Please choose a payment method.');
            return;
        }

        if (selectedMethod === 'upi') {
            if (!event.upiId) {
                Alert.alert(
                    'Error',
                    'Event Organizer has not provided a UPI ID. Please contact them.',
                );
                return;
            }
            const upiUrl = `upi://pay?pa=${event.upiId}&pn=${encodeURIComponent(event.organization || 'Event Organizer')}&tn=Event_${event.id}&am=${price}&cu=INR`;

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
                // 1. Create Order ID (Mock or UTR)
                const orderId = transactionId || 'ORD-' + Date.now();

                // ... (rest of logic same) -> will inject confirm in separate chunks or rewrite processTicketBooking

                // 2. Fetch user data for year and branch
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};

                // 3. Generate Ticket Data
                const ticketData = {
                    eventId: event.id,
                    eventTitle: event.title,
                    eventDate: event.startAt,
                    eventLocation: event.location,
                    userId: user.uid,
                    userName: user.displayName || 'Guest',
                    userEmail: user.email,
                    userYear: userData.year || 'N/A',
                    userBranch: userData.branch || 'N/A',
                    price: price,
                    status: 'paid', // 'paid', 'cancelled'
                    orderId: orderId,
                    paymentMethod: selectedMethod,
                    purchasedAt: new Date().toISOString(),
                };

                // 3. Save to Firestore
                // Add to Global Tickets collection (for validation)
                const ticketRef = await addDoc(collection(db, 'tickets'), ticketData);

                // Add to User's Participating list
                await setDoc(doc(db, 'users', user.uid, 'participating', event.id), {
                    eventId: event.id,
                    joinedAt: new Date().toISOString(),
                    role: 'attendee',
                    ticketId: ticketRef.id,
                    status: 'paid',
                });

                // Add to Event's Participants list
                await setDoc(doc(db, 'events', event.id, 'participants', user.uid), {
                    userId: user.uid,
                    name: user.displayName,
                    email: user.email,
                    joinedAt: new Date().toISOString(),
                    ticketId: ticketRef.id,
                    status: 'paid',
                });

                // 4. Save Custom Form Responses (if any)
                if (formResponses) {
                    await addDoc(collection(db, 'registrations'), {
                        eventId: event.id,
                        eventId_userId: `${event.id}_${user.uid}`,
                        userId: user.uid,
                        userEmail: user.email,
                        userName: user.displayName,
                        responses: formResponses,
                        schemaAtSubmission: event.customFormSchema || [],
                        ticketId: ticketRef.id,
                        timestamp: new Date().toISOString(),
                        status: 'paid',
                    });
                }

                // 5. Award Points & Early Bird Badge
                const { isEligible: earlyBird } = getEarlyBirdInfo(event);
                const userUpdate = { points: increment(10) };
                if (earlyBird) {
                    userUpdate.badges = arrayUnion(`early_bird_${event.id}`);
                }
                await updateDoc(doc(db, 'users', user.uid), userUpdate);

                setLoading(false);

                // Show success animation (badge info surfaced via ticketData so TicketScreen can display it)
                setShowSuccessAnimation(true);

                // Navigate to ticket after animation completes
                setTimeout(() => {
                    navigation.replace('TicketScreen', {
                        ticketId: ticketRef.id,
                        ticketData,
                        earlyBirdEarned: earlyBird,
                    });
                }, 2500);
            } catch (error) {
                console.error('Payment Error:', error);
                setLoading(false);
                Alert.alert('Payment Failed', 'Something went wrong. Please try again.');
            }
        }, 2000);
    };

    const PaymentMethod = ({ id, label, icon }) => (
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
                            {new Date(event.startAt).toDateString()} • {event.location}
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
                    <PaymentMethod id="upi" label="UPI / GPay / PhonePe" icon="qr-code-outline" />
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
                    <PaymentMethod id="card" label="Credit / Debit Card" icon="card-outline" />
                    <PaymentMethod id="netbanking" label="Net Banking" icon="globe-outline" />
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

            {/* Success Animation */}
            <PaymentSuccessAnimation
                visible={showSuccessAnimation}
                onComplete={() => setShowSuccessAnimation(false)}
                amount={price}
            />
        </>
    );
}

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
});
