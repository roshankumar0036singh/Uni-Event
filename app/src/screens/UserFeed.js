import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EventCard from '../components/EventCard';
import FeedbackModal from '../components/FeedbackModal';
import { EventListSkeleton } from '../components/SkeletonLoader';
import { useAuth } from '../lib/AuthContext';
import { submitFeedback } from '../lib/feedbackService';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

const FILTERS = ['Upcoming', 'Past', 'Cultural', 'Sports', 'Tech', 'Workshop', 'Seminar'];

export default function UserFeed({ navigation, headerContent }) {
    const { user, userData, role } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [participatingIds, setParticipatingIds] = useState([]); // Track joined events
    const [activeFilter, setActiveFilter] = useState('Upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Feedback Modal State
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [currentFeedbackRequest, setCurrentFeedbackRequest] = useState(null);

    const scrollY = useRef(new Animated.Value(0)).current;

    // Listen for my registrations
    useEffect(() => {
        if (!user) return;
        const q = collection(db, 'users', user.uid, 'participating');
        const unsub = onSnapshot(q, (snap) => {
            setParticipatingIds(snap.docs.map(d => d.id));
        });
        return unsub;
    }, [user]);

    // Listen for pending feedback requests
    useEffect(() => {
        if (!user) return;

        const feedbackQuery = query(
            collection(db, 'feedbackRequests'),
            where('userId', '==', user.uid),
            where('status', '==', 'pending'),
            limit(1) // Show one at a time
        );

        const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
            if (!snapshot.empty) {
                const requestDoc = snapshot.docs[0];
                setCurrentFeedbackRequest({
                    id: requestDoc.id,
                    ...requestDoc.data()
                });
                setShowFeedbackModal(true);
            }
        }, (err) => console.log('Feedback Listener Error', err));

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'events'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'suspended') return;
                list.push({ id: doc.id, ...data });
            });
            setEvents(list);
            setLoading(false);
            setRefreshing(false);
        }, (error) => { console.log("Error fetching events: ", error); setLoading(false); setRefreshing(false); });

        return () => unsubscribe();
    }, [role, user]);

    // Recommendation Logic: Views + User History + Freshness
    const getRecommendedEvents = () => {
        const now = new Date();
        const upcomingEvents = events.filter(e => new Date(e.startAt) >= now);

        if (upcomingEvents.length === 0) return [];

        // 1. Analyze User History (Favorite Categories)
        const categoryCounts = {};
        events.filter(e => participatingIds.includes(e.id)).forEach(e => {
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
        const now = new Date();
        let filtered = events;

        // 0. Search Query Filtering
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.title?.toLowerCase().includes(query) ||
                e.description?.toLowerCase().includes(query) ||
                e.location?.toLowerCase().includes(query)
            );
        }

        // 1. Strict Profile Filtering (Department & Year)
        if (role === 'student' && userData && userData.branch && userData.year) { // Only filter if we have complete user data
            filtered = filtered.filter(e => {
                // Check Department
                const targetDepts = e.target?.departments || [];
                const userDept = userData.branch || 'Unknown';
                // If no specific departments listed, assume Open to All
                const deptMatch = targetDepts.length === 0 || targetDepts.includes('All') || targetDepts.includes(userDept);

                // Check Year
                const targetYears = e.target?.years || [];
                const userYear = parseInt(userData.year || 0);
                // If targetYears is empty/undefined, assume open to all.
                const yearMatch = targetYears.length === 0 || targetYears.includes(userYear);

                return deptMatch && yearMatch;
            });
        }

        // 2. Tab/Category Filtering
        // Common Date Threshold
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 2. Tab/Category Filtering

        if (activeFilter === 'Upcoming') {
            // Show events that ends in the future (includes ongoing)
            filtered = filtered.filter(e => {
                const end = e.endAt ? new Date(e.endAt) : new Date(new Date(e.startAt).getTime() + 24 * 60 * 60 * 1000); // Fallback to 24h if no endAt
                return end >= now;
            });
            // Sort: Closest upcoming first
            filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
        } else if (activeFilter === 'Past') {
            // Show events that have ended
            filtered = filtered.filter(e => {
                const end = e.endAt ? new Date(e.endAt) : new Date(new Date(e.startAt).getTime() + 24 * 60 * 60 * 1000);
                return end < now;
            });
            // Sort: Most recent past first
            filtered.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
        } else {
            // Category filters - HIDE ENDED EVENTS
            filtered = filtered.filter(e => {
                const end = e.endAt ? new Date(e.endAt) : new Date(new Date(e.startAt).getTime() + 24 * 60 * 60 * 1000);
                return e.category === activeFilter && end >= now;
            });
            // Sort: Closest upcoming first for categories too
            filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
        }

        return filtered;
    };

    const displayList = getFilteredEvents();

    const onRefresh = () => {
        setRefreshing(true);
    };

    const StickyHeader = () => (
        <View style={{ backgroundColor: theme.colors.background, paddingBottom: 10 }}>
            {/* Search Bar - Floating Pill */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, ...theme.shadows.small }]}>
                <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search events..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
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
                                style={{ marginRight: 10, borderRadius: 25, ...theme.shadows.small }}
                            >
                                {isActive ? (
                                    <LinearGradient
                                        colors={[theme.colors.primary, theme.colors.secondary || '#FFC107']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={styles.chip}
                                    >
                                        <Text style={[styles.chipText, { color: '#fff' }]}>{f}</Text>
                                    </LinearGradient>
                                ) : (
                                    <View style={[styles.chip, { backgroundColor: theme.colors.surface }]}>
                                        <Text style={[styles.chipText, { color: theme.colors.textSecondary }]}>{f}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );

    const renderEvent = ({ item }) => (
        <View style={{ paddingHorizontal: 20 }}>
            <EventCard
                event={item}
                isRegistered={participatingIds.includes(item.id)}
                onLike={() => { }}
                onShare={async () => {
                    try {
                        await Share.share({
                            message: `Check out this event: ${item.title} at ${item.location}!`,
                        });
                    } catch (e) { console.log(e); }
                }}
            />
        </View>
    );

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, -50],
        extrapolate: 'clamp'
    });

    const renderHeader = () => (
        <Animated.View style={{ transform: [{ translateY: headerTranslateY }] }}>
            {/* Recommendations Rail */}
            <View style={{ marginBottom: 20 }}>
                <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {getRecommendedEvents().map(event => (
                        <View key={event.id} style={{ width: 320, marginRight: 15 }}>
                            <EventCard event={event} isRecommended={true} />
                        </View>
                    ))}
                    {getRecommendedEvents().length === 0 && (
                        <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic', marginHorizontal: 20 }}>No recommendations yet.</Text>
                    )}
                </ScrollView>
            </View>
        </Animated.View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {loading ? (
                <View style={{ paddingTop: 20 }}>
                    <EventListSkeleton />
                </View>
            ) : (
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
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: true }
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} style={{ opacity: 0.5 }} />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                {searchQuery ? `No events found for "${searchQuery}"` : "No events found."}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Feedback Modal */}
            <FeedbackModal
                visible={showFeedbackModal}
                feedbackRequest={currentFeedbackRequest}
                onClose={() => setShowFeedbackModal(false)}
                onSubmit={async (feedbackData) => {
                    if (!currentFeedbackRequest) return;
                    if (submitFeedback) {
                        await submitFeedback({
                            feedbackRequestId: currentFeedbackRequest.id,
                            eventId: currentFeedbackRequest.eventId,
                            clubId: currentFeedbackRequest.clubId,
                            userId: user.uid,
                            ...feedbackData
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
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 // Explicit shadow
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        borderWidth: 0,
        ...Platform.select({
            web: { outlineStyle: 'none' }
        })
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
        alignItems: 'center'
    },
    chipText: { fontSize: 13, fontWeight: '700' },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        marginLeft: 20,
        marginBottom: 15,
        letterSpacing: 1,
        color: '#fff',
        opacity: 0.9
    },
    emptyContainer: { alignItems: 'center', marginTop: 50, padding: 20 },
    emptyText: { marginTop: 10, fontSize: 16 },
});
