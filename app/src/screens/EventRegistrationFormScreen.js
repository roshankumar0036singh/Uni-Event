import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Vibration, 
    Alert,
    TextInput,
    ActivityIndicator,
} 
    from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../lib/ThemeContext';
import PremiumInput from '../components/PremiumInput';
import { addDoc, collection, setDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { useAuth } from '../lib/AuthContext';
import { scheduleEventReminder } from '../lib/notificationService';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EventRegistrationFormScreen({ navigation, route }) {
    const { event } = route.params;
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const [responses, setResponses] = useState({});
    const [loading, setLoading] = useState(false);
    const [datePickers, setDatePickers] = useState({});

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
        Vibration.vibrate(50); 
        // 1. Paid Event Flow -> Navigate to Payment
        if (event.isPaid) {
            navigation.navigate('Payment', {
                event,
                price: event.price,
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

            // B. Save Custom Form Responses
            await addDoc(collection(db, 'registrations'), {
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
            await setDoc(doc(db, 'events', event.id, 'participants', user.uid), {
                userId: user.uid,
                name: user.displayName || 'Anonymous',
                email: user.email,
                branch: userData.branch || 'Unknown',
                year: userData.year || 'Unknown',
                joinedAt: new Date().toISOString(),
            });

            // D. Add to User's Participating List
            await setDoc(doc(db, 'users', user.uid, 'participating', event.id), {
                eventId: event.id,
                joinedAt: new Date().toISOString(),
            });

            // E. Award Points
            await updateDoc(doc(db, 'users', user.uid), {
                points: increment(10),
            });

            // F. Schedule Reminder
            await scheduleEventReminder(event);

            Alert.alert('Success', 'Registered! (+10 Points)');
            navigation.popToTop();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to register.');
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
            case 'date':
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
                        >
                            <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
                            <Text style={styles.dateText}>
                                {responses[field.id]
                                    ? new Date(responses[field.id]).toLocaleDateString()
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
            default:
                return null;
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
    });
