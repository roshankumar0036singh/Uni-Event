import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../lib/ThemeContext';
import PremiumInput from '../components/PremiumInput';
import { collection, doc, increment, getDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { useAuth } from '../lib/AuthContext';
import { scheduleEventReminder } from '../lib/notificationService';
import DateTimePicker from '@react-native-community/datetimepicker';

import { getEarlyBirdInfo } from '../lib/earlyBird';
import { buildCounterUpdates, buildPreviewUpdate } from '../lib/eventAnalyticsCounters';
import { formatEventDate } from '../lib/formatEventDate';
import PropTypes from 'prop-types';

export default function EventRegistrationFormScreen({ navigation, route }) {
    const { event } = route.params;
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const [responses, setResponses] = useState({});
    const [loading, setLoading] = useState(false);
    const [datePickers, setDatePickers] = useState({});
    const [showConfetti, setShowConfetti] = useState(false);
    const { width: screenWidth } = Dimensions.get('window');

    useEffect(() => {
        const initial = {};
        event.customFormSchema.forEach(field => {
            initial[field.id] = '';
        });
        setResponses(initial);
    }, [event]);

    const handleChange = (id, value) => {
        setResponses(prev => ({ ...prev, [id]: value }));
    };

    const validate = () => {
        for (const field of event.customFormSchema) {
            if (field.required && !responses[field.id]?.trim()) {
                Alert.alert('Missing Field', `Please fill out "${field.label}"`);
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        // 1. Paid Event Flow -> Navigate to Payment
        if (event.isPaid) {
            const { currentPrice } = getEarlyBirdInfo(event);
            navigation.navigate('Payment', {
                event,
                price: currentPrice,
                formResponses: responses,
            });
            return;
        }

        // 2. Unpaid Event Flow -> Complete RSVP
        setLoading(true);
        try {
            // A. Fetch User Data for Consistent RSVP Record
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};

            let finalEarlyBird = false;
            let freshEvent = null;

            await runTransaction(db, async transaction => {
                // Read the fresh event document securely
                const eventRef = doc(db, 'events', event.id);
                const eventSnap = await transaction.get(eventRef);

                if (!eventSnap.exists()) {
                    throw new Error('Event not found');
                }

                const eventData = eventSnap.data();
                freshEvent = { id: eventSnap.id, ...eventData };

                const participantRef = doc(db, 'events', event.id, 'participants', user.uid);
                const participantSnap = await transaction.get(participantRef);
                if (participantSnap.exists()) {
                    throw new Error('You are already registered for this event.');
                }
                // Determine early bird eligibility based on the real-time data
                let { isEligible: earlyBird } = getEarlyBirdInfo(freshEvent);

                // Enforce capacity limit if the event defines one
                if (earlyBird && freshEvent.earlyBirdCapacity != null) {
                    const currentEarlyBirds = freshEvent.stats?.earlyBirdRegistrations || 0;
                    if (currentEarlyBirds >= freshEvent.earlyBirdCapacity) {
                        earlyBird = false;
                    }
                }

                finalEarlyBird = earlyBird;

                // B. Save Custom Form Responses
                const newRegistrationRef = doc(collection(db, 'registrations'));
                transaction.set(newRegistrationRef, {
                    eventId: event.id,
                    eventId_userId: `${event.id}_${user.uid}`,
                    userId: user.uid,
                    userEmail: user.email,
                    userName: user.displayName,
                    responses: responses,
                    schemaAtSubmission: event.customFormSchema,
                    timestamp: new Date().toISOString(),
                    status: 'confirmed',
                });

                // C. Add to Event Participants
                const participantPayload = {
                    userId: user.uid,
                    name: user.displayName || 'Anonymous',
                    email: user.email,
                    branch: userData.branch || 'Unknown',
                    year: userData.year || 'Unknown',
                    joinedAt: new Date().toISOString(),
                };
                transaction.set(participantRef, participantPayload);

                // D. Add to User's Participating List
                const participatingRef = doc(db, 'users', user.uid, 'participating', event.id);
                transaction.set(participatingRef, {
                    eventId: event.id,
                    joinedAt: new Date().toISOString(),
                });

                // E. Award Points & Early Bird Badge + Analytics Counters
                const userUpdate = { points: increment(10) };
                const eventUpdates = buildCounterUpdates({
                    branch: participantPayload.branch,
                    year: participantPayload.year,
                    delta: 1,
                    eventData,
                });
                const nextPreview = buildPreviewUpdate({
                    eventData,
                    participant: participantPayload,
                    delta: 1,
                });
                eventUpdates.participantsPreview = nextPreview;
                if (earlyBird) {
                    userUpdate.badges = arrayUnion(`early_bird_${event.id}`);

                    // Increment early bird stats to enforce limits on concurrent requests
                    eventUpdates['stats.earlyBirdRegistrations'] = increment(1);
                }

                const userRef = doc(db, 'users', user.uid);
                transaction.set(userRef, userUpdate, { merge: true });
                transaction.update(eventRef, eventUpdates);
            });

            // F. Schedule Reminder
            await scheduleEventReminder(freshEvent || event);

            setShowConfetti(true);
            Alert.alert(
                'Registered! 🎉',
                finalEarlyBird
                    ? 'You earned +10 Points and the 🐦 Early Bird badge for being one of the first to sign up!'
                    : 'You earned +10 Points for registering.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.popToTop(),
                    },
                ],
            );
        } catch (e) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to register.');
        } finally {
            setLoading(false);
        }
    };

    const renderField = field => {
        switch (field.type) {
            case 'text':
            case 'number':
                return (
                    <PremiumInput
                        key={field.id}
                        label={field.label + (field.required ? ' *' : '')}
                        value={responses[field.id] || ''}
                        onChangeText={t => handleChange(field.id, t)}
                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                    />
                );
            case 'dropdown':
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Text style={styles.label}>
                            {field.label + (field.required ? ' *' : '')}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {field.options.map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        responses[field.id] === opt && styles.chipActive,
                                    ]}
                                    onPress={() => handleChange(field.id, opt)}
                                    accessible={true}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${field.label} option ${opt}`}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            responses[field.id] === opt && styles.chipTextActive,
                                        ]}
                                    >
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                );
            case 'date': {
                const currentDate = responses[field.id]
                    ? new Date(responses[field.id])
                    : new Date();
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Text style={styles.label}>
                            {field.label + (field.required ? ' *' : '')}
                        </Text>
                        <TouchableOpacity
                            style={styles.dateBtn}
                            onPress={() => setDatePickers({ ...datePickers, [field.id]: true })}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={`${field.label} date`}
                        >
                            <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
                            <Text style={styles.dateText}>
                                {responses[field.id]
                                    ? formatEventDate(responses[field.id])
                                    : 'Select Date'}
                            </Text>
                        </TouchableOpacity>

                        {datePickers[field.id] && (
                            <DateTimePicker
                                value={currentDate}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setDatePickers({ ...datePickers, [field.id]: false });
                                    if (d) handleChange(field.id, d.toISOString());
                                }}
                            />
                        )}
                    </View>
                );
            }
            default:
                return null;
        }
    };

    return (
        <ScreenWrapper>
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
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Registration</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.subtitle}>Please fill out the form below to register.</Text>

                <View style={styles.form}>{event.customFormSchema.map(renderField)}</View>

                <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Submit Registration"
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitBtnText}>Submit Registration</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
        headerTitle: { fontSize: 24, fontWeight: 'bold', color: theme.colors.text, marginLeft: 10 },
        content: { padding: 20 },
        eventTitle: {
            fontSize: 22,
            fontWeight: 'bold',
            color: theme.colors.primary,
            marginBottom: 5,
        },
        subtitle: { fontSize: 16, color: theme.colors.textSecondary, marginBottom: 25 },

        form: { gap: 15 },
        fieldContainer: { marginBottom: 15 },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: 8,
        },

        chip: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            marginRight: 10,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
        chipText: { color: theme.colors.text, fontWeight: '500' },
        chipTextActive: { color: '#fff', fontWeight: 'bold' },

        dateBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: theme.colors.surface,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        dateText: { color: theme.colors.text },

        submitBtn: {
            backgroundColor: theme.colors.primary,
            padding: 18,
            borderRadius: 16,
            alignItems: 'center',
            marginTop: 30,
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            elevation: 5,
        },
        submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
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

EventRegistrationFormScreen.propTypes = {
    navigation: PropTypes.object,
    route: PropTypes.object,
};
