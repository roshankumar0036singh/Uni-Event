import { Ionicons } from '@expo/vector-icons';
import {
    collection,
    deleteDoc,
    doc,
    query,
    where,
    getDoc,
    getDocs,
    onSnapshot,
} from 'firebase/firestore';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LiquidPullToRefresh from '../components/LiquidPullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { formatEventDate, formatEventTime } from '../lib/formatEventDate';
import { cancelScheduledNotification } from '../lib/notificationService';
import { useTheme } from '../lib/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import PropTypes from 'prop-types';

export default function RemindersScreen({ navigation }) {
    const { user } = useAuth();
    const { theme, isDarkMode } = useTheme();
    const isFocused = useIsFocused();
    const styles = useMemo(() => getStyles(theme, isDarkMode), [theme, isDarkMode]);

    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isMounted = useRef(false);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const processRemindersSnapshot = async snapshot => {
        const list = [];

        const eventIds = [...new Set(snapshot.docs.map(d => d.data().eventId).filter(Boolean))];
        const eventMap = {};
        await Promise.all(
            eventIds.map(async id => {
                try {
                    const snap = await getDoc(doc(db, 'events', id));
                    if (snap.exists()) eventMap[id] = snap.data();
                } catch (e) {
                    console.error('Error fetching event for reminder:', e);
                }
            }),
        );

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const ed = eventMap[data.eventId] || {};
            list.push({
                id: docSnap.id,
                ...data,
                eventTitle: ed.title || 'Event',
                eventLocation: ed.location || '',
                bannerUrl: ed.bannerUrl || null,
            });
        });

        list.sort((a, b) => {
            const da = a.remindAt?.toDate ? a.remindAt.toDate() : new Date(a.remindAt);
            const db2 = b.remindAt?.toDate ? b.remindAt.toDate() : new Date(b.remindAt);
            return da - db2;
        });

        return list;
    };

    useEffect(() => {
        if (!user || !isFocused) return;

        setLoading(true);
        const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));

        const unsubscribe = onSnapshot(
            q,
            async snapshot => {
                const list = await processRemindersSnapshot(snapshot);
                if (isMounted.current) {
                    setReminders(list);
                    setLoading(false);
                }
            },
            error => {
                console.error('Reminders listener Error:', error);
                if (isMounted.current) {
                    setLoading(false);
                }
            },
        );

        return () => unsubscribe();
    }, [user, isFocused]);

    // Manual refresh allows the user to explicitly retry fetching data if network is unstable
    const handleRefresh = async () => {
        if (!user) return;
        setRefreshing(true);
        try {
            const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            const list = await processRemindersSnapshot(snapshot);

            if (isMounted.current) {
                setReminders(list);
            }
        } catch (error) {
            console.error('Refresh error:', error);
            Alert.alert('Error', 'Failed to refresh reminders.');
        } finally {
            setRefreshing(false);
        }
    };

    const { pullDistance, handleScroll, handleScrollEndDrag } = usePullToRefresh(refreshing, () => {
        handleRefresh();
    });

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
                    onScroll={handleScroll}
                    onScrollEndDrag={handleScrollEndDrag}
                    scrollEventThrottle={16}
                    renderItem={({ item }) => {
                        const dateObj = item.remindAt?.toDate
                            ? item.remindAt.toDate()
                            : new Date(item.remindAt);
                        const status = getRelativeTime(item.remindAt);
                        let badgeBg = '#E3F2FD';
                        if (status.isPassed) {
                            badgeBg = 'rgba(245, 158, 11, 0.15)';
                        } else if (isDarkMode) {
                            badgeBg = 'rgba(var(--primary-rgb), 0.15)';
                        }

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
                                            {formatEventDate(dateObj)} • {formatEventTime(dateObj)}
                                        </Text>
                                    </View>

                                    <View style={styles.timerContainer}>
                                        <View
                                            style={[
                                                styles.timerBadge,
                                                {
                                                    backgroundColor: badgeBg,
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
            <LiquidPullToRefresh
                pullDistance={pullDistance}
                isRefreshing={refreshing}
                color={theme.colors.primary}
            />
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

RemindersScreen.propTypes = {
    navigation: PropTypes.object,
};
