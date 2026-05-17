import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef } from 'react';
import {
    Animated,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import WrappedConfetti from '../components/WrappedConfetti';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

// Auto academic year — always current
const now = new Date();
const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
const academicYearLabel = `${startYear} — ${startYear + 1}`;
const academicStart = new Date(startYear, 7, 1); // Aug 1
const academicEndExclusive = new Date(startYear + 1, 7, 1); // Aug 1 next year (exclusive)

export default function WrappedScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showIntro, setShowIntro] = useState(true);
    const [stats, setStats] = useState({
        totalEvents: 0,
        mostActiveMonth: 'N/A',
        favoriteCategory: 'N/A',
        totalPoints: 0,
    });

    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!user?.uid) return;
        fetchWrappedStats(user.uid);
    }, [user?.uid]);

    const fetchWrappedStats = async uid => {
        try {
            const participatingRef = collection(db, 'users', uid, 'participating');
            const snapshot = await getDocs(participatingRef);

            const events = snapshot.docs
                .map(d => d.data())
                .filter(e => {
                    if (!e.registeredAt) return false;
                    const date = e.registeredAt.toDate
                        ? e.registeredAt.toDate()
                        : new Date(e.registeredAt);
                    if (Number.isNaN(date.getTime())) return false;
                    return date >= academicStart && date < academicEndExclusive;
                });

            const total = events.length;

            // Most active month
            const monthCount = {};
            events.forEach(e => {
                if (e.registeredAt) {
                    const date = e.registeredAt.toDate
                        ? e.registeredAt.toDate()
                        : new Date(e.registeredAt);
                    const month = date.getMonth();
                    monthCount[month] = (monthCount[month] || 0) + 1;
                }
            });
            const activeMonthIndex = Object.keys(monthCount).sort(
                (a, b) => monthCount[b] - monthCount[a],
            )[0];
            const activeMonth =
                activeMonthIndex !== undefined ? MONTH_NAMES[parseInt(activeMonthIndex)] : 'N/A';

            // Favorite category
            const catCount = {};
            events.forEach(e => {
                if (e.category) {
                    catCount[e.category] = (catCount[e.category] || 0) + 1;
                }
            });
            const favCategory =
                Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0] || 'N/A';

            setStats({
                totalEvents: total,
                mostActiveMonth: activeMonth,
                favoriteCategory: favCategory,
                totalPoints: total * 10,
            });
        } catch (e) {
            console.error('Wrapped fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const slides = [
        {
            id: 1,
            icon: 'calendar-outline',
            title: 'Your Year in Events',
            value: String(stats.totalEvents),
            subtitle: 'events attended this year',
            accent: theme.colors.primary,
        },
        {
            id: 2,
            icon: 'flame-outline',
            title: 'Most Active Month',
            value: stats.mostActiveMonth,
            subtitle: 'you were on fire!',
            accent: '#FF6B6B',
        },
        {
            id: 3,
            icon: 'star-outline',
            title: 'Favourite Category',
            value: stats.favoriteCategory,
            subtitle: 'your go-to event type',
            accent: theme.colors.info,
        },
        {
            id: 4,
            icon: 'trophy-outline',
            title: 'Points Earned',
            value: String(stats.totalPoints),
            subtitle: 'reputation points collected',
            accent: theme.colors.success,
        },
        {
            id: 5,
            icon: 'heart-outline',
            title: 'You are a Campus Star!',
            value: 'Amazing',
            subtitle: 'thanks for making campus life better',
            accent: theme.colors.primary,
        },
    ];

    const animateTransition = callback => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(
            () => {
                callback();
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }).start();
            },
        );
    };

    const goNext = () => {
        if (current < slides.length - 1) animateTransition(() => setCurrent(c => c + 1));
    };

    const goPrev = () => {
        if (current > 0) animateTransition(() => setCurrent(c => c - 1));
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message:
                    `🎉 My UniEvent Wrapped ${academicYearLabel}!\n\n` +
                    `📅 Events Attended: ${stats.totalEvents}\n` +
                    `🔥 Most Active Month: ${stats.mostActiveMonth}\n` +
                    `⭐ Favourite Category: ${stats.favoriteCategory}\n` +
                    `🏆 Points Earned: ${stats.totalPoints}\n\n` +
                    `Check out UniEvent for your campus events!`,
            });
        } catch (e) {
            console.error(e);
        }
    };

    const slide = slides[current];
    const isLast = current === slides.length - 1;

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Calculating your year...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>UniEvent Wrapped</Text>
                    <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                        <Ionicons name="share-outline" size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Auto year label */}
                <Text style={styles.yearLabel}>{academicYearLabel}</Text>

                {/* Slide Card */}
                <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
                    <View style={[styles.accentBar, { backgroundColor: slide.accent }]} />
                    <View style={[styles.iconCircle, { backgroundColor: slide.accent + '20' }]}>
                        <Ionicons name={slide.icon} size={36} color={slide.accent} />
                    </View>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={[styles.slideValue, { color: slide.accent }]}>{slide.value}</Text>
                    <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
                </Animated.View>

                {/* Dot indicators */}
                <View style={styles.dots}>
                    {slides.map((_, i) => (
                        <TouchableOpacity key={i} onPress={() => setCurrent(i)}>
                            <View
                                style={[
                                    styles.dot,
                                    i === current && {
                                        backgroundColor: theme.colors.primary,
                                        width: 24,
                                    },
                                ]}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Navigation buttons */}
                <View style={styles.navRow}>
                    <TouchableOpacity
                        style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
                        onPress={goPrev}
                        disabled={current === 0}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={20}
                            color={current === 0 ? theme.colors.textSecondary : theme.colors.text}
                        />
                        <Text
                            style={[
                                styles.navBtnText,
                                {
                                    color:
                                        current === 0
                                            ? theme.colors.textSecondary
                                            : theme.colors.text,
                                },
                            ]}
                        >
                            Back
                        </Text>
                    </TouchableOpacity>

                    {isLast ? (
                        <TouchableOpacity style={styles.shareFullBtn} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={20} color="#fff" />
                            <Text style={styles.shareFullBtnText}>Share My Wrapped</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                            <Text style={styles.nextBtnText}>Next</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats summary */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                        <Text style={styles.summaryValue}>{stats.totalEvents}</Text>
                        <Text style={styles.summaryLabel}>Events</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="star-outline" size={18} color={theme.colors.primary} />
                        <Text style={styles.summaryValue} numberOfLines={1}>
                            {stats.favoriteCategory}
                        </Text>
                        <Text style={styles.summaryLabel}>Top Category</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="trophy-outline" size={18} color={theme.colors.primary} />
                        <Text style={styles.summaryValue}>{stats.totalPoints}</Text>
                        <Text style={styles.summaryLabel}>Points</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Confetti intro animation */}
            <WrappedConfetti visible={showIntro} onComplete={() => setShowIntro(false)} />
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        scrollContent: {
            paddingBottom: 100,
            paddingHorizontal: theme.spacing.m,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        loadingText: {
            fontSize: 18,
            color: theme.colors.primary,
            fontWeight: '600',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.m,
        },
        backBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
        },
        shareBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
        },
        yearLabel: {
            textAlign: 'center',
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.m,
            fontWeight: '600',
            letterSpacing: 1,
        },
        card: {
            backgroundColor: theme.colors.surface,
            borderRadius: 24,
            padding: theme.spacing.l,
            alignItems: 'center',
            minHeight: 280,
            justifyContent: 'center',
            overflow: 'hidden',
            ...theme.shadows.default,
        },
        accentBar: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
        },
        iconCircle: {
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.m,
        },
        slideTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        slideValue: {
            fontSize: 48,
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: 8,
        },
        slideSubtitle: {
            fontSize: 15,
            color: theme.colors.textSecondary,
            textAlign: 'center',
        },
        dots: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginVertical: theme.spacing.m,
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.border,
        },
        navRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.l,
            gap: 12,
        },
        navBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            padding: 12,
            borderRadius: 14,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        navBtnDisabled: {
            opacity: 0.4,
        },
        navBtnText: {
            fontSize: 15,
            fontWeight: '600',
        },
        nextBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 14,
            borderRadius: 14,
            backgroundColor: theme.colors.primary,
        },
        nextBtnText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
        shareFullBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 14,
            borderRadius: 14,
            backgroundColor: theme.colors.success,
        },
        shareFullBtnText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
        summaryRow: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
        },
        summaryCard: {
            flex: 1,
            alignItems: 'center',
            padding: 12,
            borderRadius: 16,
            gap: 4,
            ...theme.shadows.small,
        },
        summaryValue: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.colors.text,
            textAlign: 'center',
        },
        summaryLabel: {
            fontSize: 11,
            color: theme.colors.textSecondary,
            fontWeight: '500',
        },
    });

WrappedScreen.propTypes = {
    navigation: PropTypes.object,
};
