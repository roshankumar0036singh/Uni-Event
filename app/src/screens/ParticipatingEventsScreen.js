import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import EventCard from '../components/EventCard';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { theme as staticTheme } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function ParticipatingEventsScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // 1. Listen to 'participating' subcollection
        const q = collection(db, 'users', user.uid, 'participating');

        const unsubscribe = onSnapshot(q, async snapshot => {
            const eventIds = snapshot.docs.map(d => d.id);

            if (eventIds.length === 0) {
                setEvents([]);
                setLoading(false);
                return;
            }

            // 2. Fetch details for these events
            // Firestore 'in' query supports max 10/30 items.
            // Better to fetch individually or use a smart query if list is small.
            // For MVP, we fetch individually (parallelized).

            try {
                const eventPromises = eventIds.map(id => getDoc(doc(db, 'events', id)));
                const eventDocs = await Promise.all(eventPromises);

                const list = eventDocs
                    .filter(d => d.exists())
                    .map(d => ({ id: d.id, ...d.data() }));

                // Sort by date (Upcoming first)
                list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

                setEvents(list);
            } catch (e) {
                console.error('Error fetching participating events', e);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user]);

    if (loading)
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Going</Text>
            </View>

            <FlatList
                data={events}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: staticTheme.spacing.m }}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
                        You haven&apos;t joined any events yet.
                    </Text>
                }
                renderItem={({ item }) => (
                    <EventCard
                        event={item}
                        isRegistered={true} // By definition
                        onLike={() => {}}
                        onShare={() => {}}
                    />
                )}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: staticTheme.spacing.s,
        marginBottom: staticTheme.spacing.m,
        gap: 10,
    },
    empty: { textAlign: 'center', marginTop: 50 },
});

ParticipatingEventsScreen.propTypes = {
    navigation: PropTypes.object,
};
