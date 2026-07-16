import { Ionicons } from '@expo/vector-icons';
import { collection, documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import EventCard from '../components/EventCard';
import LiquidPullToRefresh from '../components/LiquidPullToRefresh';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function MyVolunteerEventsScreen() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const { pullDistance, handleScroll, handleScrollEndDrag } = usePullToRefresh(refreshing, () => {
        setRefreshing(true);
        setRefreshNonce(n => n + 1);
    });

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // 1. Get List of Event IDs from "volunteering" subcollection
        const volunteeringRef = collection(db, 'users', user.uid, 'volunteering');

        const unsubscribe = onSnapshot(
            volunteeringRef,
            async snapshot => {
                // Filter out 'dropped' status
                const activeDocs = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.status !== 'dropped';
                });
                const eventIds = activeDocs.map(doc => doc.id);

                if (eventIds.length === 0) {
                    setEvents([]);
                    setLoading(false);
                    setRefreshing(false);
                    return;
                }

                try {
                    // Chunking for >10 items
                    const chunks = [];
                    for (let i = 0; i < eventIds.length; i += 10) {
                        chunks.push(eventIds.slice(i, i + 10));
                    }

                    let allEvents = [];
                    for (const chunk of chunks) {
                        const q = query(collection(db, 'events'), where(documentId(), 'in', chunk));
                        const querySnapshot = await getDocs(q);
                        const chunkEvents = querySnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                        }));
                        allEvents = [...allEvents, ...chunkEvents];
                    }

                    // Sort by date (optional)
                    allEvents.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

                    setEvents(allEvents);
                } catch (error) {
                    console.error('Error fetching volunteer events:', error);
                } finally {
                    setLoading(false);
                    setRefreshing(false);
                }
            },
            error => {
                console.error('Error listening to volunteering:', error);
                setLoading(false);
                setRefreshing(false);
            },
        );

        return () => unsubscribe();
    }, [user, refreshNonce]);

    const onRefresh = () => {
        setRefreshing(true);
        setRefreshNonce(n => n + 1);
    };

    const renderItem = useCallback(({ item }) => <EventCard event={item} />, []);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                    My Volunteer Events
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    Events you are volunteering for
                </Text>
            </View>

            <FlatList
                data={events}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.colors.primary]}
                        tintColor={theme.colors.primary}
                    />
                }
                renderItem={renderItem}
                onScroll={handleScroll}
                onScrollEndDrag={handleScrollEndDrag}
                scrollEventThrottle={16}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="hand-left-outline"
                            size={64}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            You haven&apos;t volunteered for any events yet.
                        </Text>
                    </View>
                }
            />
            <LiquidPullToRefresh
                pullDistance={pullDistance}
                isRefreshing={refreshing}
                color={theme.colors.primary}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, paddingTop: 60, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold' },
    subtitle: { fontSize: 16 },
    list: { padding: 20 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 10, fontSize: 16 },
});
