import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import EventCard from '../components/EventCard';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { db } from '../lib/firebaseConfig';

export default function MyEventsScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'events'), where('ownerId', '==', user.uid));

        const unsubscribe = onSnapshot(
            q,
            snapshot => {
                const list = [];
                snapshot.forEach(doc => {
                    list.push({ id: doc.id, ...doc.data() });
                });
                // Sort client-side by date
                list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setEvents(list);
                setLoading(false);
                setRefreshing(false);
            },
            err => {
                console.error(err);
                setLoading(false);
                setRefreshing(false);
            },
        );

        return () => unsubscribe();
    }, [user]);

    const handleDelete = async eventId => {
        if (Platform.OS === 'web') {
            try {
                await deleteDoc(doc(db, 'events', eventId));
            } catch (e) {
                alert('Error: Could not delete event');
            }
        } else {
            Alert.alert('Delete Event', 'Are you sure? This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'events', eventId));
                        } catch (e) {
                            Alert.alert('Error', 'Could not delete event');
                        }
                    },
                },
            ]);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
    };

    const renderItem = ({ item }) => (
        <View style={styles.cardContainer}>
            <EventCard event={item} showRegisterButton={false} style={{ marginBottom: 0 }} />

            <View
                style={[
                    styles.actionBar,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
            >
                {/* Status */}
                <View style={styles.statusContainer}>
                    <View
                        style={[
                            styles.dot,
                            {
                                backgroundColor:
                                    item.status === 'suspended'
                                        ? theme.colors.error
                                        : theme.colors.success,
                            },
                        ]}
                    />
                    <Text style={[styles.statusText, { color: theme.colors.text }]}>
                        {item.status === 'suspended' ? 'SUSPENDED' : 'Active'}
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.colors.primary + '15' }]}
                        onPress={() =>
                            navigation.navigate('AttendanceDashboard', {
                                eventId: item.id,
                                eventTitle: item.title,
                            })
                        }
                    >
                        <Ionicons name="bar-chart" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.colors.error + '15' }]}
                        onPress={() => handleDelete(item.id)}
                    >
                        <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    if (loading)
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </ScreenWrapper>
        );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: theme.colors.text }]}>My Events</Text>
                </View>

                <TouchableOpacity
                    onPress={() => navigation.navigate('CreateEvent')}
                    style={{ padding: 5 }}
                >
                    <Ionicons name="add-circle" size={32} color={theme.colors.primary} />
                </TouchableOpacity>
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
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons
                            name="calendar-outline"
                            size={64}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            You haven't created any events yet.
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.createBtnSmall,
                                { backgroundColor: theme.colors.primary },
                            ]}
                            onPress={() => navigation.navigate('CreateEvent')}
                        >
                            <Text style={styles.createBtnText}>Create Layout</Text>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={renderItem}
            />

            {/* Floating Action Button */}
            <TouchableOpacity
                style={[
                    styles.fab,
                    { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary },
                ]}
                onPress={() => navigation.navigate('CreateEvent')}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 28, fontWeight: 'bold' },
    list: { padding: 20, paddingBottom: 100 }, // Extra padding for FAB
    cardContainer: { marginBottom: 20 },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderTopWidth: 0,
        borderWidth: 1,
        marginTop: -10, // Overlap roughly with card bottom
        zIndex: -1,
        paddingTop: 15, // Compensate for overlap
    },
    statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontWeight: '600', fontSize: 14 },
    actions: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: { alignItems: 'center', marginTop: 80, gap: 15 },
    emptyText: { fontSize: 16 },
    createBtnSmall: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        marginTop: 10,
    },
    createBtnText: { color: '#fff', fontWeight: 'bold' },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
});
