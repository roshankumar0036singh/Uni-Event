import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    setDoc,
    where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { EventListSkeleton } from '../components/SkeletonLoader';
import EventCard from '../components/EventCard';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function ClubProfileScreen({ route, navigation }) {
    const { clubId, clubName } = route.params || {};
    const { user } = useAuth();
    const { theme } = useTheme();
    const [club, setClub] = useState(null);
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [activeTab, setActiveTab] = useState('events'); // 'events' | 'about'

    // Fetch Club Data
    useEffect(() => {
        let unsubscribeClub;
        const fetchClub = async () => {
            try {
                let id = clubId;
                if (!id) {
                    // Try fallback logic if implemented, else error
                    if (clubName) {
                        // Ideally we query by name, but for now we fallback to mock if strictly testing
                    } else {
                        Alert.alert('Error', 'Club ID missing');
                        navigation.goBack();
                        return;
                    }
                }

                if (id) {
                    unsubscribeClub = onSnapshot(doc(db, 'users', id), doc => {
                        if (doc.exists()) {
                            setClub({ id: doc.id, ...doc.data() });
                            setFollowersCount(doc.data().followersCount || 0);
                        } else {
                            // Mock Fallback for "Test" clubs that aren't real users yet
                            setClub({
                                id: id || 'test-club',
                                displayName: clubName || 'Unknown Club',
                                role: 'club',
                                bio: 'Empowering students through technology and innovation. Join us to build the future.',
                                photoURL: 'https://via.placeholder.com/150',
                                bannerUrl: 'https://via.placeholder.com/800x400',
                            });
                        }
                        setLoading(false);
                    });
                } else {
                    // Mock for strictly name-based test
                    setClub({
                        id: 'test-club',
                        displayName: clubName,
                        role: 'club',
                        bio: 'Official student chapter fostering technical growth.',
                        photoURL: `https://ui-avatars.com/api/?name=${clubName}&background=random`,
                    });
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };

        fetchClub();
        return () => unsubscribeClub && unsubscribeClub();
    }, [clubId, clubName, navigation]);

    // Fetch Events by this Club
    useEffect(() => {
        if (!clubId) return;
        const q = query(collection(db, 'events'), where('ownerId', '==', clubId));
        const unsub = onSnapshot(q, snapshot => {
            setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [clubId]);

    // Check Following Status
    useEffect(() => {
        if (!user || !clubId) return;
        const checkFollow = async () => {
            const docRef = doc(db, 'users', user.uid, 'following', clubId);
            const docSnap = await getDoc(docRef);
            setIsFollowing(docSnap.exists());
        };
        checkFollow();
    }, [user, clubId]);

    // Calculate Average Rating from club's reputation field
    const { avgRating, totalRatings } = useMemo(() => {
        if (!club || !club.reputation) return { avgRating: 0, totalRatings: 0 };

        const reputation = club.reputation;
        if (reputation.totalRatings && reputation.totalRatings > 0) {
            const avg = (reputation.totalPoints / reputation.totalRatings).toFixed(1);
            return { avgRating: avg, totalRatings: reputation.totalRatings };
        }

        return { avgRating: 0, totalRatings: 0 };
    }, [club]);

    const toggleFollow = async () => {
        if (!user) return;
        if (!clubId) {
            Alert.alert('Demo', 'Cannot follow a test club without ID.');
            return;
        }

        const myFollowingRef = doc(db, 'users', user.uid, 'following', clubId);
        const clubFollowerRef = doc(db, 'users', clubId, 'followers', user.uid);
        const clubRef = doc(db, 'users', clubId);

        // Optimistic update
        setIsFollowing(!isFollowing);
        setFollowersCount(prev => (isFollowing ? Math.max(0, prev - 1) : prev + 1));

        try {
            if (isFollowing) {
                // Unfollow
                await deleteDoc(myFollowingRef);
                await deleteDoc(clubFollowerRef);
                // Decrement follower count in club document
                await setDoc(
                    clubRef,
                    {
                        followersCount: Math.max(0, followersCount - 1),
                    },
                    { merge: true },
                );
            } else {
                // Follow
                await setDoc(myFollowingRef, {
                    clubName: club.displayName,
                    followedAt: new Date().toISOString(),
                });
                await setDoc(clubFollowerRef, {
                    userName: user.displayName,
                    followedAt: new Date().toISOString(),
                });
                // Increment follower count in club document
                await setDoc(
                    clubRef,
                    {
                        followersCount: followersCount + 1,
                    },
                    { merge: true },
                );
            }
        } catch (e) {
            console.error(e);
            // Revert on error
            setIsFollowing(!isFollowing);
            setFollowersCount(prev => (isFollowing ? prev + 1 : Math.max(0, prev - 1)));
        }
    };

    const openLink = url => {
        if (url) Linking.openURL(url).catch(() => {});
    };

    if (loading)
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <EventListSkeleton />
            </View>
        );

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={[styles.container, { backgroundColor: theme.colors.background }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header / Banner */}
                <View style={styles.headerContainer}>
                    <Image
                        source={{ uri: club?.bannerUrl || 'https://via.placeholder.com/800x400' }}
                        style={styles.bannerImage}
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)', theme.colors.background]}
                        style={styles.bannerGradient}
                    />

                    <View style={styles.profileMeta}>
                        <Image
                            source={{
                                uri:
                                    club?.photoURL ||
                                    `https://ui-avatars.com/api/?name=${club?.displayName}&background=random`,
                            }}
                            style={[styles.avatar, { borderColor: theme.colors.background }]}
                        />
                        <Text style={[styles.name, { color: theme.colors.text }]}>
                            {club?.displayName}
                        </Text>
                        <Text style={[styles.role, { color: theme.colors.textSecondary }]}>
                            {club?.headline ||
                                (club?.role === 'club'
                                    ? 'Official Student Chapter'
                                    : 'Event Organizer')}
                        </Text>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statNum, { color: theme.colors.text }]}>
                                    {events.length}
                                </Text>
                                <Text
                                    style={[
                                        styles.statLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Events
                                </Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statNum, { color: theme.colors.text }]}>
                                    {followersCount}
                                </Text>
                                <Text
                                    style={[
                                        styles.statLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    Followers
                                </Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <View
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                >
                                    <Text style={[styles.statNum, { color: theme.colors.text }]}>
                                        {avgRating > 0 ? avgRating : '—'}
                                    </Text>
                                    <Ionicons name="star" size={16} color="#FFD700" />
                                </View>
                                <Text
                                    style={[
                                        styles.statLabel,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    {totalRatings ? `${totalRatings} ratings` : 'No ratings'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.followBtn,
                                {
                                    backgroundColor: isFollowing
                                        ? theme.colors.surface
                                        : theme.colors.primary,
                                    borderColor: theme.colors.primary,
                                    borderWidth: 1,
                                },
                            ]}
                            onPress={toggleFollow}
                        >
                            <Text
                                style={[
                                    styles.followText,
                                    { color: isFollowing ? theme.colors.primary : '#fff' },
                                ]}
                            >
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Social Links Rail */}
                <View style={styles.socialRow}>
                    {club?.instagram ? (
                        <TouchableOpacity
                            onPress={() => openLink(club.instagram)}
                            style={[styles.socialIcon, { backgroundColor: theme.colors.surface }]}
                        >
                            <Ionicons
                                name="logo-instagram"
                                size={24}
                                color={theme.colors.primary}
                            />
                        </TouchableOpacity>
                    ) : null}
                    {club?.linkedin ? (
                        <TouchableOpacity
                            onPress={() => openLink(club.linkedin)}
                            style={[styles.socialIcon, { backgroundColor: theme.colors.surface }]}
                        >
                            <Ionicons name="logo-linkedin" size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Tabs */}
                <View style={[styles.tabContainer, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('events')}
                        style={[
                            styles.tab,
                            activeTab === 'events' && {
                                borderBottomWidth: 2,
                                borderBottomColor: theme.colors.primary,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'events'
                                    ? { color: theme.colors.primary }
                                    : { color: theme.colors.textSecondary },
                            ]}
                        >
                            Events
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('about')}
                        style={[
                            styles.tab,
                            activeTab === 'about' && {
                                borderBottomWidth: 2,
                                borderBottomColor: theme.colors.primary,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'about'
                                    ? { color: theme.colors.primary }
                                    : { color: theme.colors.textSecondary },
                            ]}
                        >
                            About
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <View style={styles.content}>
                    {activeTab === 'events' ? (
                        <View>
                            {events.length === 0 ? (
                                <View style={styles.empty}>
                                    <Ionicons
                                        name="calendar-outline"
                                        size={64}
                                        color={theme.colors.textSecondary}
                                    />
                                    <Text
                                        style={{ color: theme.colors.textSecondary, marginTop: 10 }}
                                    >
                                        No events yet.
                                    </Text>
                                </View>
                            ) : (
                                events.map(event => <EventCard key={event.id} event={event} />)
                            )}
                        </View>
                    ) : (
                        <View style={styles.aboutContainer}>
                            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                                Bio
                            </Text>
                            <Text style={[styles.bioText, { color: theme.colors.textSecondary }]}>
                                {club?.bio || 'No bio available.'}
                            </Text>

                            <Text
                                style={[
                                    styles.inputLabel,
                                    { color: theme.colors.text, marginTop: 20 },
                                ]}
                            >
                                Contact
                            </Text>
                            <View style={styles.contactRow}>
                                <Ionicons
                                    name="mail-outline"
                                    size={20}
                                    color={theme.colors.textSecondary}
                                />
                                <Text style={{ color: theme.colors.textSecondary }}>
                                    {club?.email || 'No email available'}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
                <View style={{ height: 50 }} />
                <View style={{ height: 50 }} />
            </ScrollView>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { alignItems: 'center', marginBottom: 10 },
    bannerImage: { width: '100%', height: 200, resizeMode: 'cover' },
    bannerGradient: { position: 'absolute', width: '100%', height: 200, opacity: 0.9 },
    profileMeta: { alignItems: 'center', marginTop: -60, width: '100%' },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4 },
    name: { fontSize: 24, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
    role: { fontSize: 14, marginBottom: 15 },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '80%',
        marginBottom: 20,
    },
    statItem: { alignItems: 'center', flex: 1 },
    statNum: { fontSize: 18, fontWeight: 'bold' },
    statLabel: { fontSize: 12 },
    divider: { width: 1, height: 20, backgroundColor: '#ccc' },
    followBtn: {
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 25,
        elevation: 2,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2 },
            android: { elevation: 3 },
        }),
    },
    followText: { fontWeight: 'bold', fontSize: 16 },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 20,
        marginTop: 10,
    },
    socialIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 1,
    },

    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
    tab: { paddingVertical: 15, marginRight: 20 },
    // Active tab border color handled inline or via dynamic style if needed.
    // We will handle it in the render loop style prop for simplicity with theme.
    tabText: { fontSize: 16, fontWeight: '600' },

    content: { padding: 20 },
    empty: { alignItems: 'center', padding: 40 },
    aboutContainer: {},
    inputLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    bioText: { fontSize: 14, lineHeight: 22 },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
    backButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
});

ClubProfileScreen.propTypes = {
    route: PropTypes.object,
    navigation: PropTypes.object,
};
