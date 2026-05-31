import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState, memo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, Switch, Platform } from 'react-native';
import { db } from '../lib/firebaseConfig';
import { theme as globalTheme } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { getEarlyBirdInfo } from '../lib/earlyBird';
import { ShimmerItem } from './SkeletonLoader';
import { useAuth } from '../lib/AuthContext';
import { triggerBuddyMatchNotification } from '../lib/notificationService';
import { formatEventDate, formatEventTime } from '../lib/formatEventDate';
import PropTypes from 'prop-types';

// Module-level profile cache registry
// profileCache: resolved data keyed by ownerId
// profileRequestCache: in-flight promises to prevent duplicate concurrent reads
const profileCache = new Map();
const profileRequestCache = new Map();

/**
 * formatMetric — adaptive pluralization helper for metric badges (Issue #308)
 * Returns a grammatically correct string for any numeric metric.
 *
 * @param {number|undefined|null} value  - Raw numeric value from the database
 * @param {string} singular              - Singular label, e.g. "View"
 * @param {string} plural                - Plural label,   e.g. "Views"
 * @returns {string}                     - e.g. "1 View", "0 Views", "42 Views"
 */
const formatMetric = (value, singular, plural) => {
    const count = value ?? 0;
    return `${count} ${count === 1 ? singular : plural}`;
};

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
        const [hostName, setHostName] = useState(event?.organization || 'Club Name');
        const [bannerLoaded, setBannerLoaded] = useState(false);
        const [flyerLoaded, setFlyerLoaded] = useState(false);
        const [lookingForBuddy, setLookingForBuddy] = useState(false);
        const [isNavigatingToDetail, setIsNavigatingToDetail] = useState(false);
        const navigationLockRef = useRef(false);
        const navigationUnlockTimerRef = useRef(null);

        useEffect(() => {
            if (!isRegistered || !user || !event?.id) return;

            const participantRef = doc(db, 'events', event.id, 'participants', user.uid);
            const unsubscribe = onSnapshot(participantRef, docSnap => {
                if (docSnap.exists()) {
                    setLookingForBuddy(docSnap.data().lookingForBuddy || false);
                }
            });

            return () => unsubscribe();
        }, [isRegistered, user, event?.id]);

        const handleToggleBuddy = async value => {
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
                    const otherBuddies = snapshot.docs.filter(d => d.id !== user.uid);
                    if (otherBuddies.length > 0) {
                        await triggerBuddyMatchNotification(event, otherBuddies.length);
                    }
                }
            } catch (error) {
                console.error('Error updating buddy preference:', error);
            }
        };

        useEffect(() => {
            setBannerLoaded(false);
        }, [event?.bannerUrl]);

        useEffect(() => {
            setFlyerLoaded(false);
        }, [event?.detailImageUrl, event?.bannerUrl]);

        useEffect(() => {
            if (!event?.ownerId) return;

            // Reset immediately to prevent stale FlashList cells showing previous host
            setHostName(event?.organization || 'Club Name');

            // Cache hit: apply memoized data and short-circuit, no network call
            if (profileCache.has(event.ownerId)) {
                const cached = profileCache.get(event.ownerId);
                setHostName(cached.displayName || event.organization || 'Club Name');
                return;
            }

            let cancelled = false;

            // In-flight cache: reuse existing promise if another card already fired
            // getDoc for this ownerId, preventing duplicate concurrent Firestore reads
            if (!profileRequestCache.has(event.ownerId)) {
                profileRequestCache.set(event.ownerId, getDoc(doc(db, 'users', event.ownerId)));
            }

            profileRequestCache
                .get(event.ownerId)
                .then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        profileCache.set(event.ownerId, data);
                        profileRequestCache.delete(event.ownerId);
                        if (!cancelled) {
                            setHostName(data.displayName || event.organization || 'Club Name');
                        }
                    }
                })
                .catch(() => {
                    profileRequestCache.delete(event.ownerId);
                });

            return () => {
                cancelled = true;
            };
        }, [event?.ownerId, event?.organization]);

        useEffect(
            () => () => {
                if (navigationUnlockTimerRef.current) {
                    clearTimeout(navigationUnlockTimerRef.current);
                }
            },
            [],
        );

        const navigateToDetail = () => {
            if (!event?.id || navigationLockRef.current) return;

            navigationLockRef.current = true;
            setIsNavigatingToDetail(true);
            navigation.navigate('EventDetail', { eventId: event.id });
            navigationUnlockTimerRef.current = setTimeout(() => {
                navigationLockRef.current = false;
                setIsNavigatingToDetail(false);
            }, 1000);
        };

        const handleRegisterPress = () => {
            navigateToDetail();
        };

        if (!event) return null;

        const flyerUrl =
            event.detailImageUrl ||
            event.bannerUrl ||
            'https://dummyimage.com/400x400/cccccc/000000.png&text=No+Image';

        const { isEligible: isEarlyBird, currentPrice } = getEarlyBirdInfo(event);

        const isLive = new Date() >= new Date(event.startAt) && new Date() <= new Date(event.endAt);
        const isOnlineBadge = !isLive && event.eventMode === 'online';

        // Calculate dynamic popularity score (GSSoC Feature Request)
        const registrations = event.participantCount || 0;
        const views = event.views || 0;
        const saves = event.savedCount || 0;
        const popularityScore = Math.min(
            Math.round(registrations * 1.5 + saves * 1 + views * 0.2),
            100,
        );
        const isTrending = popularityScore >= 75;

        const renderBannerBadges = () => (
            <>
                {isLive && (
                    <View style={[styles.onlineBadge, { backgroundColor: theme.colors.error }]}>
                        <Ionicons name="radio-button-on" size={12} color="#fff" />
                        <Text style={styles.onlineText}>LIVE</Text>
                    </View>
                )}
                {isOnlineBadge && (
                    <View style={[styles.onlineBadge, { backgroundColor: theme.colors.primary }]}>
                        <Ionicons name="videocam" size={12} color="#fff" />
                        <Text style={styles.onlineText}>ONLINE</Text>
                    </View>
                )}
                {event.status === 'suspended' && (
                    <View style={[styles.onlineBadge, { backgroundColor: '#FF4444' }]}>
                        <Ionicons name="alert-circle" size={12} color="#fff" />
                        <Text style={styles.onlineText}>SUSPENDED</Text>
                    </View>
                )}
            </>
        );

        const renderInfoBadges = () => (
            <>
                {isRecommended && (
                    <View
                        style={{
                            backgroundColor: '#FFD700',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            alignSelf: 'flex-start',
                            marginTop: 4,
                            ...theme.shadows.small,
                        }}
                    >
                        <Ionicons name="star" size={12} color="#000" />
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                            TOP PICK
                        </Text>
                    </View>
                )}
                {isEarlyBird && !isRegistered && (
                    <View
                        style={{
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
                        }}
                    >
                        <Text style={{ fontSize: 10, lineHeight: 14 }}>🐦</Text>
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#EAB308',
                                letterSpacing: 0.5,
                                lineHeight: 14,
                            }}
                        >
                            EARLY BIRD
                        </Text>
                    </View>
                )}
                {isTrending && (
                    <View
                        style={{
                            backgroundColor: '#FF4D4D20',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            alignSelf: 'flex-start',
                            marginTop: 4,
                            borderWidth: 1,
                            borderColor: '#FF4D4D',
                        }}
                    >
                        <Text style={{ fontSize: 10, lineHeight: 14 }}>🔥</Text>
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#FF4D4D',
                                letterSpacing: 0.5,
                                lineHeight: 14,
                            }}
                        >
                            TRENDING
                        </Text>
                    </View>
                )}
            </>
        );

        const renderFooter = () => {
            if (!showRegisterButton) return null;
            if (isRegistered) {
                return (
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
                            <Text style={styles.registerTextCompact}>REGISTERED</Text>
                        </View>
                        <View style={styles.buddyToggleContainer}>
                            <Text style={[styles.buddyToggleLabel, { color: theme.colors.text }]}>
                                Find A Buddy!
                            </Text>
                            <Switch
                                value={lookingForBuddy}
                                onValueChange={handleToggleBuddy}
                                trackColor={{
                                    false: theme.colors.border,
                                    true: theme.colors.primary + '80',
                                }}
                                thumbColor={lookingForBuddy ? theme.colors.primary : '#999'}
                                style={
                                    Platform.OS === 'ios'
                                        ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }
                                        : {}
                                }
                            />
                        </View>
                    </View>
                );
            }
            return (
                <TouchableOpacity
                    style={[
                        styles.registerBtn,
                        {
                            backgroundColor: isNavigatingToDetail
                                ? theme.colors.border
                                : theme.colors.primary,
                            ...theme.shadows.default,
                        },
                    ]}
                    accessibilityState={{ disabled: isNavigatingToDetail }}
                    disabled={isNavigatingToDetail}
                    onPress={handleRegisterPress}
                    testID="event-card-register-button"
                >
                    <Text style={styles.registerText}>REGISTER</Text>
                </TouchableOpacity>
            );
        };

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface, ...theme.shadows.default },
                    style,
                ]}
                activeOpacity={0.9}
                onPress={navigateToDetail}
            >
                <View style={[styles.bannerContainer, isRecommended && { height: 140 }]}>
                    {!bannerLoaded && (
                        <ShimmerItem
                            style={[
                                styles.bannerImage,
                                isRecommended && { height: 140 },
                                StyleSheet.absoluteFill,
                            ]}
                        />
                    )}
                    <Image
                        source={{
                            uri:
                                event.bannerUrl ||
                                'https://dummyimage.com/800x400/cccccc/000000.png&text=No+Image',
                        }}
                        style={[styles.bannerImage, isRecommended && { height: 140 }]}
                        resizeMode="cover"
                        onLoadEnd={() => setBannerLoaded(true)}
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.4)']}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <View style={[styles.categoryBadge, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.categoryText, { color: theme.colors.text }]}>
                            {event.category}
                        </Text>
                    </View>
                    {renderBannerBadges()}
                </View>

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
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text
                            style={[styles.title, { color: theme.colors.text }]}
                            numberOfLines={2}
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
                                    style={[styles.infoText, { color: theme.colors.textSecondary }]}
                                >
                                    {formatEventDate(event.startAt)}{' '}
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
                                    style={[styles.infoText, { color: theme.colors.textSecondary }]}
                                    numberOfLines={1}
                                >
                                    {event.eventMode === 'online' ? 'Online' : event.location}
                                </Text>
                            </View>

                            {/* ✅ Issue #308 — views metric now uses formatMetric for correct pluralization */}
                            <View style={styles.infoItem}>
                                <Ionicons
                                    name="eye-outline"
                                    size={16}
                                    color={theme.colors.textSecondary}
                                />
                                <Text
                                    style={[styles.infoText, { color: theme.colors.textSecondary }]}
                                >
                                    {formatMetric(event.views, 'View', 'Views')}
                                </Text>
                            </View>
                            {renderInfoBadges()}
                        </View>
                        <View
                            style={[styles.priceBadge, { backgroundColor: theme.colors.secondary }]}
                        >
                            <Text style={styles.priceText}>
                                {event.isPaid ? `₹${currentPrice}` : 'FREE'}
                            </Text>
                        </View>
                    </View>
                    {renderFooter()}
                </View>
            </TouchableOpacity>
        );
    },
);

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        marginBottom: 16,
        overflow: 'visible',
        marginHorizontal: 0,
        width: '100%',
    },
    bannerContainer: {
        height: 140,
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 14,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        borderRadius: 14,
    },
    categoryBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        ...globalTheme.shadows.small,
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
    contentContainer: {
        paddingHorizontal: 12,
        paddingBottom: 14,
        paddingTop: 0,
    },
    flyerContainer: {
        width: 78,
        height: 78,
        borderRadius: 14,
        borderWidth: 3,
        marginTop: -38,
        overflow: 'hidden',
    },
    flyerImage: {
        width: '100%',
        height: '100%',
    },
    headerInfo: {
        marginTop: -34,
        marginLeft: 88,
        height: 60,
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
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    infoBlock: {
        gap: 4,
        flex: 1,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 12,
        fontWeight: '600',
    },
    priceBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    priceText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
        textTransform: 'uppercase',
    },
    registerBtn: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 10,
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

EventCard.displayName = 'EventCard';

EventCard.propTypes = {
    event: PropTypes.object,
    onLike: PropTypes.any,
    onShare: PropTypes.any,
    isLiked: PropTypes.bool,
    isRegistered: PropTypes.bool,
    isRecommended: PropTypes.bool,
    showRegisterButton: PropTypes.any,
    style: PropTypes.any,
};

export default EventCard;
