import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import PremiumInput from '../components/PremiumInput'; // Using the existing component
import { useAuth } from '../lib/AuthContext';
import * as CalendarService from '../lib/CalendarService';
import { db, storage } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

const DEFAULT_BANNERS = [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80',
];

const CATEGORIES = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'General'];
const BRANCHES = ['All', 'CSE', 'ETC', 'EE', 'ME', 'Civil'];
const YEARS = [1, 2, 3, 4];

export default function CreateEvent({ navigation, route }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState('');

    // Target
    const [targetBranches, setTargetBranches] = useState(['All']);
    const [targetYears, setTargetYears] = useState([]);

    // Date
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000)); // +1 hour default
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [dateMode, setDateMode] = useState('date');

    // Advanced & Paid
    const [eventMode, setEventMode] = useState('offline'); // 'offline' | 'online'
    const [meetLink, setMeetLink] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const [price, setPrice] = useState('');
    const [upiId, setUpiId] = useState('');
    const [registrationLink, setRegistrationLink] = useState('');
    const [imageUri, setImageUri] = useState(null);

    // Custom Form
    const [useCustomForm, setUseCustomForm] = useState(false);
    const [customFormSchema, setCustomFormSchema] = useState([]);

    // Google Auth
    const { request, response, promptAsync, getAccessToken } = CalendarService.useCalendarAuth();

    useEffect(() => {
        navigation.setOptions({ headerShown: false }); // Hide default header
        if (response?.type === 'success') {
            getAccessToken()
                .then(token => {
                    if (token) handleGenerateMeet(token);
                })
                .catch(e => Alert.alert('Error', e.message));
        }
    }, [response, getAccessToken, handleGenerateMeet, navigation]);

    const handleGenerateMeet = useCallback(
        async token => {
            setLoading(true);
            try {
                const result = await CalendarService.createMeetEvent(token, {
                    title: title || 'New Club Event',
                    description: description || 'Created via Event App',
                    startAt: startDate.toISOString(),
                    endAt: endDate.toISOString(),
                });
                if (result.meetLink) {
                    setMeetLink(result.meetLink);
                    setLocation('Google Meet');
                    Alert.alert('Success', 'Google Meet Link Generated!');
                }
            } catch (e) {
                Alert.alert('Error', e.message);
            } finally {
                setLoading(false);
            }
        },
        [title, description, startDate, endDate],
    );

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });
        if (!result.canceled) setImageUri(result.assets[0].uri);
    };

    const uploadImage = async uri => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = `events/${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const refLink = ref(storage, filename);
        await uploadBytes(refLink, blob);
        return await getDownloadURL(refLink);
    };

    const toggleBranch = b => {
        if (b === 'All') {
            setTargetBranches(['All']);
            return;
        }
        let next = targetBranches.filter(x => x !== 'All');
        if (next.includes(b)) next = next.filter(x => x !== b);
        else next.push(b);
        setTargetBranches(next.length ? next : ['All']);
    };

    const toggleYear = y => {
        if (targetYears.includes(y)) setTargetYears(targetYears.filter(x => x !== y));
        else setTargetYears([...targetYears, y]);
    };

    const { event } = route.params || {};
    const isEditMode = !!event;

    useEffect(() => {
        if (isEditMode) {
            setTitle(event.title);
            setDescription(event.description);
            setCategory(event.category);
            setLocation(event.location || '');
            setTargetBranches(event.target?.departments || ['All']);
            setTargetYears(event.target?.years || []);
            setStartDate(new Date(event.startAt));
            setEndDate(new Date(event.endAt));
            setEventMode(event.eventMode || 'offline');
            setMeetLink(event.meetLink || '');
            setIsPaid(event.isPaid);
            setPrice(event.price?.toString() || '');
            setUpiId(event.upiId || '');
            setRegistrationLink(event.registrationLink || '');
            setImageUri(event.bannerUrl);
            setUseCustomForm(event.hasCustomForm);
            setCustomFormSchema(event.customFormSchema || []);
            navigation.setOptions({ title: 'Edit Event' });
        }
    }, [isEditMode, event, navigation]);

    const handleCreate = async () => {
        if (!title.trim() || !description.trim() || !category) {
            Alert.alert('Missing Info', 'Please fill Title, Description and Category.');
            return;
        }
        if (eventMode === 'offline' && !location.trim()) {
            Alert.alert('Location', 'Please specify a venue.');
            return;
        }
        if (isPaid && (!price || !upiId)) {
            Alert.alert('Payment Info', 'Price and UPI ID are required for paid events.');
            return;
        }

        setLoading(true);
        try {
            let bannerUrl = imageUri;
            if (imageUri && imageUri !== event?.bannerUrl && !imageUri.startsWith('http')) {
                // Only upload if changed and local file
                try {
                    bannerUrl = await uploadImage(imageUri);
                } catch {
                    bannerUrl = DEFAULT_BANNERS[0];
                }
            } else if (!bannerUrl) {
                bannerUrl = DEFAULT_BANNERS[Math.floor(Math.random() * DEFAULT_BANNERS.length)];
            }

            const eventData = {
                title,
                description,
                location,
                category,
                eventMode,
                meetLink: eventMode === 'online' ? meetLink : null,
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString(),
                isPaid,
                price: isPaid ? price : '0',
                upiId: isPaid ? upiId : null,
                registrationLink,
                target: {
                    departments: targetBranches,
                    years: targetYears.length ? targetYears : [1, 2, 3, 4],
                },
                bannerUrl,
                hasCustomForm: useCustomForm,
                customFormSchema: useCustomForm ? customFormSchema : [],
            };

            if (isEditMode) {
                await updateDoc(doc(db, 'events', event.id), eventData);
                Alert.alert('Success', 'Event Updated!');
            } else {
                await addDoc(collection(db, 'events'), {
                    ...eventData,
                    ownerId: user.uid,
                    ownerEmail: user.email,
                    organizerName: user.displayName || 'Club Admin',
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    appealStatus: null,
                });
                Alert.alert('Success', 'Event Created!');
            }

            navigation.goBack();
        } catch (e) {
            console.error(e);
            Alert.alert(
                'Error',
                isEditMode ? 'Failed to update event.' : 'Failed to create event.',
            );
        } finally {
            setLoading(false);
        }
    };

    // Helper to render platform-specific date input
    const renderDateInput = (label, date, setDate, showPicker, setShowPicker, isStart) => {
        if (Platform.OS === 'web') {
            const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);

            return (
                <View style={[styles.webDateContainer, { flex: 1, minWidth: 0 }]}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 8,
                            gap: 6,
                        }}
                    >
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: theme.colors.textSecondary,
                            }}
                        >
                            {label}
                        </Text>
                    </View>
                    <input
                        type="datetime-local"
                        value={iso}
                        onChange={e => setDate(new Date(e.target.value))}
                        style={{
                            padding: 10, // Shortened padding/height slightly
                            borderRadius: 12,
                            border: 'none',
                            backgroundColor: theme.colors.surface,
                            color: theme.colors.text,
                            fontSize: 14, // Slightly smaller font to fit better
                            fontFamily: 'inherit',
                            width: '100%',
                            outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </View>
            );
        }

        return (
            <View style={{ flex: 1 }}>
                <Text style={styles.label}>{label}</Text>
                <TouchableOpacity
                    onPress={() => {
                        setDateMode('date');
                        setShowPicker(true);
                    }}
                    style={styles.dateCard}
                >
                    <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                    <View>
                        <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
                        <Text style={styles.timeText}>
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </TouchableOpacity>

                {showPicker && (
                    <DateTimePicker
                        value={date}
                        mode={dateMode}
                        is24Hour={true}
                        display="default"
                        onChange={(ev, sel) => {
                            setShowPicker(Platform.OS === 'ios');
                            if (sel) {
                                if (dateMode === 'date') {
                                    // Keep original time, change date
                                    const newDate = new Date(sel);
                                    newDate.setHours(date.getHours());
                                    newDate.setMinutes(date.getMinutes());
                                    setDate(newDate);
                                    // Next step: time
                                    setTimeout(() => {
                                        setDateMode('time');
                                        if (Platform.OS === 'android') setShowPicker(true);
                                    }, 100);
                                } else {
                                    setDate(sel);
                                }
                            }
                        }}
                    />
                )}
            </View>
        );
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditMode ? 'Edit Event' : 'Create Event'}</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Banner Picker - Immersive Style */}
                <TouchableOpacity style={styles.bannerPicker} onPress={pickImage}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.bannerImage} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons
                                name="image-outline"
                                size={48}
                                color={theme.colors.textSecondary}
                            />
                            <Text style={styles.placeholderText}>Add Cover Image</Text>
                        </View>
                    )}
                    <View style={styles.editIcon}>
                        <Ionicons name="pencil" size={16} color="#fff" />
                    </View>
                </TouchableOpacity>

                {/* Section 1: Basic Info */}
                <View style={styles.section}>
                    <PremiumInput
                        label="Event Title"
                        placeholder="e.g. Annual Tech Symposium"
                        value={title}
                        onChangeText={setTitle}
                        icon={
                            <Ionicons name="text-outline" size={20} color={theme.colors.primary} />
                        }
                    />

                    <PremiumInput
                        label="Description"
                        placeholder="What is this event about?"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        style={{ height: 120 }} // Taller container for multiline
                        icon={
                            <Ionicons
                                name="document-text-outline"
                                size={20}
                                color={theme.colors.primary}
                            />
                        }
                    />
                </View>

                {/* Section 2: Logistics */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Logistics</Text>

                    {/* Date Grid - Fixed Overlap using Strict Widths */}
                    <View style={[styles.row, { justifyContent: 'space-between' }]}>
                        <View style={{ width: '48%' }}>
                            {renderDateInput(
                                'Starts',
                                startDate,
                                setStartDate,
                                showStartPicker,
                                setShowStartPicker,
                                true,
                            )}
                        </View>
                        <View style={{ width: '48%' }}>
                            {renderDateInput(
                                'Ends',
                                endDate,
                                setEndDate,
                                showEndPicker,
                                setShowEndPicker,
                                false,
                            )}
                        </View>
                    </View>

                    {/* Mode Toggle */}
                    <Text style={[styles.label, { marginTop: 15 }]}>Event Mode</Text>
                    <View style={styles.segmentContainer}>
                        <TouchableOpacity
                            style={[
                                styles.segment,
                                eventMode === 'offline' && styles.segmentActive,
                            ]}
                            onPress={() => setEventMode('offline')}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    eventMode === 'offline' && styles.segmentTextActive,
                                ]}
                            >
                                Offline
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.segment, eventMode === 'online' && styles.segmentActive]}
                            onPress={() => setEventMode('online')}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    eventMode === 'online' && styles.segmentTextActive,
                                ]}
                            >
                                Online
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {eventMode === 'online' ? (
                        <View style={{ marginTop: 15 }}>
                            <PremiumInput
                                label="Meeting Link"
                                placeholder="https://meet.google.com/..."
                                value={meetLink}
                                onChangeText={setMeetLink}
                                icon={
                                    <Ionicons
                                        name="link-outline"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                }
                            />
                            <TouchableOpacity
                                style={styles.gmeetBtn}
                                onPress={() => promptAsync()}
                                disabled={!request}
                            >
                                <Ionicons name="logo-google" size={20} color="#fff" />
                                <Text style={styles.gmeetBtnText}>Auto-Generate Meet Link</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ marginTop: 15 }}>
                            <PremiumInput
                                label="Venue Location"
                                placeholder="e.g. Auditorium / Room 302"
                                value={location}
                                onChangeText={setLocation}
                                icon={
                                    <Ionicons
                                        name="location-outline"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                }
                            />
                        </View>
                    )}
                </View>

                {/* Section 3: Targeting (Chips instead of Dropdowns) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Category & Audience</Text>

                    <Text style={styles.label}>Category</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipScroll}
                    >
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.chip, category === cat && styles.chipActive]}
                                onPress={() => setCategory(cat)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        category === cat && styles.chipTextActive,
                                    ]}
                                >
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={[styles.label, { marginTop: 15 }]}>Target Branches</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipScroll}
                    >
                        {BRANCHES.map(b => (
                            <TouchableOpacity
                                key={b}
                                style={[
                                    styles.chip,
                                    targetBranches.includes(b) && styles.chipActive,
                                ]}
                                onPress={() => toggleBranch(b)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        targetBranches.includes(b) && styles.chipTextActive,
                                    ]}
                                >
                                    {b}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={[styles.label, { marginTop: 15 }]}>Target Years</Text>
                    <View style={[styles.row, { flexWrap: 'wrap', gap: 10 }]}>
                        {YEARS.map(y => (
                            <TouchableOpacity
                                key={y}
                                style={[
                                    styles.yearChip,
                                    targetYears.includes(y) && styles.yearChipActive,
                                ]}
                                onPress={() => toggleYear(y)}
                            >
                                <Text
                                    style={[
                                        styles.yearText,
                                        targetYears.includes(y) && styles.yearTextActive,
                                    ]}
                                >
                                    {y}st Year
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Section 4: Ticketing */}
                <View style={[styles.section, isPaid && styles.highlightSection]}>
                    <View
                        style={[
                            styles.row,
                            { justifyContent: 'space-between', alignItems: 'center' },
                        ]}
                    >
                        <View>
                            <Text style={styles.sectionTitle}>Ticketing</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                Is this a paid event?
                            </Text>
                        </View>
                        <Switch
                            value={isPaid}
                            onValueChange={setIsPaid}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                    </View>

                    {isPaid && (
                        <View style={{ marginTop: 20 }}>
                            <PremiumInput
                                label="Ticket Price (₹)"
                                placeholder="0"
                                value={price}
                                onChangeText={setPrice}
                                keyboardType="numeric"
                                icon={
                                    <Ionicons
                                        name="cash-outline"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                }
                            />
                            <PremiumInput
                                label="UPI ID (for receiving payments)"
                                placeholder="username@upi"
                                value={upiId}
                                onChangeText={setUpiId}
                                autoCapitalize="none"
                                icon={
                                    <Ionicons
                                        name="wallet-outline"
                                        size={20}
                                        color={theme.colors.primary}
                                    />
                                }
                            />
                        </View>
                    )}

                    <View style={{ marginTop: 15 }}>
                        <PremiumInput
                            label="Registration Link (Optional)"
                            placeholder="External form link..."
                            value={registrationLink}
                            onChangeText={setRegistrationLink}
                            icon={
                                <Ionicons
                                    name="globe-outline"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            }
                        />
                    </View>
                </View>

                {/* Section 5: Custom Form */}
                <View style={styles.section}>
                    <View
                        style={[
                            styles.row,
                            { justifyContent: 'space-between', alignItems: 'center' },
                        ]}
                    >
                        <View>
                            <Text style={styles.sectionTitle}>Registration Form</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                Collect specific attendee info?
                            </Text>
                        </View>
                        <Switch
                            value={useCustomForm}
                            onValueChange={setUseCustomForm}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                    </View>

                    {useCustomForm && (
                        <View style={{ marginTop: 15 }}>
                            <TouchableOpacity
                                style={styles.formBuilderBtn}
                                onPress={() =>
                                    navigation.navigate('FormBuilder', {
                                        initialSchema: customFormSchema,
                                        onSave: schema => setCustomFormSchema(schema),
                                    })
                                }
                            >
                                <Ionicons
                                    name="construct-outline"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                                <Text style={styles.formBuilderText}>
                                    {customFormSchema.length > 0
                                        ? `Edit Form (${customFormSchema.length} fields)`
                                        : 'Configure Form'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.createBtn, { opacity: loading ? 0.7 : 1 }]}
                    onPress={handleCreate}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createBtnText}>
                            {isEditMode ? 'Update Event' : 'Create Event'}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
        backBtn: { marginRight: 15 },
        headerTitle: { fontSize: 24, fontWeight: 'bold', color: theme.colors.text },
        scrollContent: { padding: 20, paddingTop: 0 },

        bannerPicker: {
            height: 200,
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            marginBottom: 24,
            overflow: 'hidden',
            borderStyle: 'dashed',
            borderWidth: 1,
            borderColor: theme.colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        bannerImage: { width: '100%', height: '100%' },
        placeholder: { alignItems: 'center', gap: 8 },
        placeholderText: { color: theme.colors.textSecondary, fontWeight: '600' },
        editIcon: {
            position: 'absolute',
            bottom: 10,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 8,
            borderRadius: 20,
        },

        section: { marginBottom: 30 },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 15,
        },

        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: 8,
        },
        row: { flexDirection: 'row' },

        // Date
        dateCard: {
            backgroundColor: theme.colors.surface,
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 60,
        },
        dateText: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
        timeText: { color: theme.colors.textSecondary, fontSize: 12 },
        webDateContainer: { flex: 1, marginBottom: 10, minWidth: 0 },

        // Segment
        segmentContainer: {
            flexDirection: 'row',
            backgroundColor: theme.colors.surface,
            borderRadius: 12,
            padding: 4,
        },
        segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
        segmentActive: { backgroundColor: theme.colors.primary },
        segmentText: { color: theme.colors.textSecondary, fontWeight: '600' },
        segmentTextActive: { color: '#fff', fontWeight: 'bold' },

        // Chips
        chipScroll: { marginBottom: 5 },
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

        yearChip: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            flex: 1,
            minWidth: '45%',
            alignItems: 'center',
        },
        yearChipActive: {
            backgroundColor: theme.colors.secondary,
            borderColor: theme.colors.secondary,
        },
        yearText: { color: theme.colors.text, fontWeight: '600' },
        yearTextActive: { color: '#000' },

        // GMeet
        gmeetBtn: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.colors.primary,
            padding: 14,
            borderRadius: 12,
            marginTop: 10,
        },
        gmeetBtnText: { color: '#fff', fontWeight: 'bold' },

        // Ticketing Highlight
        highlightSection: {
            backgroundColor: theme.colors.surface + '40', // light tint
            borderRadius: 16,
            padding: 15,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },

        createBtn: {
            backgroundColor: theme.colors.primary,
            padding: 18,
            borderRadius: 16,
            alignItems: 'center',
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            elevation: 5,
        },
        createBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

        // Form Builder Btn
        formBuilderBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: theme.colors.surface,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            borderStyle: 'dashed',
        },
        formBuilderText: { color: theme.colors.primary, fontWeight: 'bold' },
    });

CreateEvent.propTypes = {
    navigation: PropTypes.object,
    route: PropTypes.object,
};
