import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function MyStreakScreen() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const styles = useMemo(() => getStyles(theme), [theme]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(
            userRef,
            snapshot => {
                if (snapshot.exists()) {
                    setUserData(snapshot.data());
                }
                setLoading(false);
            },
            error => {
                console.error('Error fetching streak data:', error);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [user]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    const currentStreak = userData?.currentStreak || 0;
    const longestStreak = userData?.longestStreak || 0;
    const certificates = userData?.certificates || [];

    // progress toward next milestone (every 4 weeks)
    const progress = currentStreak % 4 === 0 && currentStreak > 0 ? 4 : currentStreak % 4;
    const progressPercent = (progress / 4) * 100;

    const weeksLeft = 4 - progress;
    const weekSuffix = weeksLeft === 1 ? '' : 's';
    const progressHint =
        progress === 4
            ? '🎉 Milestone reached! Certificate awarded.'
            : `${weeksLeft} more week${weekSuffix} to earn the Dedicated Student certificate`;

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>My Streak</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    Attend events every week to grow your streak
                </Text>
            </View>

            {/* current Streak Card */}
            <View style={[styles.streakCard, { backgroundColor: theme.colors.card }]}>
                <View style={styles.flameRow}>
                    <MaterialIcons
                        name="local-fire-department"
                        size={40}
                        color={theme.colors.primary}
                    />
                    <Text style={[styles.streakNumber, { color: theme.colors.primary }]}>
                        {currentStreak}
                    </Text>
                </View>
                <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
                    week streak
                </Text>
                {currentStreak === 0 && (
                    <Text style={[styles.streakHint, { color: theme.colors.textSecondary }]}>
                        Check in to an event this week to start your streak!
                    </Text>
                )}
            </View>

            {/* stats Row */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                    <Ionicons name="trophy-outline" size={28} color={theme.colors.primary} />
                    <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                        {longestStreak}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        Longest Streak
                    </Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                    <Ionicons name="ribbon-outline" size={28} color={theme.colors.primary} />
                    <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                        {certificates.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        Certificates
                    </Text>
                </View>
            </View>

            {/* progress to next milestone */}
            <View style={[styles.progressCard, { backgroundColor: theme.colors.card }]}>
                <View style={styles.progressHeader}>
                    <Text style={[styles.progressTitle, { color: theme.colors.text }]}>
                        Progress to next milestone
                    </Text>
                    <Text style={[styles.progressCount, { color: theme.colors.primary }]}>
                        {progress}/4 weeks
                    </Text>
                </View>

                {/* progress bar */}
                <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border }]}>
                    <View
                        style={[
                            styles.progressBarFill,
                            {
                                backgroundColor: theme.colors.primary,
                                width: `${progressPercent}%`,
                            },
                        ]}
                    />
                </View>

                <Text style={[styles.progressHint, { color: theme.colors.textSecondary }]}>
                    {progressHint}
                </Text>
            </View>

            {/* weekly indicators */}
            <View style={[styles.weeksCard, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>This cycle</Text>
                <View style={styles.weeksRow}>
                    {[1, 2, 3, 4].map(week => (
                        <View key={week} style={styles.weekItem}>
                            <View
                                style={[
                                    styles.weekCircle,
                                    {
                                        backgroundColor:
                                            week <= progress
                                                ? theme.colors.primary
                                                : theme.colors.border,
                                    },
                                ]}
                            >
                                {week <= progress ? (
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                ) : (
                                    <Text
                                        style={[
                                            styles.weekNum,
                                            { color: theme.colors.textSecondary },
                                        ]}
                                    >
                                        {week}
                                    </Text>
                                )}
                            </View>
                            <Text style={[styles.weekLabel, { color: theme.colors.textSecondary }]}>
                                Wk {week}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* certificates section */}
            {certificates.length > 0 && (
                <View style={styles.card}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                        Certificates ({certificates.length})
                    </Text>
                    {certificates.map((cert, i) => (
                        <View
                            key={`${cert.type}-${cert.awardedAt}-${i}`}
                            style={[
                                styles.certRow,
                                i < certificates.length - 1 && styles.certDivider,
                                { borderBottomColor: theme.colors.border },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="school-outline"
                                size={28}
                                color={theme.colors.primary}
                            />
                            <View style={styles.certText}>
                                <Text style={[styles.certTitle, { color: theme.colors.text }]}>
                                    {cert.type === 'dedicated_student'
                                        ? 'Dedicated Student'
                                        : cert.type}
                                </Text>
                                <Text
                                    style={[styles.certDate, { color: theme.colors.textSecondary }]}
                                >
                                    Awarded{' '}
                                    {new Date(cert.awardedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        </View>
                    ))}
                </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    How streaks work
                </Text>
                {[
                    {
                        icon: 'calendar-outline',
                        text: 'Check in to any event each week to keep your streak alive',
                    },
                    {
                        icon: 'time-outline',
                        text: 'Streaks reset if you miss a full week with no check-ins',
                    },
                    {
                        icon: 'ribbon-outline',
                        text: 'Reach a 4-week streak to earn the Dedicated Student certificate',
                    },
                    {
                        icon: 'trending-up-outline',
                        text: 'Your longest streak is saved even if your current one resets',
                    },
                ].map(item => (
                    <View key={item.icon} style={styles.infoRow}>
                        <Ionicons
                            name={item.icon}
                            size={20}
                            color={theme.colors.primary}
                            style={styles.infoIcon}
                        />
                        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                            {item.text}
                        </Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            padding: 20,
            paddingTop: 20,
            paddingBottom: 40,
        },
        center: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        header: {
            marginBottom: 24,
        },
        title: {
            fontSize: 28,
            fontWeight: 'bold',
        },
        subtitle: {
            fontSize: 16,
            marginTop: 4,
        },
        streakCard: {
            borderRadius: 16,
            padding: 32,
            alignItems: 'center',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        flameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        streakNumber: {
            fontSize: 50,
            fontWeight: 'bold',
        },
        streakLabel: {
            fontSize: 18,
            marginTop: 4,
        },
        streakHint: {
            fontSize: 14,
            marginTop: 12,
            textAlign: 'center',
        },
        statsRow: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 16,
        },
        statCard: {
            flex: 1,
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            gap: 6,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        statNumber: {
            fontSize: 28,
            fontWeight: 'bold',
        },
        statLabel: {
            fontSize: 13,
            textAlign: 'center',
        },
        progressCard: {
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        progressHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        progressTitle: {
            fontSize: 16,
            fontWeight: '600',
        },
        progressCount: {
            fontSize: 14,
            fontWeight: '600',
        },
        progressBarBg: {
            height: 10,
            borderRadius: 5,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: 10,
            borderRadius: 5,
        },
        progressHint: {
            fontSize: 13,
            marginTop: 10,
        },
        weeksCard: {
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 16,
        },
        weeksRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
        },
        weekItem: {
            alignItems: 'center',
            gap: 8,
        },
        weekCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        weekNum: {
            fontSize: 16,
            fontWeight: '600',
        },
        weekLabel: {
            fontSize: 12,
        },
        card: {
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            ...theme.shadows.small,
        },
        cardTitle: {
            fontSize: 14,
            fontWeight: 'bold',
            color: theme.colors.textSecondary,
            marginBottom: 10,
            marginLeft: 5,
            textTransform: 'uppercase',
        },
        certDivider: {
            borderBottomWidth: 0.5,
            paddingBottom: 12,
            marginBottom: 12,
        },
        certRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        certText: {
            flex: 1,
        },
        certTitle: {
            fontSize: 16,
            fontWeight: '600',
        },
        certDate: {
            fontSize: 13,
            marginTop: 2,
        },
        infoCard: {
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        infoRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 14,
        },
        infoIcon: {
            marginTop: 1,
        },
        infoText: {
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
        },
    });
