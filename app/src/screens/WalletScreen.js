import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function WalletScreen({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'tickets'), where('userId', '==', user.uid));

        const unsubscribe = onSnapshot(
            q,
            snapshot => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                list.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
                setTickets(list);
                setLoading(false);
            },
            error => {
                console.error('Wallet Fetch Error:', error);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [user]);

    const renderTicket = ({ item }) => (
        <TouchableOpacity
            style={styles.ticketCard}
            onPress={() =>
                navigation.navigate('TicketScreen', { ticketId: item.id, ticketData: item })
            }
            activeOpacity={0.9}
        >
            <LinearGradient
                colors={[theme.colors.surface + 'E6', theme.colors.surface + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.glassCard}
            >
                {/* Holographic overlay */}
                <View
                    style={[styles.holoOverlay, { backgroundColor: theme.colors.primary + '10' }]}
                />

                {/* Left accent strip */}
                <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primary + '80']}
                    style={styles.accentStrip}
                />

                <View style={styles.cardContent}>
                    <View style={styles.mainInfo}>
                        <Text
                            style={[styles.eventTitle, { color: theme.colors.text }]}
                            numberOfLines={2}
                        >
                            {item.eventTitle}
                        </Text>
                        <View style={styles.detailsRow}>
                            <Ionicons
                                name="calendar-outline"
                                size={14}
                                color={theme.colors.textSecondary}
                            />
                            <Text
                                style={[styles.detailText, { color: theme.colors.textSecondary }]}
                            >
                                {new Date(item.eventDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </Text>
                        </View>
                        <View style={styles.detailsRow}>
                            <Ionicons
                                name="location-outline"
                                size={14}
                                color={theme.colors.textSecondary}
                            />
                            <Text
                                style={[styles.detailText, { color: theme.colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {item.eventLocation}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.rightSection}>
                        <View
                            style={[
                                styles.qrIcon,
                                { backgroundColor: theme.colors.primary + '20' },
                            ]}
                        >
                            <Ionicons name="qr-code" size={32} color={theme.colors.primary} />
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                            <Text style={[styles.statusText, { color: '#4CAF50' }]}>PAID</Text>
                        </View>
                    </View>
                </View>

                {/* Bottom notches */}
                <View style={[styles.notchLeft, { backgroundColor: theme.colors.background }]} />
                <View style={[styles.notchRight, { backgroundColor: theme.colors.background }]} />
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <LinearGradient
                colors={[theme.colors.primary + '20', 'transparent']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={[styles.backBtn, { backgroundColor: theme.colors.surface }]}
                        >
                            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                        <View>
                            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                                My Wallet
                            </Text>
                            <Text
                                style={[
                                    styles.headerSubtitle,
                                    { color: theme.colors.textSecondary },
                                ]}
                            >
                                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
                            </Text>
                        </View>
                    </View>
                    <View
                        style={[
                            styles.walletIcon,
                            { backgroundColor: theme.colors.primary + '20' },
                        ]}
                    >
                        <Ionicons name="wallet" size={28} color={theme.colors.primary} />
                    </View>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={item => item.id}
                    renderItem={renderTicket}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View
                                style={[
                                    styles.emptyIcon,
                                    { backgroundColor: theme.colors.surface },
                                ]}
                            >
                                <Ionicons
                                    name="ticket-outline"
                                    size={64}
                                    color={theme.colors.textSecondary}
                                />
                            </View>
                            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                                No Tickets Yet
                            </Text>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                Browse events and book your first ticket
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.browseBtn,
                                    { backgroundColor: theme.colors.primary },
                                ]}
                                onPress={() => navigation.navigate('Home')}
                            >
                                <Ionicons name="compass" size={20} color="#fff" />
                                <Text style={styles.browseBtnText}>Explore Events</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerGradient: {
        paddingTop: 60,
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: 20,
        paddingTop: 10,
    },
    ticketCard: {
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'visible',
    },
    glassCard: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative',
        overflow: 'hidden',
    },
    holoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.3,
    },
    accentStrip: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mainInfo: {
        flex: 1,
        paddingLeft: 12,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    detailText: {
        fontSize: 13,
    },
    rightSection: {
        alignItems: 'center',
        gap: 12,
    },
    qrIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    notchLeft: {
        position: 'absolute',
        left: -10,
        top: '50%',
        marginTop: -10,
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    notchRight: {
        position: 'absolute',
        right: -10,
        top: '50%',
        marginTop: -10,
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
    browseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    browseBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
