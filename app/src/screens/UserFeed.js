import logger from '../lib/logger';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    collection,
    limit,
    onSnapshot,
    query,
    where,
    getDocs,
    startAfter,
    orderBy,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import EventCard from '../components/EventCard';
import FeedbackModal from '../components/FeedbackModal';
import SkeletonLoader from '../components/SkeletonLoader';
import { useAuth } from '../lib/AuthContext';
import { submitFeedback } from '../lib/feedbackService';
import { db } from '../lib/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../lib/ThemeContext';
import { COLLECTIONS, getUserParticipatingPath } from '../lib/firestorePaths';

import { MapView, Marker, Callout } from '../components/MapComponent';

const FILTERS = ['Upcoming', 'Past', 'Cultural', 'Sports', 'Tech', 'Workshop', 'Seminar'];

export default function UserFeed() {
    const { user, userData, role } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [participatingIds, setParticipatingIds] = useState([]); // Track joined events
    const [activeFilter, setActiveFilter] = useState('Upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isConnected, setIsConnected] = useState(true);
    const [viewMode, setViewMode] = useState('list');
    const navigation = useNavigation();

    // Pagination and Recommendation State
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [upcomingPool, setUpcomingPool] = useState([]);
    const [lastVisible, setLastVisible] = useState(null);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20;

    const hasMoreRef = useRef(hasMore);
    const isFetchingMoreRef = useRef(isFetchingMore);
    const lastVisibleRef = useRef(lastVisible);

    useEffect(() => {
        hasMoreRef.current = hasMore;
    }, [hasMore]);
    useEffect(() => {
        isFetchingMoreRef.current = isFetchingMore;
    }, [isFetchingMore]);
    useEffect(() => {
        lastVisibleRef.current = lastVisible;
    }, [lastVisible]);

    // Feedback Modal State
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [currentFeedbackRequest, setCurrentFeedbackRequest] = useState(null);

    const scrollY = useRef(new Animated.Value(0)).current;

    // NetInfo listener for connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected ?? true);
            if (!state.isConnected) {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Load cached events on mount (after user is known)
    useEffect(() => {
        if (!user) return;
        const cacheKey = `@userfeed:events:${user.uid}`;
        const loadCache = async () => {
            try {
                const json = await AsyncStorage.getItem(cacheKey);
                if (json) setEvents(JSON.parse(json));
            } catch (e) {
                console.error('Failed to load cached events', e);
            } finally {
                const state = await NetInfo.fetch();
                if (!state.isConnected) {
                    setLoading(false);
                }
            }
        };
        loadCache();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const q = collection(db, getUserParticipatingPath(user.uid));
        const unsub = onSnapshot(q, snap => {
            setParticipatingIds(snap.docs.map(d => d.id));
        });
        return unsub;
    }, [user]);

    // Debounce search query to prevent excessive Firestore reads
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Listen for pending feedback requests
    useEffect(() => {
        if (!user) return;

        const feedbackQuery = query(
            collection(db, COLLECTIONS.FEEDBACK_REQUESTS),
            where('userId', '==', user.uid),
            where('status', '==', 'pending'),
            limit(1), // Show one at a time
        );

        const unsubscribe = onSnapshot(
            feedbackQuery,
            snapshot => {
                if (!snapshot.empty) {
                    const requestDoc = snapshot.docs[0];
                    setCurrentFeedbackRequest({
                        id: requestDoc.id,
                        ...requestDoc.data(),
                    });
                    setShowFeedbackModal(true);
                }
            },
            err => console.log('Feedback Listener Error', err),
        );

        return () => unsubscribe();
    }, [user]);

    // Fetch a pool of upcoming events for recommendations
    useEffect(() => {
        if (!user) {
            setEvents([]);
            setLoading(false);
            AsyncStorage.removeItem('@userfeed:events').catch(err =>
                console.error('Cache clear on logout failed', err),
            );
            return;
        }

        const fetchPool = async () => {
            try {
                const now = new Date().toISOString();
                const q = query(
                    collection(db, COLLECTIONS.EVENTS),
                    where('status', '==', 'active'),
                    where('startAt', '>=', now),
                    orderBy('startAt', 'asc'),
                    limit(50),
                );
                const snapshot = await getDocs(q);
                const list = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    list.push({ id: doc.id, ...data });
                });
                setUpcomingPool(list);
            } catch (error) {
                console.error('Error fetching recommendation pool: ', error);
            }
        };
        fetchPool();
    }, [user]);

    const checkAudienceEligibility = event => {
        if (role === 'student' && userData && userData.branch && userData.year) {
            const targetDepts = event.target?.departments || [];
            const userDept = userData.branch || 'Unknown';
            const deptMatch =
                targetDepts.length === 0 ||
                targetDepts.includes('All') ||
                targetDepts.includes(userDept);

            const targetYears = event.target?.years || [];
            const userYear = parseInt(userData.year || 0);
            const yearMatch = targetYears.length === 0 || targetYears.includes(userYear);

            return deptMatch && yearMatch;
        }
        return true;
    };

    const fetchEvents = useCallback(
        async (loadMore = false) => {
            if (!user) return;
            if (loadMore && (!hasMoreRef.current || isFetchingMoreRef.current)) return;

            if (loadMore) {
                isFetchingMoreRef.current = true;
                setIsFetchingMore(true);
            } else {
                setLoading(true);
                setEvents([]);
                lastVisibleRef.current = null;
                setLastVisible(null);
            }

            try {
                const now = new Date().toISOString();
                const qConstraints = [where('status', '==', 'active')];

                if (activeFilter === 'Upcoming') {
                    qConstraints.push(where('startAt', '>=', now), orderBy('startAt', 'asc'));
                } else if (activeFilter === 'Past') {
                    qConstraints.push(where('startAt', '<', now), orderBy('startAt', 'desc'));
                } else {
                    // For categories, without composite index, we might just query upcoming
                    // and filter locally, OR assume composite index exists.
                    // Assuming composite index exists for category + startAt
                    qConstraints.push(
                        where('category', '==', activeFilter),
                        where('startAt', '>=', now),
                        orderBy('startAt', 'asc'),
                    );
                }

                if (loadMore && lastVisibleRef.current) {
                    qConstraints.push(startAfter(lastVisibleRef.current));
                }
                const q = query(
                    collection(db, COLLECTIONS.EVENTS),
                    ...qConstraints,
                    limit(PAGE_SIZE),
                );

                const snapshot = await getDocs(q);
                const list = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    list.push({ id: doc.id, ...data });
                });

                if (loadMore) {
                    setEvents(prev => {
                        const existingIds = new Set(prev.map(e => e.id));
                        const newEvents = list.filter(e => !existingIds.has(e.id));
                        const merged = [...prev, ...newEvents];
                        AsyncStorage.setItem(
                            `@userfeed:events:${user.uid}`,
                            JSON.stringify(merged),
                        ).catch(err => console.error('Cache write failed', err));
                        return merged;
                    });
                } else {
                    const merged = list;
                    setEvents(merged);
                    AsyncStorage.setItem(
                        `@userfeed:events:${user.uid}`,
                        JSON.stringify(merged),
                    ).catch(err => console.error('Cache write failed', err));
                }

                if (snapshot.docs.length > 0) {
                    const nextCursor = snapshot.docs[snapshot.docs.length - 1];
                    lastVisibleRef.current = nextCursor;
                    setLastVisible(nextCursor);
                } else {
                    if (!loadMore) {
                        lastVisibleRef.current = null;
                        setLastVisible(null);
                    }
                }
                const nextHasMore = snapshot.docs.length === PAGE_SIZE;
                hasMoreRef.current = nextHasMore;
                setHasMore(nextHasMore);
            } catch (error) {
                console.error('Error fetching paginated events: ', error);
                if (error.message?.includes('index')) {
                    Alert.alert(
                        'Database Index Required',
                        'Please create the required Firestore composite index found in the console logs.',
                    );
                }
            } finally {
                setLoading(false);
                isFetchingMoreRef.current = false;
                setIsFetchingMore(false);
                setRefreshing(false);
            }
        },
        [user, activeFilter],
    );

    useEffect(() => {
        fetchEvents(false);
    }, [fetchEvents]);

    // Recommendation Logic: Views + User History + Freshness
    const getRecommendedEvents = () => {
        const now = new Date();
        const eligiblePool = upcomingPool.filter(checkAudienceEligibility);
        const upcomingEvents = eligiblePool.filter(e => new Date(e.startAt) >= now);

        if (upcomingEvents.length === 0) return [];

        // 1. Analyze User History (Favorite Categories)
        const categoryCounts = {};
        upcomingPool
            .filter(e => participatingIds.includes(e.id))
            .forEach(e => {
                if (e.category) {
                    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
                }
            });

        // Find top category
        let favoriteCategory = null;
        let maxCount = 0;
        Object.entries(categoryCounts).forEach(([cat, count]) => {
            if (count > maxCount) {
                maxCount = count;
                favoriteCategory = cat;
            }
        });

        // 2. Score Events
        const scoredEvents = upcomingEvents.map(event => {
            let score = 0;

            // A. Views (Popularity) - 1 point per 2 views (0.5)
            score += (event.views || 0) * 0.5;

            // B. Category Match (Personalization)
            if (favoriteCategory && event.category === favoriteCategory) {
                score += 20; // Big boost
            } else if (categoryCounts[event.category]) {
                score += 5; // Small boost for any previously attended category
            }

            // C. Freshness (Within 7 days)
            const daysUntil = (new Date(event.startAt) - now) / (1000 * 60 * 60 * 24);
            if (daysUntil <= 7) score += 10;

            return { ...event, score };
        });

        // 3. Sort by Score Descending
        return scoredEvents.sort((a, b) => b.score - a.score).slice(0, 3);
    };

    const getFilteredEvents = () => {
        let filtered = events;

        // 0. Search Query Filtering
        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase();
            filtered = filtered.filter(
                e =>
                    e.title?.toLowerCase().includes(query) ||
                    e.description?.toLowerCase().includes(query) ||
                    e.location?.toLowerCase().includes(query),
            );
        }

        // 1. Strict Profile Filtering (Department & Year)
        filtered = filtered.filter(checkAudienceEligibility);

        // We no longer need to filter by Upcoming/Past/Category manually
        // because the backend query (fetchEvents) already handles it!

        return filtered;
    };

    const displayList = getFilteredEvents();

    const onRefresh = async () => {
        if (!user) return;
        setRefreshing(true);
        try {
            const q = query(collection(db, 'events'));
            const snapshot = await getDocs(q);
            const list = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'suspended') return;
                list.push({ id: doc.id, ...data });
            });
            setEvents(list);
            // Update cache
            AsyncStorage.setItem(`@userfeed:events:${user.uid}`, JSON.stringify(list)).catch(err =>
                console.error('Cache write failed', err),
            );
        } catch (error) {
            console.error('Refresh error:', error);
            Alert.alert('Error', 'Failed to refresh events.');
        } finally {
            setRefreshing(false);
        }
        await fetchEvents(false);
    };

    const StickyHeader = () => (
        <View style={{ backgroundColor: theme.colors.background, paddingBottom: 10 }}>
            {/* Search Bar - Floating Pill */}
            <View
                style={[
                    styles.searchContainer,
                    { backgroundColor: theme.colors.surface, ...theme.shadows.small },
                ]}
            >
                <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search events..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    accessible={true}
                    accessibilityRole="search"
                    accessibilityLabel="Search events"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.filterWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContent}
                >
                    {FILTERS.map(f => {
                        const isActive = activeFilter === f;
                        return (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setActiveFilter(f)}
                                style={{
                                    marginRight: 10,
                                    borderRadius: 25,
                                    ...theme.shadows.small,
                                }}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`${f} filter`}
                            >
                                {isActive ? (
                                    <LinearGradient
                                        colors={[
                                            theme.colors.primary,
                                            theme.colors.secondary || '#FFC107',
                                        ]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.chip}
                                    >
                                        <Text style={[styles.chipText, { color: '#fff' }]}>
                                            {f}
                                        </Text>
                                    </LinearGradient>
                                ) : (
                                    <View
                                        style={[
                                            styles.chip,
                                            { backgroundColor: theme.colors.surface },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                { color: theme.colors.textSecondary },
                                            ]}
                                        >
                                            {f}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );

    const renderEvent = useCallback(
        ({ item }) => (
            <View style={{ paddingHorizontal: 20 }}>
                <EventCard
                    event={item}
                    isRegistered={participatingIds.includes(item.id)}
                    onLike={() => {}}
                    onShare={async () => {
                        try {
                            await Share.share({
                                message: `Check out this event: ${item.title} at ${item.location}!`,
                            });
                        } catch (e) {
                            logger.error('Share Error:', e);
                            Alert.alert('Error', 'Failed to share the event.');
                        }
                    }}
                />
            </View>
        ),
        [participatingIds],
    );

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, -50],
        extrapolate: 'clamp',
    });

    const renderHeader = () => (
        <Animated.View style={{ transform: [{ translateY: headerTranslateY }] }}>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginHorizontal: 20,
                    marginBottom: 15,
                }}
            >
                <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
                {MapView && (
                    <View
                        style={{
                            flexDirection: 'row',
                            backgroundColor: theme.colors.surface,
                            borderRadius: 20,
                            overflow: 'hidden',
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => setViewMode('list')}
                            style={{
                                paddingHorizontal: 15,
                                paddingVertical: 8,
                                backgroundColor:
                                    viewMode === 'list' ? theme.colors.primary : 'transparent',
                            }}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="List view"
                        >
                            <Ionicons
                                name="list"
                                size={20}
                                color={viewMode === 'list' ? '#fff' : theme.colors.textSecondary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setViewMode('map')}
                            style={{
                                paddingHorizontal: 15,
                                paddingVertical: 8,
                                backgroundColor:
                                    viewMode === 'map' ? theme.colors.primary : 'transparent',
                            }}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="Map view"
                        >
                            <Ionicons
                                name="map"
                                size={20}
                                color={viewMode === 'map' ? '#fff' : theme.colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            {/* Recommendations Rail */}
            <View style={{ marginBottom: 20 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                    {getRecommendedEvents().map(event => (
                        <View key={event.id} style={{ width: 320, marginRight: 15 }}>
                            <EventCard event={event} isRecommended={true} />
                        </View>
                    ))}
                    {getRecommendedEvents().length === 0 && (
                        <Text
                            style={{
                                color: theme.colors.textSecondary,
                                fontStyle: 'italic',
                                marginHorizontal: 20,
                            }}
                        >
                            No recommendations yet.
                        </Text>
                    )}
                </ScrollView>
            </View>
        </Animated.View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {!isConnected && (
                <View style={styles.offlineBanner}>
                    <Text style={styles.offlineText}>Viewing cached events offline</Text>
                </View>
            )}
            {loading ? (
                <View style={{ paddingTop: 20 }}>
                    <SkeletonLoader />
                </View>
            ) : viewMode === 'list' ? (
                <Animated.SectionList
                    sections={[{ data: displayList }]}
                    keyExtractor={item => item.id}
                    renderItem={renderEvent}
                    renderSectionHeader={StickyHeader}
                    ListHeaderComponent={renderHeader}
                    stickySectionHeadersEnabled={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme.colors.primary]}
                            tintColor={theme.colors.primary}
                        />
                    }
                    onEndReached={() => {
                        if (hasMore && !isFetchingMore) {
                            fetchEvents(true);
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                        useNativeDriver: true,
                    })}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name="search-outline"
                                size={64}
                                color={theme.colors.textSecondary}
                                style={{ opacity: 0.5 }}
                            />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                {searchQuery
                                    ? `No events found for "${searchQuery}"`
                                    : 'No events found.'}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        isFetchingMore ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: theme.colors.textSecondary }}>
                                    Loading more...
                                </Text>
                            </View>
                        ) : null
                    }
                />
            ) : (
                MapView && (
                    <View style={{ flex: 1 }}>
                        <View style={{ paddingTop: 10 }}>
                            <StickyHeader />
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'flex-end',
                                paddingHorizontal: 20,
                                marginBottom: 10,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: theme.colors.surface,
                                    borderRadius: 20,
                                    overflow: 'hidden',
                                }}
                            >
                                <TouchableOpacity
                                    onPress={() => setViewMode('list')}
                                    style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 8,
                                        backgroundColor:
                                            viewMode === 'list'
                                                ? theme.colors.primary
                                                : 'transparent',
                                    }}
                                    accessible={true}
                                    accessibilityRole="button"
                                    accessibilityLabel="List view"
                                >
                                    <Ionicons
                                        name="list"
                                        size={20}
                                        color={
                                            viewMode === 'list'
                                                ? '#fff'
                                                : theme.colors.textSecondary
                                        }
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setViewMode('map')}
                                    style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 8,
                                        backgroundColor:
                                            viewMode === 'map'
                                                ? theme.colors.primary
                                                : 'transparent',
                                    }}
                                    accessible={true}
                                    accessibilityRole="button"
                                    accessibilityLabel="Map view"
                                >
                                    <Ionicons
                                        name="map"
                                        size={20}
                                        color={
                                            viewMode === 'map' ? '#fff' : theme.colors.textSecondary
                                        }
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View
                            style={{
                                flex: 1,
                                marginHorizontal: 20,
                                marginBottom: 20,
                                borderRadius: 16,
                                overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                            }}
                        >
                            <MapView
                                style={{ flex: 1 }}
                                initialRegion={{
                                    latitude: 28.7041,
                                    longitude: 77.1025,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                            >
                                {displayList
                                    .filter(
                                        e =>
                                            e.coordinates &&
                                            typeof e.coordinates === 'object' &&
                                            Number.isFinite(e.coordinates.latitude) &&
                                            Number.isFinite(e.coordinates.longitude),
                                    )
                                    .map(event => (
                                        <Marker key={event.id} coordinate={event.coordinates}>
                                            <Callout
                                                onPress={() =>
                                                    navigation.navigate('EventDetail', {
                                                        eventId: event.id,
                                                        action: 'view',
                                                    })
                                                }
                                            >
                                                <View style={{ width: 200, padding: 5 }}>
                                                    <Text
                                                        style={{
                                                            fontWeight: 'bold',
                                                            fontSize: 16,
                                                            marginBottom: 5,
                                                        }}
                                                    >
                                                        {event.title}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            color: '#666',
                                                            fontSize: 12,
                                                            marginBottom: 10,
                                                        }}
                                                        numberOfLines={2}
                                                    >
                                                        {event.description}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={{
                                                            backgroundColor: theme.colors.primary,
                                                            padding: 8,
                                                            borderRadius: 8,
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: '#fff',
                                                                fontWeight: 'bold',
                                                            }}
                                                        >
                                                            View Details
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </Callout>
                                        </Marker>
                                    ))}
                            </MapView>
                        </View>
                    </View>
                )
            )}

            {/* Feedback Modal */}
            <FeedbackModal
                visible={showFeedbackModal}
                feedbackRequest={currentFeedbackRequest}
                onClose={() => setShowFeedbackModal(false)}
                onSubmit={async feedbackData => {
                    if (!currentFeedbackRequest) return;
                    if (submitFeedback) {
                        await submitFeedback({
                            feedbackRequestId: currentFeedbackRequest.id,
                            eventId: currentFeedbackRequest.eventId,
                            clubId: currentFeedbackRequest.clubId,
                            userId: user.uid,
                            ...feedbackData,
                        });
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 20, // Increased padding
        paddingVertical: 12,
        borderRadius: 30, // Full Pill
        elevation: 4, // Slightly higher shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4, // Explicit shadow
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        borderWidth: 0,
    },
    filterWrapper: {
        height: 60,
    },
    filterContent: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        alignItems: 'center',
    },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        justifyContent: 'center',
        minWidth: 80,
        alignItems: 'center',
    },
    chipText: { fontSize: 13, fontWeight: '700' },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        marginLeft: 20,
        marginBottom: 15,
        letterSpacing: 1,
        color: '#fff',
        opacity: 0.9,
    },
    emptyContainer: { alignItems: 'center', marginTop: 50, padding: 20 },
    emptyText: { marginTop: 10, fontSize: 16 },
    offlineBanner: {
        backgroundColor: '#FF9800',
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    offlineText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
