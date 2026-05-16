import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../lib/firebaseConfig';
import { theme } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { ShimmerItem } from './SkeletonLoader';

export default function EventCard({
    event,
    onLike,
    onShare,
    isLiked = false,
    isRegistered = false,
    isRecommended = false,
    showRegisterButton = true,
    style,
}) {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const [hostName, setHostName] = useState(event?.organization || 'Club Name');
    const [bannerLoaded, setBannerLoaded] = useState(false);
    const [flyerLoaded, setFlyerLoaded] = useState(false);

    useEffect(() => {
        setBannerLoaded(false);
    }, [event?.bannerUrl]);

    useEffect(() => {
        setFlyerLoaded(false);
    }, [event?.detailImageUrl, event?.bannerUrl]);

    useEffect(() => {
        if (event?.ownerId) {
            getDoc(doc(db, 'users', event.ownerId)).then(snap => {
                if (snap.exists()) {
                    setHostName(snap.data().displayName || event.organization || 'Club Name');
                }
            });
        }
    }, [event?.ownerId]);

    if (!event) return null;

    const dateObj = new Date(event.startAt);

    // Format Date: "OCT 15"
    const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
    const day = dateObj.getDate();

    // Format Time: "7 PM"
    const time = dateObj.toLocaleString('default', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

    // Fallback for second image if not present in data
    const flyerUrl =
        event.detailImageUrl || event.bannerUrl || 'https://via.placeholder.com/400x400';

    return (
        <TouchableOpacity
            style={[
                styles.card,
                { backgroundColor: theme.colors.surface, ...theme.shadows.default },
                style,
            ]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
        >
            {/* 1. MAIN BANNER IMAGE (Top Layer) */}
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
                    source={{ uri: event.bannerUrl || 'https://via.placeholder.com/800x400' }}
                    style={[styles.bannerImage, isRecommended && { height: 140 }]}
                    resizeMode="cover"
                    onLoadEnd={() => setBannerLoaded(true)}
                />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)']}
                    style={StyleSheet.absoluteFillObject}
                />
                {/* Category Tag on Banner */}
                <View style={[styles.categoryBadge, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.categoryText, { color: theme.colors.text }]}>
                        {event.category}
                    </Text>
                </View>

                {/* Live / Online Badge */}
                {new Date() >= new Date(event.startAt) && new Date() <= new Date(event.endAt) ? (
                    <View style={[styles.onlineBadge, { backgroundColor: theme.colors.error }]}>
                        <Ionicons name="radio-button-on" size={12} color="#fff" />
                        <Text style={styles.onlineText}>LIVE</Text>
                    </View>
                ) : event.eventMode === 'online' ? (
                    <View style={[styles.onlineBadge, { backgroundColor: theme.colors.primary }]}>
                        <Ionicons name="videocam" size={12} color="#fff" />
                        <Text style={styles.onlineText}>ONLINE</Text>
                    </View>
                ) : null}

                {/* SUSPENDED Badge */}
                {event.status === 'suspended' && (
                    <View style={[styles.onlineBadge, { backgroundColor: '#FF4444' }]}>
                        <Ionicons name="alert-circle" size={12} color="#fff" />
                        <Text style={styles.onlineText}>SUSPENDED</Text>
                    </View>
                )}

                {/* Removed Top Pick badge from banner - moved to details row */}
            </View>

            {/* 2. CONTENT CONTAINER */}
            <View style={styles.contentContainer}>
                {/* FLYER IMAGE (Overlapping) */}
                <View
                    style={[
                        styles.flyerContainer,
                        { borderColor: theme.colors.surface, ...theme.shadows.default },
                    ]}
                >
                    {!flyerLoaded && (
                        <ShimmerItem
                            style={[styles.flyerImage, StyleSheet.absoluteFill]}
                        />
                    )}
                    <Image
                        source={{ uri: flyerUrl }}
                        style={styles.flyerImage}
                        resizeMode="cover"
                        onLoadEnd={() => setFlyerLoaded(true)}
                    />
                </View>

                {/* HEADER INFO (Right of Flyer) */}
                <View style={styles.headerInfo}>
                    <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
                        {event.title}
                    </Text>
                    <Text style={[styles.host, { color: theme.colors.secondary }]}>
                        Hosted by {hostName}
                    </Text>
                </View>

                {/* DETAILS ROW (Below Flyer) */}
                <View style={styles.detailsRow}>
                    {/* Date & Location */}
                    <View style={styles.infoBlock}>
                        <View style={styles.infoItem}>
                            <Ionicons
                                name="calendar"
                                size={16}
                                color={theme.colors.textSecondary}
                            />
                            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                                {month} {day} • {time}
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
                        <View style={styles.infoItem}>
                            <Ionicons
                                name="eye-outline"
                                size={16}
                                color={theme.colors.textSecondary}
                            />
                            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                                {event.views || 0} Views
                            </Text>
                        </View>

                        {/* Top Pick Badge - Moved here */}
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
                    </View>

                    {/* Price Badge */}
                    <View style={[styles.priceBadge, { backgroundColor: theme.colors.secondary }]}>
                        <Text style={styles.priceText}>
                            {event.isPaid ? `₹${event.price}` : 'FREE'}
                        </Text>
                    </View>
                </View>

                {/* FOOTER ACTION */}
                {showRegisterButton &&
                    (isRegistered ? (
                        <View
                            style={[
                                styles.registerBtn,
                                { backgroundColor: theme.colors.success, ...theme.shadows.default },
                            ]}
                        >
                            <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#fff"
                                style={{ marginRight: 4 }}
                            />
                            <Text style={styles.registerText}>REGISTERED</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.registerBtn,
                                { backgroundColor: theme.colors.primary, ...theme.shadows.default },
                            ]}
                            onPress={() =>
                                navigation.navigate('EventDetail', { eventId: event.id })
                            }
                        >
                            <Text style={styles.registerText}>REGISTER</Text>
                        </TouchableOpacity>
                    ))}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16, // Softer
        marginBottom: 24,
        overflow: 'visible',
        marginHorizontal: 0, // Full width - removed reference to potential parent padding if any
        width: '100%',
    },
    bannerContainer: {
        height: 180, // Default height
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 16,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    categoryBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20, // Pill
        ...theme.shadows.small,
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
        borderRadius: 20, // Pill
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        ...theme.shadows.small,
    },
    onlineText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 10,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        paddingTop: 0,
    },
    flyerContainer: {
        width: 100,
        height: 100,
        borderRadius: 20, // Sleeker curve
        borderWidth: 4,
        marginTop: -50,
        overflow: 'hidden',
    },
    flyerImage: {
        width: '100%',
        height: '100%',
    },
    headerInfo: {
        marginTop: -45,
        marginLeft: 110,
        height: 75, // Fixed height for alignment
        marginBottom: 4,
        justifyContent: 'center', // Center vertically
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        lineHeight: 26,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    host: {
        fontSize: 13,
        fontWeight: '700',
        opacity: 0.8,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 16,
    },
    infoBlock: {
        gap: 6,
        flex: 1,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 14,
        fontWeight: '600',
    },
    // New Ribbon Style for Price
    priceBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20, // Pill
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
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 16, // Modern Rounded
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%', // Full Width
    },
    registerText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
