import { Ionicons } from '@expo/vector-icons';
import { collection, limit, onSnapshot, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, Switch, Alert } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import PropTypes from 'prop-types';
import { getUserLevel } from '../lib/userLevels';
import { getSafeSelectedProfileBadge } from '../lib/profileBadges';

const LeaderboardListHeader = ({ theme, togglePrivacy, isAnonymous }) => (
    <View style={{ marginBottom: 20 }}>
        <Text style={[styles.title, { color: theme.colors.text, marginBottom: 15 }]}>
            Leaderboard
        </Text>

        {/* Privacy Toggle */}
        <View style={[styles.toggleCard, { backgroundColor: theme.colors.surface }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>Go Anonymous</Text>
                <Text style={[styles.toggleSubtitle, { color: theme.colors.textSecondary }]}>
                    Hide your name from others on the leaderboard.
                </Text>
            </View>
            <Switch
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={'#fff'}
                onValueChange={togglePrivacy}
                value={isAnonymous}
            />
        </View>
    </View>
);

LeaderboardListHeader.propTypes = {
    theme: PropTypes.object.isRequired,
    togglePrivacy: PropTypes.func.isRequired,
    isAnonymous: PropTypes.bool.isRequired,
};

export default function LeaderboardScreen({ navigation }) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const isFocused = useIsFocused();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Find my user doc to get current privacy setting
    const myUserDoc = users.find(u => u.id === user?.uid);
    const isAnonymous = myUserDoc?.isAnonymous || false;

    useEffect(() => {
        if (!isFocused) return;
        const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(10));
        const unsubscribe = onSnapshot(
            q,
            snapshot => {
                const list = snapshot.docs.map((doc, index) => ({
                    id: doc.id,
                    rank: index + 1,
                    ...doc.data(),
                }));
                setUsers(list);
                setLoading(false);
            },
            error => {
                console.error('Leaderboard Error:', error);
                setLoading(false);
            },
        );
        return () => unsubscribe();
    }, [isFocused]);

    const togglePrivacy = useCallback(
        async value => {
            if (!user) return;
            try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, { isAnonymous: value });
            } catch (_error) {
                console.error('Privacy toggle error:', _error);
                Alert.alert('Error', 'Failed to update privacy setting.');
            }
        },
        [user],
    );

    const renderHeader = useCallback(
        () => (
            <LeaderboardListHeader
                theme={theme}
                togglePrivacy={togglePrivacy}
                isAnonymous={isAnonymous}
            />
        ),
        [theme, togglePrivacy, isAnonymous],
    );

    const renderItem = ({ item }) => {
        const isMe = item.id === user?.uid;
        let rankColor = theme.colors.text;
        let rankIcon = null;

        if (item.rank === 1) {
            rankColor = '#FFD700';
            rankIcon = 'trophy';
        } else if (item.rank === 2) {
            rankColor = '#C0C0C0';
            rankIcon = 'medal';
        } else if (item.rank === 3) {
            rankColor = '#CD7F32';
            rankIcon = 'medal-outline';
        }

        // Privacy Logic
        const displayName = item.isAnonymous ? 'Anonymous' : item.displayName || 'Anonymous';
        const displayBranch = item.isAnonymous ? 'Hidden' : item.branch || 'Unknown Branch';
        const levelInfo = getUserLevel(item.points || 0);
        const profileBadge = item.isAnonymous
            ? null
            : getSafeSelectedProfileBadge(item.selectedProfileBadge, levelInfo.level);

        return (
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.colors.surface,
                        borderColor: isMe ? theme.colors.primary : 'transparent',
                    },
                    isMe && styles.myCard,
                ]}
            >
                <View style={styles.rankContainer}>
                    {rankIcon ? (
                        <Ionicons name={rankIcon} size={24} color={rankColor} />
                    ) : (
                        <Text style={[styles.rankText, { color: theme.colors.textSecondary }]}>
                            #{item.rank}
                        </Text>
                    )}
                </View>

                <View style={styles.infoContainer}>
                    <Text style={[styles.name, { color: theme.colors.text }]}>
                        {displayName} {isMe && '(You)'}
                    </Text>
                    <Text style={[styles.branch, { color: theme.colors.textSecondary }]}>
                        {displayBranch}
                    </Text>
                    <View style={styles.levelRow}>
                        <Ionicons name={levelInfo.icon} size={13} color={theme.colors.primary} />
                        <Text style={[styles.levelText, { color: theme.colors.primary }]}>
                            Level {levelInfo.level} - {levelInfo.title}
                        </Text>
                    </View>
                    {profileBadge && (
                        <View
                            style={[
                                styles.profileBadgeRow,
                                { backgroundColor: profileBadge.color + '18' },
                            ]}
                        >
                            <Ionicons
                                name={profileBadge.icon}
                                size={13}
                                color={profileBadge.color}
                            />
                            <Text style={[styles.profileBadgeText, { color: profileBadge.color }]}>
                                {profileBadge.label}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.pointsContainer}>
                    <Text style={[styles.points, { color: theme.colors.primary }]}>
                        {item.points || 0}
                    </Text>
                    <Text style={[styles.pointsLabel, { color: theme.colors.textSecondary }]}>
                        pts
                    </Text>
                </View>
            </View>
        );
    };

    if (loading)
        return (
            <ScreenWrapper showLogo={true}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                    style={{ marginTop: 50 }}
                />
            </ScreenWrapper>
        );

    return (
        <ScreenWrapper showLogo={true}>
            <View style={styles.container}>
                <FlatList
                    data={users}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                            No players yet.
                        </Text>
                    }
                />
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    title: { fontSize: 24, fontWeight: 'bold' },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
    },
    myCard: { borderWidth: 2 },
    rankContainer: { width: 40, alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 16, fontWeight: 'bold' },
    infoContainer: { flex: 1, marginLeft: 10 },
    name: { fontSize: 16, fontWeight: 'bold' },
    branch: { fontSize: 12 },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    levelText: { fontSize: 11, fontWeight: '700' },
    profileBadgeRow: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    profileBadgeText: { fontSize: 11, fontWeight: '800' },
    pointsContainer: { alignItems: 'flex-end' },
    points: { fontSize: 18, fontWeight: '900' },
    pointsLabel: { fontSize: 10 },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    toggleTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    toggleSubtitle: { fontSize: 12 },
});

LeaderboardScreen.propTypes = {
    navigation: PropTypes.object,
};
