import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import EventCard from '../components/EventCard';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function SavedEventsScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [savedEvents, setSavedEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    const handleRefresh = () => {
        setRefreshing(true);
        fetchSavedEvents();
    };

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

                <FlatList
                    data={savedEvents}
                    keyExtractor={item => item.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[theme.colors.primary]}
                        />
                    }
                    renderItem={({ item }) => <EventCard event={item} />}
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
