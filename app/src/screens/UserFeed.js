import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, limit, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PropTypes from 'prop-types';
import {
    Animated,
    Alert,
    Platform,
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
import LiquidPullToRefresh from '../components/LiquidPullToRefresh';
import SkeletonLoader from '../components/SkeletonLoader';
import { useAuth } from '../lib/AuthContext';
import { submitFeedback } from '../lib/feedbackService';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import { useIsFocused } from '@react-navigation/native';

const FILTERS = ['Upcoming', 'Past', 'Cultural', 'Sports', 'Tech', 'Workshop', 'Seminar'];

const UserFeedStickyHeader = ({
    theme,
    searchQuery,
    setSearchQuery,
    updateHistory,
    setShowHistory,
    showHistory,
    searchHistory,
    clearHistory,
    persistSearchHistory,
    activeFilter,
    setActiveFilter,
}) => (
    <View style={{ backgroundColor: theme.colors.background, paddingBottom: 10 }}>
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
                onChangeText={text => {
                    setSearchQuery(text);
                    updateHistory(text);
                    if (text.trim() !== '') setShowHistory(false);
                }}
                onFocus={() => {
                    if (searchQuery.trim() === '') setShowHistory(true);
                }}
                onBlur={() => {
                    setShowHistory(false);
                    persistSearchHistory(searchQuery);
                }}
                onSubmitEditing={() => {
                    persistSearchHistory(searchQuery);
                }}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} testID="clear-search-button">
                    <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
        {showHistory && searchHistory.length > 0 && (
            <View style={styles.historyContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.historyScroll}
                >
                    {searchHistory.map(qh => (
                        <TouchableOpacity
                            key={qh}
                            style={styles.historyChip}
                            onPress={() => {
                                setSearchQuery(qh);
                                setShowHistory(false);
                            }}
                        >
                            <Text style={styles.historyChipText}>{qh}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity
                    onPress={clearHistory}
                    style={styles.clearHistoryBtn}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search history"
                    accessibilityHint="Deletes all saved search history"
                >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>
        )}

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
                                    <Text style={[styles.chipText, { color: '#fff' }]}>{f}</Text>
                                </LinearGradient>
                            ) : (
                                <View
                                    style={[styles.chip, { backgroundColor: theme.colors.surface }]}
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

UserFeedStickyHeader.propTypes = {
    theme: PropTypes.object.isRequired,
    searchQuery: PropTypes.string.isRequired,
    setSearchQuery: PropTypes.func.isRequired,
    updateHistory: PropTypes.func.isRequired,
    setShowHistory: PropTypes.func.isRequired,
    showHistory: PropTypes.bool.isRequired,
    searchHistory: PropTypes.array.isRequired,
    clearHistory: PropTypes.func.isRequired,
    persistSearchHistory: PropTypes.func.isRequired,
    activeFilter: PropTypes.string.isRequired,
    setActiveFilter: PropTypes.func.isRequired,
};

export default function UserFeed() {
    const { user, userData, role } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [participatingIds, setParticipatingIds] = useState([]); // Track joined events
    const [activeFilter, setActiveFilter] = useState('Upcoming');
    const [searchHistory, setSearchHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState(''); // filtering — 300ms debounced
    const debounceTimer = useRef(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [currentFeedbackRequest, setCurrentFeedbackRequest] = useState(null);
    const scrollY = useRef(new Animated.Value(0)).current;

    const isFocused = useIsFocused();

    //  debounce effect
    // Debounce effect — 300ms delay before dispatching query to filter (#304)
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(debounceTimer.current);
    }, [searchQuery]);

    // Load persisted search history on component mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const stored = await AsyncStorage.getItem('searchHistory');
                if (stored) {
                    setSearchHistory(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Failed to load search history', e);
            }
        };
        loadHistory();
    }, []);

    const updateHistory = query => {
        if (!query) return;
        // Update in-memory only; no AsyncStorage side‑effect
        setSearchHistory(prev => {
            const filtered = prev.filter(q => q !== query);
            return [query, ...filtered].slice(0, 5);
        });
    };

    // Persist search history to AsyncStorage (called on submit/blur)
    const persistSearchHistory = async raw => {
        const normalized = raw?.trim();
        if (!normalized) return;
        setSearchHistory(prev => {
            const filtered = prev.filter(q => q !== normalized);
            const newHist = [normalized, ...filtered].slice(0, 5);
            AsyncStorage.setItem('searchHistory', JSON.stringify(newHist)).catch(e =>
                console.error('Failed to save search history', e),
            );
            return newHist;
        });
    };

    // Clear history handler
    const clearHistory = async () => {
        try {
            await AsyncStorage.removeItem('searchHistory');
        } catch (e) {
            console.error('Failed to clear search history', e);
        }
        setSearchHistory([]);
    };
    useEffect(() => {
        if (!user || !isFocused) return;
        const participatingQuery = collection(db, 'users', user.uid, 'participating');
        const unsub = onSnapshot(participatingQuery, snap => {
            setParticipatingIds(snap.docs.map(d => d.id));
        });
        return unsub;
    }, [user, isFocused]);

    // Listen for pending feedback requests
    useEffect(() => {
        if (!user || !isFocused) return;

        const feedbackQuery = query(
            collection(db, 'feedbackRequests'),
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
    }, [user, isFocused]);

    useEffect(() => {
        if (!user || !isFocused) {
            setLoading(false);
            return;
        }

        // Fetching events. ideally separate query.
        const eventsQuery = query(collection(db, 'events'));

        const unsubscribe = onSnapshot(
            eventsQuery,
            snapshot => {
                const list = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.status === 'suspended') return;
                    if (data.deletedAt != null) return;
                    list.push({ id: doc.id, ...data });
                });
                setEvents(list);
                setLoading(false);
                setRefreshing(false);
            },
            error => console.log('Event Listener Error', error),
        );

        return () => unsubscribe();
    }, [role, user, isFocused]);

    // Recommendation Logic: Views + User History + Freshness
    const getRecommendedEvents = () => {
        const now = new Date();
        const upcomingEvents = events.filter(e => new Date(e.startAt) >= now);

        if (upcomingEvents.length === 0) return [];

        // 1. Analyze User History (Favorite Categories)
        const categoryCounts = {};
        events
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
        const now = new Date();
        let filtered = events;

        // 0. Search Query Filtering
        if (debouncedQuery.trim()) {
            const query = debouncedQuery.toLowerCase();
            filtered = filtered.filter(
                e =>
                    e.title?.toLowerCase().includes(query) ||
                    e.description?.toLowerCase().includes(query) ||
                    e.location?.toLowerCase().includes(query),
            );
        }

        // 1. Strict Profile Filtering (Department & Year)
        if (role === 'student' && userData?.branch && userData?.year) {
            // Only filter if we have complete user data
            filtered = filtered.filter(e => {
                // Check Department
                const targetDepts = e.target?.departments || [];
                const userDept = userData.branch || 'Unknown';
                // If no specific departments listed, assume Open to All
                const deptMatch =
                    targetDepts.length === 0 ||
                    targetDepts.includes('All') ||
                    targetDepts.includes(userDept);

                // Check Year
                const targetYears = e.target?.years || [];
                const userYear = parseInt(userData.year || 0);
                // If targetYears is empty/undefined, assume open to all.
                const yearMatch = targetYears.length === 0 || targetYears.includes(userYear);

                return deptMatch && yearMatch;
            });
        }

        // 2. Tab/Category Filtering

        if (activeFilter === 'Upcoming') {
            // Show events that ends in the future (includes ongoing)
            filtered = filtered.filter(e => {
                const end = e.endAt
                    ? new Date(e.endAt)
                    : new Date(new Date(e.startAt).getTime() + 24 * 60 * 60 * 1000); // Fallback to 24h if no endAt
                return end >= now;
            });
            // Sort: Closest upcoming first
            filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
        } else if (activeFilter === 'Past') {
            // Show events that have ended
            filtered = filtered.filter(e => {
                const end = e.endAt
                    ? new Date(e.endAt)
                    : new Date(new Date(e.startAt).getTime() + 24 * 60 * 60 * 1000);
                return end < now;
            });
            // Sort: Most recent past first
            filtered.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
        } else {
            // Category filters - HIDE ENDED EVENTS
            filtered = filtered.filter(e => {
                const end = e.endAt
                    ? new Date(e.endAt)
                    : new Date(new Date(e.startAt).getTime() + 24 * 60 * 60 * 1000);
                return e.category === activeFilter && end >= now;
            });
            // Sort: Closest upcoming first for categories too
            filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
        }

        return filtered;
    };

    const displayList = getFilteredEvents();

    const onRefresh = useCallback(async () => {
        if (!user) return;
        setRefreshing(true);
        try {
            const refreshEventsQuery = query(collection(db, 'events'));
            const snapshot = await getDocs(refreshEventsQuery);
            const list = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'suspended') return;
                if (data.deletedAt != null) return;
                list.push({ id: doc.id, ...data });
            });
            setEvents(list);
        } catch (error) {
            console.error('Refresh error:', error);
            Alert.alert('Error', 'Failed to refresh events.');
        } finally {
            setRefreshing(false);
        }
    }, [user]);

    const [pullDistance, setPullDistance] = useState(0);
    const lastPullRef = useRef(0);

    useEffect(() => {
        const listenerId = scrollY.addListener(({ value }) => {
            lastPullRef.current = Math.max(0, -value);
            setPullDistance(lastPullRef.current);
        });
        return () => scrollY.removeListener(listenerId);
    }, [scrollY]);

    const handleScrollEndDrag = useCallback(() => {
        if (lastPullRef.current >= 80 && !refreshing) {
            onRefresh();
        }
    }, [refreshing, onRefresh]);

    const renderEvent = ({ item }) => (
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
                        console.error('Share Error:', e);
                        Alert.alert('Error', 'Failed to share the event.');
                    }
                }}
            />
        </View>
    );

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, -50],
        extrapolate: 'clamp',
    });

    const renderHeader = () => (
        <Animated.View style={{ transform: [{ translateY: headerTranslateY }] }}>
            {/* Recommendations Rail */}
            <View style={{ marginBottom: 20 }}>
                <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
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

    const renderStickyHeader = useCallback(
        () => (
            <UserFeedStickyHeader
                theme={theme}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                updateHistory={updateHistory}
                setShowHistory={setShowHistory}
                showHistory={showHistory}
                searchHistory={searchHistory}
                clearHistory={clearHistory}
                persistSearchHistory={persistSearchHistory}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
            />
        ),
        [
            theme,
            searchQuery,
            setSearchQuery,
            updateHistory,
            setShowHistory,
            showHistory,
            searchHistory,
            clearHistory,
            persistSearchHistory,
            activeFilter,
            setActiveFilter,
        ],
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {loading ? (
                <View style={{ paddingTop: 20 }}>
                    <SkeletonLoader />
                </View>
            ) : (
                <Animated.SectionList
                    sections={[{ data: displayList }]}
                    keyExtractor={item => item.id}
                    renderItem={renderEvent}
                    renderSectionHeader={renderStickyHeader}
                    ListHeaderComponent={renderHeader}
                    stickySectionHeadersEnabled={true}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                        useNativeDriver: true,
                    })}
                    onScrollEndDrag={handleScrollEndDrag}
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
                />
            )}

            <LiquidPullToRefresh
                pullDistance={pullDistance}
                isRefreshing={refreshing}
                color={theme.colors.primary}
            />

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
        ...Platform.select({
            web: { outlineStyle: 'none' },
        }),
    },
    historyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 10,
    },
    historyScroll: {
        flexGrow: 0,
    },
    historyChip: {
        backgroundColor: '#eee',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginRight: 8,
    },
    historyChipText: {
        fontSize: 13,
        color: '#333',
    },
    clearHistoryBtn: {
        marginLeft: 8,
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
});
