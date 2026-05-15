import { Ionicons } from '@expo/vector-icons';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    getDoc,
    onSnapshot,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { cancelScheduledNotification } from '../lib/notificationService';
import { useTheme } from '../lib/ThemeContext';

export default function RemindersScreen({ navigation }) {
    const { user } = useAuth();
    const { theme, isDarkMode } = useTheme();
    const styles = useMemo(() => getStyles(theme, isDarkMode), [theme, isDarkMode]);

    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));

        const unsubscribe = onSnapshot(
            q,
            async snapshot => {
                const list = [];
                // Parallel fetch for speed
                await Promise.all(
                    snapshot.docs.map(async docSnap => {
                        const data = docSnap.data();
                        let eventTitle = 'Event';
                        let eventLocation = '';
                        let bannerUrl = null;
                        try {
                            // We could cache this or use a separate listener but for now this is fine
                            const eventDoc = await getDoc(doc(db, 'events', data.eventId));
                            if (eventDoc.exists()) {
                                const ed = eventDoc.data();
                                eventTitle = ed.title;
                                eventLocation = ed.location;
                                bannerUrl = ed.bannerUrl;
                            }
                        } catch (e) {
                            console.log(e);
                        }

                        list.push({
                            id: docSnap.id,
                            eventTitle,
                            eventLocation,
                            bannerUrl,
                            ...data,
                        });
                    }),
                );

                // Sort by remindAt
                list.sort((a, b) => {
                    const da = a.remindAt?.toDate ? a.remindAt.toDate() : new Date(a.remindAt);
                    const db = b.remindAt?.toDate ? b.remindAt.toDate() : new Date(b.remindAt);
                    return da - db;
                });

                setReminders(list);
                setLoading(false);
            },
            error => {
                console.error('Reminders listener Error:', error);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [user]);

    // Manual refresh is now less critical but we can keep it for network retry
    const handleRefresh = () => {
        // onSnapshot auto-reconnects, but if we want to force re-render or check connectivity
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    const handleDelete = async item => {
        // Directly delete without confirmation as requested
        await performDelete(item);
    };

    const performDelete = async item => {
        try {
            console.log('Deleting reminder:', item.id);
            if (item.notificationId) {
                console.log('Cancelling notification:', item.notificationId);
                await cancelScheduledNotification(item.notificationId);
            }
            console.log('Deleting from Firestore...');
            await deleteDoc(doc(db, 'reminders', item.id));
            console.log('Updating local state...');
            setReminders(prev => prev.filter(r => r.id !== item.id));
            console.log('Reminder deleted successfully');
        } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', `Could not delete reminder: ${error.message}`);
        }
    };

    const getRelativeTime = dateStr => {
        const date = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr);
        const now = new Date();
        const diffMs = date - now;
        const diffMins = Math.round(diffMs / 60000);
        const diffHrs = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMs < 0) return { text: 'Passed', isPassed: true, color: '#F59E0B' }; // Gold/Orange
        if (diffMins < 60)
            return { text: `${diffMins}m remaining`, isPassed: false, color: theme.colors.primary };
        if (diffHrs < 24)
            return { text: `${diffHrs}h remaining`, isPassed: false, color: theme.colors.primary };
        return { text: `${diffDays}d remaining`, isPassed: false, color: theme.colors.primary };
    };

    return (
        <ScreenWrapper>
            <View style={styles.headerContainer}>
                <Text style={styles.header}>My Reminders</Text>
                <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                    style={{ marginTop: 50 }}
                />
            ) : (
                <FlatList
                    data={reminders}
                    keyExtractor={item => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    renderItem={({ item }) => {
                        const dateObj = item.remindAt?.toDate
                            ? item.remindAt.toDate()
                            : new Date(item.remindAt);
                        const status = getRelativeTime(item.remindAt);

                        return (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() =>
                                    navigation.navigate('EventDetail', { eventId: item.eventId })
                                }
                            >
                                <Image
                                    source={{
                                        uri: item.bannerUrl || 'https://via.placeholder.com/150',
                                    }}
                                    style={styles.cardImage}
                                />
                                <View style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.eventTitle} numberOfLines={1}>
                                            {item.eventTitle}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => handleDelete(item)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons
                                                name="trash-outline"
                                                size={20}
                                                color={theme.colors.error}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.row}>
                                        <Ionicons
                                            name="time-outline"
                                            size={14}
                                            color={theme.colors.textSecondary}
                                        />
                                        <Text style={styles.dateText}>
                                            {dateObj.toLocaleDateString()} •{' '}
                                            {dateObj.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    </View>

                                    <View style={styles.timerContainer}>
                                        <View
                                            style={[
                                                styles.timerBadge,
                                                {
                                                    backgroundColor: status.isPassed
                                                        ? 'rgba(245, 158, 11, 0.15)'
                                                        : isDarkMode
                                                          ? 'rgba(var(--primary-rgb), 0.15)'
                                                          : '#E3F2FD',
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name={status.isPassed ? 'alarm' : 'timer-outline'}
                                                size={14}
                                                color={status.color}
                                            />
                                            <Text
                                                style={[styles.timerText, { color: status.color }]}
                                            >
                                                {status.text}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons
                                    name="notifications-off-outline"
                                    size={40}
                                    color={theme.colors.textSecondary}
                                />
                            </View>
                            <Text style={styles.emptyText}>No reminders set</Text>
                            <Text style={styles.emptySubText}>
                                Tap the bell icon on any event to get notified.
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}
                />
            )}
        </ScreenWrapper>
    );
}

const getStyles = (theme, isDarkMode) =>
    StyleSheet.create({
        headerContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.m,
            paddingHorizontal: 20,
            paddingTop: 10,
        },
        header: { fontSize: 28, fontWeight: 'bold', color: theme.colors.text },
        refreshBtn: {
            padding: 8,
            backgroundColor: theme.colors.surface,
            borderRadius: 20,
            ...theme.shadows.small,
        },

        card: {
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            marginBottom: 16,
            flexDirection: 'row',
            ...theme.shadows.small,
            padding: 12,
            alignItems: 'center',
            gap: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        cardImage: {
            width: 70,
            height: 70,
            borderRadius: 12,
            backgroundColor: theme.colors.border,
        },
        cardContent: { flex: 1, justifyContent: 'center' },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 4,
        },
        eventTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            flex: 1,
            marginRight: 8,
            lineHeight: 22,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
        },
        dateText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500' },

        timerContainer: { flexDirection: 'row' },
        timerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
        },
        timerText: { fontSize: 12, fontWeight: '700' },

        emptyContainer: { alignItems: 'center', marginTop: 100 },
        emptyIconCircle: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
            ...theme.shadows.small,
        },
        emptyText: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
        emptySubText: { color: theme.colors.textSecondary, marginTop: 8 },
    });
