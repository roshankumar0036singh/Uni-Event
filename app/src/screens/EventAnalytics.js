import { Ionicons } from '@expo/vector-icons';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function EventAnalytics({ route, navigation }) {
    const { eventId } = route.params;
    const { theme } = useTheme();
    const [participants, setParticipants] = useState([]);
    const [reminderCount, setReminderCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            // 1. Fetch Participants
            const pRef = collection(db, 'events', eventId, 'participants');
            const pSnap = await getDocs(pRef);
            const pList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setParticipants(pList);

            // 2. Fetch Reminder Count
            // Note: Reminders are stored as 'reminders/{userId_eventId}'
            // We can query by 'eventId' field
            const rRef = collection(db, 'reminders');
            const rQuery = query(rRef, where('eventId', '==', eventId));
            const rSnap = await getCountFromServer(rQuery);
            setReminderCount(rSnap.data().count);

            setLoading(false);
        } catch (e) {
            console.error('Analytics Error', e);
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading)
        return (
            <ScreenWrapper>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                    style={{ marginTop: 50 }}
                />
            </ScreenWrapper>
        );

    const renderStudent = ({ item }) => (
        <View
            style={[
                styles.studentCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
        >
            <View style={styles.studentInfo}>
                <Text style={[styles.studentName, { color: theme.colors.text }]}>{item.name}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>{item.email}</Text>
                <View style={styles.metaRow}>
                    <Text style={[styles.metaTag, { backgroundColor: theme.colors.secondary }]}>
                        {item.branch || 'N/A'}
                    </Text>
                    <Text style={[styles.metaTag, { backgroundColor: theme.colors.primary }]}>
                        Year: {item.year || '?'}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <Text style={[theme.typography.h2, { color: theme.colors.text, marginBottom: 20 }]}>
                    Stats & Analytics
                </Text>

                {/* Summary Cards */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="people" size={24} color={theme.colors.primary} />
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>
                            {participants.length}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                            Registrations
                        </Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="alarm" size={24} color={theme.colors.secondary} />
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>
                            {reminderCount}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                            Reminders Set
                        </Text>
                    </View>
                </View>

                <Text
                    style={[theme.typography.h3, { color: theme.colors.text, marginVertical: 15 }]}
                >
                    Participant List
                </Text>

                <FlatList
                    data={participants}
                    keyExtractor={item => item.id}
                    renderItem={renderStudent}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    ListEmptyComponent={
                        <Text style={{ color: theme.colors.textSecondary }}>
                            No registrations yet.
                        </Text>
                    }
                />
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    statsRow: { flexDirection: 'row', gap: 15, marginBottom: 10 },
    statCard: {
        flex: 1,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2, // Android shadow
    },
    statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    statLabel: { fontSize: 12 },
    studentCard: {
        marginBottom: 10,
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
    },
    studentName: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
    metaRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    metaTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 12,
        color: '#000',
        fontWeight: 'bold',
    },
});
