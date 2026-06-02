/**
 * @file EventCard.js
 * @description Enterprise-grade, highly responsive event card component.
 * Features dynamic aspect ratio scaling (Issue #305), comprehensive accessibility,
 * and robust prop validation.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useState, memo, useCallback } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Switch,
    Platform,
    ActivityIndicator,
    AccessibilityInfo,
} from 'react-native';
import PropTypes from 'prop-types';

import { db } from '../lib/firebaseConfig';
import { theme as globalTheme } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { getEarlyBirdInfo } from '../lib/earlyBird';
import { ShimmerItem } from './SkeletonLoader';
import { useAuth } from '../lib/AuthContext';
import { triggerBuddyMatchNotification } from '../lib/notificationService';
import { formatEventDate, formatEventTime } from '../lib/formatEventDate';
import { safeToggleEventAction } from '../lib/participantService';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats numeric metrics to prevent grammatical errors (e.g., "1 Views").
 * @param {number} count - The raw numerical count.
 * @param {string} singular - The singular text form.
 * @param {string} plural - The plural text form.
 * @returns {string} The formatted string.
 */
const formatMetric = (count, singular, plural) => {
    const value = count || 0;
    return `${value} ${value === 1 ? singular : plural}`;
};

// ============================================================================
// SUB-COMPONENTS (Extracted for readability and performance)
// ============================================================================

/**
 * Renders the category badge overlapping the banner.
 */
const CategoryBadge = memo(({ category, theme }) => (
    <View style={[styles.categoryBadge, { backgroundColor: theme.colors.surface }]}>
        <Text
            style={[styles.categoryText, { color: theme.colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
        >
            {category}
        </Text>
    </View>
));
CategoryBadge.displayName = 'CategoryBadge';

/**
 * Renders the Live or Online status badges.
 */
const StatusBadge = memo(({ isLive, isOnlineBadge, theme, eventStatus }) => {
    if (isLive) {
        return (
            <View style={[styles.onlineBadge, { backgroundColor: theme.colors.error }]}>
                <Ionicons name="radio-button-on" size={12} color="#fff" />
                <Text style={styles.onlineText}>LIVE</Text>
            </View>
        );
    }
    if (isOnlineBadge) {
        return (
            <View style={[styles.onlineBadge, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="videocam" size={12} color="#fff" />
                <Text style={styles.onlineText}>ONLINE</Text>
            </View>
        );
    }
    if (eventStatus === 'suspended') {
        return (
            <View style={[styles.onlineBadge, { backgroundColor: '#FF4444' }]}>
                <Ionicons name="alert-circle" size={12} color="#fff" />
                <Text style={styles.onlineText}>SUSPENDED</Text>
            </View>
        );
    }
    return null;
});
StatusBadge.displayName = 'StatusBadge';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * EventCard Component
 * Displays a high-fidelity, responsive card summarizing an event's details.
 *
 * @param {Object} props - The component props.
 */
const EventCard = memo(
    ({
        event,
        onLike,
        onShare,
        isLiked = false,
        isRegistered = false,
        isRecommended = false,
        showRegisterButton = true,
        style,
    }) => {
        const navigation = useNavigation();
        const { theme } = useTheme();
        const { user } = useAuth();

        // State Hooks
        const [hostName, setHostName] = useState(event?.organization || 'Club Name');
        const [bannerLoaded, setBannerLoaded] = useState(false);
        const [flyerLoaded, setFlyerLoaded] = useState(false);
        const [lookingForBuddy, setLookingForBuddy] = useState(false);
        const [isProcessing, setIsProcessing] = useState(false);

        // Subscriptions & Side Effects
        useEffect(() => {
            if (!isRegistered || !user || !event?.id) return;

            const participantRef = doc(db, 'events', event.id, 'participants', user.uid);
            const unsubscribe = onSnapshot(
                participantRef,
                (docSnap) => {
                    if (docSnap.exists()) {
                        setLookingForBuddy(docSnap.data().lookingForBuddy || false);
                    }
                },
                (error) => console.error('Buddy snapshot error:', error)
            );

            return () => unsubscribe();
        }, [isRegistered, user, event?.id]);

        useEffect(() => {
            let isMounted = true;
            if (event?.ownerId) {
                getDoc(doc(db, 'users', event.ownerId))
                    .then((snap) => {
                        if (isMounted && snap.exists()) {
                            setHostName(snap.data().displayName || event.organization || 'Club Name');
                        }
                    })
                    .catch((err) => console.error('Host fetch error:', err));
            }
            return () => {
                isMounted = false;
            };
        }, [event?.ownerId, event?.organization]);

        useEffect(() => {
            setBannerLoaded(false);
        }, [event?.bannerUrl]);

        useEffect(() => {
            setFlyerLoaded(false);
        }, [event?.detailImageUrl, event?.bannerUrl]);

        // Handlers
        const handleToggleBuddy = useCallback(
            async (value) => {
                if (!user || !event?.id) return;
                try {
                    const participantRef = doc(db, 'events', event.id, 'participants', user.uid);
                    await updateDoc(participantRef, {
                        lookingForBuddy: value,
                    });

                    if (value) {
                        const participantsRef = collection(db, 'events', event.id, 'participants');
                        const q = query(participantsRef, where('lookingForBuddy', '==', true));
                        const snapshot = await getDocs(q);
                        const otherBuddies = snapshot.docs.filter((d) => d.id !== user.uid);
                        if (otherBuddies.length > 0) {
                            await triggerBuddyMatchNotification(event, otherBuddies.length);
                        }
                    }
                } catch (error) {
                    console.error('Error updating buddy preference:', error);
                }
            },
            [user, event]
        );

        const handleRegisterPress = useCallback(async () => {
            if (isProcessing || !user || !event?.id) return;
            setIsProcessing(true);
            try {
                await safeToggleEventAction(db, user.uid, event.id, true);
                navigation.navigate('EventDetail', { eventId: event.id });
            } catch (error) {
                console.error('Spam button trigger rejected processing error:', error);
            } finally {
                setIsProcessing(false);
            }
        }, [isProcessing, user, event, navigation]);

        const handleCardPress = useCallback(() => {
            if (event?.id) {
                navigation.navigate('EventDetail', { eventId: event.id });
            }
        }, [navigation, event?.id]);

        // Bail out early if no event data exists
        if (!event) return null;

        // Derived state
        const flyerUrl =
            event.detailImageUrl ||
            event.bannerUrl ||
            'https://dummyimage.com/400x400/cccccc/000000.png&text=No+Image';

        const { isEligible: isEarlyBird, currentPrice } = getEarlyBirdInfo(event);
        const isLive = new Date() >= new Date(event.startAt) && new Date() <= new Date(event.endAt);
        const isOnlineBadge = !isLive && event.eventMode === 'online';

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface, ...theme.shadows.default },
                    style,
                ]}
                activeOpacity={0.9}
                onPress={handleCardPress}
                accessibilityRole="button"
                accessibilityLabel={`View details for event: ${event.title}`}
            >
                {/* ====================================================
                  1. MAIN BANNER IMAGE
                  ISSUE #305 FIX: Removed hardcoded heights, implemented
                  aspectRatio constraint for flawless multi-device scaling.
                  ====================================================
                */}
                <View style={styles.bannerContainer}>
                    {!bannerLoaded && (
                        <ShimmerItem style={[styles.bannerImage, StyleSheet.absoluteFill]} />
                    )}
                    <Image
                        source={{
                            uri:
                                event.bannerUrl ||
                                'https://dummyimage.com/800x400/cccccc/000000.png&text=No+Image',
                        }}
                        style={styles.bannerImage}
                        resizeMode="cover"
                        onLoadEnd={() => setBannerLoaded(true)}
                        accessibilityIgnoresInvertColors
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                        style={StyleSheet.absoluteFillObject}
                    />

                    <CategoryBadge category={event.category} theme={theme} />
                    <StatusBadge
                        isLive={isLive}
                        isOnlineBadge={isOnlineBadge}
                        theme={theme}
                        eventStatus={event.status}
                    />
                </View>

                {/* ====================================================
                  2. CONTENT CONTAINER
                  ISSUE #305 FIX: Adjusted paddingTop to prevent flyer 
                  collision on smaller devices where height scales down.
                  ====================================================
                */}
                <View style={styles.contentContainer}>
                    <View
                        style={[
                            styles.flyerContainer,
                            { borderColor: theme.colors.surface, ...theme.shadows.default },
                        ]}
                    >
                        {!flyerLoaded && (
                            <ShimmerItem style={[styles.flyerImage, StyleSheet.absoluteFill]} />
                        )}
                        <Image
                            source={{ uri: flyerUrl }}
                            style={styles.flyerImage}
                            resizeMode="cover"
                            onLoadEnd={() => setFlyerLoaded(true)}
                            accessibilityIgnoresInvertColors
                        />
                    </View>

                    <View style={styles.headerInfo}>
                        <Text
                            style={[styles.title, { color: theme.colors.text }]}
                            numberOfLines={2}
                            accessibilityRole="header"
                        >
                            {event.title}
                        </Text>
                        <Text style={[styles.host, { color: theme.colors.secondary }]}>
                            Hosted by {hostName}
                        </Text>
                    </View>

                    <View style={styles.detailsRow}>
                        <View style={styles.infoBlock}>
                            <View style={styles.infoItem}>
                                <Ionicons
                                    name="calendar"
                                    size={16}
                                    color={theme.colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.infoText,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    {formatEventDate(event.startAt)} •{' '}
                                    {formatEventTime(event.startAt)}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons
                                    name="location"
                                    size={16}
                                    color={theme.colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.infoText,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {event.eventMode === 'online' ? 'Online' : event.location}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons
                                    name="eye-outline"
                                    size={16}
                                    color={theme.colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.infoText,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    {formatMetric(event.views, 'View', 'Views')}
                                </Text>
                            </View>

                            {isRecommended && (
                                <View style={styles.topPickBadge}>
                                    <Ionicons name="star" size={12} color="#000" />
                                    <Text style={styles.topPickText}>TOP PICK</Text>
                                </View>
                            )}

                            {isEarlyBird && !isRegistered && (
                                <View style={styles.earlyBirdBadge}>
                                    <Text style={styles.earlyBirdIcon}>🐦</Text>
                                    <Text style={styles.earlyBirdText}>EARLY BIRD</Text>
                                </View>
                            )}
                        </View>

                        <View
                            style={[
                                styles.priceBadge,
                                { backgroundColor: theme.colors.secondary },
                            ]}
                        >
                            <Text style={styles.priceText}>
                                {event.isPaid ? `₹${currentPrice}` : 'FREE'}
                            </Text>
                        </View>
                    </View>

                    {/* FOOTER ACTIONS ROW */}
                    {showRegisterButton && (
                        <View style={styles.footerActionRow}>
                            {isRegistered ? (
                                <View style={styles.registeredRow}>
                                    <View
                                        style={[
                                            styles.registerBtnCompact,
                                            {
                                                backgroundColor: theme.colors.success,
                                                ...theme.shadows.small,
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={14}
                                            color="#fff"
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text style={styles.registerTextCompact}>
                                            REGISTERED
                                        </Text>
                                    </View>
                                    <View style={styles.buddyToggleContainer}>
                                        <Text
                                            style={[
                                                styles.buddyToggleLabel,
                                                { color: theme.colors.text },
                                            ]}
                                        >
                                            Find A Buddy!
                                        </Text>
                                        <Switch
                                            value={lookingForBuddy}
                                            onValueChange={handleToggleBuddy}
                                            trackColor={{
                                                false: theme.colors.border,
                                                true: theme.colors.primary + '80',
                                            }}
                                            thumbColor={
                                                lookingForBuddy ? theme.colors.primary : '#999'
                                            }
                                            style={
                                                Platform.OS === 'ios'
                                                    ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }
                                                    : {}
                                            }
                                        />
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[
                                        styles.registerBtn,
                                        {
                                            backgroundColor: isProcessing
                                                ? theme.colors.border
                                                : theme.colors.primary,
                                            ...theme.shadows.default,
                                        },
                                    ]}
                                    disabled={isProcessing}
                                    onPress={handleRegisterPress}
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: isProcessing }}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Text style={styles.registerText}>REGISTER</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }
);

// ============================================================================
// STYLESHEET
// ============================================================================

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        marginBottom: 16,
        overflow: 'visible',
        marginHorizontal: 0,
        width: '100%',
    },
    // ISSUE #305: Replaced fixed height with dynamic aspectRatio
    bannerContainer: {
        aspectRatio: 16 / 9,
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    categoryBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        ...globalTheme.shadows.small,
        maxWidth: '50%',
    },
    categoryText: {
        fontWeight: '900',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    onlineBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        ...globalTheme.shadows.small,
    },
    onlineText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 10,
    },
    // ISSUE #305: Added paddingTop to prevent overlap collisions
    contentContainer: {
        paddingHorizontal: 12,
        paddingBottom: 14,
        paddingTop: 10, 
    },
    flyerContainer: {
        width: 78,
        height: 78,
        borderRadius: 14,
        borderWidth: 3,
        marginTop: -38,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    flyerImage: {
        width: '100%',
        height: '100%',
    },
    headerInfo: {
        marginTop: -34,
        marginLeft: 88,
        minHeight: 60,
        marginBottom: 2,
        justifyContent: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '900',
        lineHeight: 21,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    host: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.8,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: 12,
        marginBottom: 10,
    },
    infoBlock: {
        gap: 6,
        flex: 1,
        paddingRight: 10,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 1,
    },
    topPickBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
        ...globalTheme.shadows.small,
    },
    topPickText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    earlyBirdBadge: {
        backgroundColor: '#EAB30820',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#EAB308',
    },
    earlyBirdIcon: {
        fontSize: 10,
        lineHeight: 14,
    },
    earlyBirdText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#EAB308',
        letterSpacing: 0.5,
        lineHeight: 14,
    },
    priceBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        alignSelf: 'flex-start',
    },
    priceText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
        textTransform: 'uppercase',
    },
    footerActionRow: {
        marginTop: 4,
    },
    registerBtn: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    registeredRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 4,
    },
    registerBtnCompact: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    registerTextCompact: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    registerText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 13,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    buddyToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buddyToggleLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
});

// ============================================================================
// PROP TYPES & EXPORTS
// ============================================================================

EventCard.displayName = 'EventCard';

EventCard.propTypes = {
    /** The core event data object from Firestore */
    event: PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        category: PropTypes.string,
        bannerUrl: PropTypes.string,
        detailImageUrl: PropTypes.string,
        organization: PropTypes.string,
        ownerId: PropTypes.string,
        startAt: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        endAt: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        eventMode: PropTypes.string,
        location: PropTypes.string,
        views: PropTypes.number,
        isPaid: PropTypes.bool,
        status: PropTypes.string,
    }).isRequired,
    /** Callback for when the user likes the event */
    onLike: PropTypes.func,
    /** Callback for when the user clicks share */
    onShare: PropTypes.func,
    /** Current boolean status of if the active user likes this event */
    isLiked: PropTypes.bool,
    /** Current boolean status of if the active user is registered */
    isRegistered: PropTypes.bool,
    /** Triggers the Top Pick UI matrix if true */
    isRecommended: PropTypes.bool,
    /** Toggles the rendering of the bottom action area */
    showRegisterButton: PropTypes.bool,
    /** Override styling object for the root container */
    style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export default EventCard;