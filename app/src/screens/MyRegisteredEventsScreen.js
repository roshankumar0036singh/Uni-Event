import { Ionicons } from '@expo/vector-icons';
import { collection, documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import EventCard from '../components/EventCard';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function MyRegisteredEventsScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // 1. Get List of Event IDs from "participating" subcollection
        const participationsRef = collection(db, 'users', user.uid, 'participating');

        const unsubscribe = onSnapshot(participationsRef, async snapshot => {
            const eventIds = snapshot.docs.map(doc => doc.id);

            if (eventIds.length === 0) {
                setEvents([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Event Details for these IDs
            // Firestore "in" query limited to 10 items. If > 10, need multiple queries or client-side filter
            // For simplicity, we'll do client side or basic chunks.
            // Better approach: Store minimal event data in 'participating' to avoid 2nd query?
            // Current approach: Query 'events' where documentId IN [ids]

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
                console.error('Error fetching registered events:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user]);

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
                <Text style={[styles.title, { color: theme.colors.text }]}>My Calendar</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    Events you are attending
                </Text>
            </View>

            <FlatList
                data={events}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => <EventCard event={item} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="calendar-outline"
                            size={64}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            You haven&apos;t registered for any events yet.
                        </Text>
                    </View>
                }
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

MyRegisteredEventsScreen.propTypes = {
    navigation: PropTypes.object,
};
