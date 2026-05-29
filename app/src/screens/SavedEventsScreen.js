import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import EventCard from '../components/EventCard';
import LiquidPullToRefresh from '../components/LiquidPullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function SavedEventsScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [savedEvents, setSavedEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { pullDistance, handleScroll, handleScrollEndDrag } = usePullToRefresh(refreshing, () => {
        setRefreshing(true);
        fetchSavedEvents();
    });

    const fetchSavedEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'users', user.uid, 'savedEvents'));
            const snapshot = await getDocs(q);
            const list = [];

            // Fetch event details for each saved event
            await Promise.all(
                snapshot.docs.map(async docSnap => {
                    const data = docSnap.data();
                    try {
                        const eventDoc = await getDoc(doc(db, 'events', data.eventId));
                        if (eventDoc.exists()) {
                            list.push({
                                id: eventDoc.id,
                                ...eventDoc.data(),
                                savedAt: data.savedAt,
                            });
                        }
                    } catch (e) {
                        console.log('Error fetching event:', e);
                    }
                }),
            );

            // Sort by savedAt date (most recent first)
            list.sort((a, b) => {
                const dateA = new Date(a.savedAt);
                const dateB = new Date(b.savedAt);
                return dateB - dateA;
            });

            setSavedEvents(list);
        } catch (error) {
            console.error('Error fetching saved events:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSavedEvents();
    }, [fetchSavedEvents]);

    // 🚀 Task 3: Wrap list rendering element with useCallback to optimize functional layout memory recycling
    const renderItem = useCallback(({ item }) => <EventCard event={item} />, []);

    if (loading && !refreshing) {
        return (
            <ScreenWrapper showLogo={true}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                    style={{ marginTop: 50 }}
                />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper showLogo={true}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Saved Events</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        {savedEvents.length} {savedEvents.length === 1 ? 'event' : 'events'} saved
                    </Text>
                </View>

                {/* 🚀 Task 1: Replaced the standard native FlatList with high-efficiency Shopify FlashList */}
                <FlashList
                    data={savedEvents}
                    keyExtractor={item => item.id}
                    estimatedItemSize={180} // 🔥 Performance parameter pre-allocates memory for smooth 60fps scrolling
                    onScroll={handleScroll}
                    onScrollEndDrag={handleScrollEndDrag}
                    scrollEventThrottle={16}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons
                                    name="bookmark-outline"
                                    size={48}
                                    color={theme.colors.textSecondary}
                                />
                            </View>
                            <Text style={[styles.emptyText, { color: theme.colors.text }]}>
                                No saved events
                            </Text>
                            <Text
                                style={[styles.emptySubText, { color: theme.colors.textSecondary }]}
                            >
                                Tap the bookmark icon on any event to save it for later
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                />
                <LiquidPullToRefresh
                    pullDistance={pullDistance}
                    isRefreshing={refreshing}
                    color={theme.colors.primary}
                />
            </View>
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            marginBottom: 20,
        },
        title: {
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 5,
        },
        subtitle: {
            fontSize: 14,
        },
        emptyContainer: {
            alignItems: 'center',
            marginTop: 100,
            paddingHorizontal: 40,
        },
        emptyIconCircle: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: theme.colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
            ...theme.shadows.small,
        },
        emptyText: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 10,
        },
        emptySubText: {
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
        },
    });

SavedEventsScreen.propTypes = {
    navigation: PropTypes.object,
};
