import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { updateProfile } from 'firebase/auth';
import { addDoc, collection, doc, getCountFromServer, getDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import PremiumButton from '../components/PremiumButton';
import PremiumInput from '../components/PremiumInput';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserLevel, getUserLevelProgress } from '../lib/userLevels';
import {
    getSafeSelectedProfileBadge,
    getUnlockedProfileBadges,
    PROFILE_BADGES,
    canUseProfileBadge,
} from '../lib/profileBadges';

// Helper to get ordinal year labels
const getYearLabel = y => {
    switch (y) {
        case '1':
            return '1st';
        case '2':
            return '2nd';
        case '3':
            return '3rd';
        default:
            return `${y}th`;
    }
};

// Helper for menu items
const MenuItem = ({
    icon,
    label,
    description,
    onPress,
    theme,
    styles,
    width = '50%',
    showChevron = true,
    rightElement,
}) => (
    <TouchableOpacity onPress={onPress} style={[styles.bentoMenuItem, { width }]}>
        <View style={styles.bentoTop}>
            <View
                style={[
                    styles.menuIconContainer,
                    {
                        backgroundColor: theme.colors.primary + '20',
                    },
                ]}
            >
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.bentoContent}>
                <Text style={styles.bentoLabel}>{label}</Text>
            </View>
            {rightElement}
        </View>
        <View>
            {description && <Text style={styles.bentoDescription}>{description}</Text>}
            {showChevron && (
                <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textSecondary}
                    style={styles.bentoChevron}
                />
            )}
        </View>
    </TouchableOpacity>
);

const StatCard = ({ label, value, icon, theme, styles }) => (
    <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.statCardRow}>
            <View style={[styles.statIconSection]}>
                <Ionicons name={icon} size={20} color={theme.colors.primary} style={{}} />
            </View>
            <View style={styles.statContentSection}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
            </View>
        </View>
    </View>
);

const LevelProgressCard = ({ levelInfo, progressInfo, points, theme, styles }) => (
    <View style={[styles.levelCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.levelHeader}>
            <View style={[styles.levelIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name={levelInfo.icon} size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.levelTitle}>{levelInfo.title}</Text>
                <Text style={styles.levelSubtitle}>Level {levelInfo.level}</Text>
            </View>
            <Text style={styles.levelPoints}>{points} pts</Text>
        </View>

        <View style={styles.progressTrack}>
            <View
                style={[
                    styles.progressFill,
                    {
                        backgroundColor: theme.colors.primary,
                        width: `${Math.min(progressInfo.progress * 100, 100)}%`,
                    },
                ]}
            />
        </View>

        <Text style={styles.levelHint}>
            {progressInfo.isMaxLevel
                ? 'Max level reached'
                : `${progressInfo.remainingPoints} points to ${progressInfo.nextLevel.title}`}
        </Text>
    </View>
);

const ActiveProfileBadge = ({ badge, onPress, styles }) => (
    <TouchableOpacity
        style={[styles.activeProfileBadge, { borderColor: badge.color + '80' }]}
        onPress={onPress}
        activeOpacity={0.85}
    >
        <View style={[styles.activeProfileBadgeIcon, { backgroundColor: badge.color + '20' }]}>
            <Ionicons name={badge.icon} size={18} color={badge.color} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.activeProfileBadgeTitle}>{badge.label}</Text>
            <Text style={styles.activeProfileBadgeText}>Profile badge</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={badge.color} />
    </TouchableOpacity>
);

const ProfileBadgeShelf = ({
    badges,
    selectedBadgeId,
    onSelectBadge,
    onManagePress,
    styles,
    disabled,
}) => (
    <View style={styles.profileBadgeShelf}>
        <View style={styles.profileBadgeShelfHeader}>
            <Text style={styles.profileBadgeShelfTitle}>Unlocked badges</Text>
            <TouchableOpacity onPress={onManagePress} activeOpacity={0.8}>
                <Text style={styles.profileBadgeShelfAction}>Manage</Text>
            </TouchableOpacity>
        </View>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileBadgeShelfList}
        >
            {badges.map(badge => {
                const isSelected = badge.id === selectedBadgeId;

                return (
                    <TouchableOpacity
                        key={badge.id}
                        style={[
                            styles.profileBadgeShelfItem,
                            {
                                borderColor: isSelected ? badge.color : 'transparent',
                                backgroundColor: badge.color + (isSelected ? '24' : '14'),
                            },
                        ]}
                        onPress={() => onSelectBadge(badge)}
                        activeOpacity={disabled ? 1 : 0.85}
                        disabled={disabled}
                    >
                        <Ionicons name={badge.icon} size={20} color={badge.color} />
                        {isSelected && (
                            <View
                                style={[
                                    styles.profileBadgeShelfCheck,
                                    { backgroundColor: badge.color },
                                ]}
                            >
                                <Ionicons name="checkmark" size={10} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    </View>
);

LevelProgressCard.propTypes = {
    levelInfo: PropTypes.shape({
        icon: PropTypes.string,
        level: PropTypes.number,
        title: PropTypes.string,
    }),
    progressInfo: PropTypes.shape({
        isMaxLevel: PropTypes.bool,
        nextLevel: PropTypes.shape({
            title: PropTypes.string,
        }),
        progress: PropTypes.number,
        remainingPoints: PropTypes.number,
    }),
    points: PropTypes.number,
    theme: PropTypes.object,
    styles: PropTypes.object,
};

ActiveProfileBadge.propTypes = {
    badge: PropTypes.shape({
        color: PropTypes.string,
        icon: PropTypes.string,
        label: PropTypes.string,
    }),
    onPress: PropTypes.func,
    styles: PropTypes.object,
};

ProfileBadgeShelf.propTypes = {
    badges: PropTypes.arrayOf(
        PropTypes.shape({
            color: PropTypes.string,
            icon: PropTypes.string,
            id: PropTypes.string,
        }),
    ),
    selectedBadgeId: PropTypes.string,
    onSelectBadge: PropTypes.func,
    onManagePress: PropTypes.func,
    styles: PropTypes.object,
    disabled: PropTypes.bool,
};

const BRANCHES = ['CSE', 'ETC', 'EE', 'ME', 'Civil'];
const YEARS = ['1', '2', '3', '4']; // Changed to string array for consistency

export default function ProfileScreen({ navigation }) {
    const { user, role, signOut, savedAccounts, switchAccount, removeSavedAccount } = useAuth();
    const { theme, isDarkMode, toggleTheme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [name, setName] = useState(user?.displayName || '');
    const [headline, setHeadline] = useState('');
    const [bio, setBio] = useState('');
    const [instagram, setInstagram] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [year, setYear] = useState('1');
    const [branch, setBranch] = useState('CSE');
    const [points, setPoints] = useState(0);
    const [eventsCount, setEventsCount] = useState(0);
    const [rating, setRating] = useState(0);
    const [badges, setBadges] = useState([]);
    const [selectedProfileBadge, setSelectedProfileBadge] = useState('fresh-face');
    const [isEditing, setIsEditing] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showBadgeModal, setShowBadgeModal] = useState(false);
    const [requestSubject, setRequestSubject] = useState('Request Club Access');
    const [requestMessage, setRequestMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const updatingBadgeRef = useRef(null);
    const levelInfo = useMemo(() => getUserLevel(points), [points]);
    const progressInfo = useMemo(() => getUserLevelProgress(points), [points]);
    const activeProfileBadge = useMemo(
        () => getSafeSelectedProfileBadge(selectedProfileBadge, levelInfo.level),
        [selectedProfileBadge, levelInfo.level],
    );
    const unlockedProfileBadges = useMemo(
        () => getUnlockedProfileBadges(levelInfo.level),
        [levelInfo.level],
    );

    const fetchUserData = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setYear(data.year ? String(data.year) : '1');
                setName(data.displayName || user?.displayName || '');
                setHeadline(data.headline || '');
                setBio(data.bio || '');
                setInstagram(data.instagram || '');
                setLinkedin(data.linkedin || '');
                setBranch(data.branch || 'CSE');
                setPoints(data.points ?? 0);
                setBadges(data.badges || []);
                setSelectedProfileBadge(data.selectedProfileBadge || 'fresh-face');

                // Fetch Club Rating (for club/admin users) from reputation field
                if (role === 'club' || role === 'admin') {
                    const reputation = data.reputation || {};
                    if (reputation.totalRatings && reputation.totalRatings > 0) {
                        const avgRating = (
                            reputation.totalPoints / reputation.totalRatings
                        ).toFixed(1);
                        setRating(parseFloat(avgRating));
                    } else {
                        setRating(0);
                    }
                }
            }

            // Fetch Participated Events Count
            const coll = collection(db, 'users', user.uid, 'participating');
            const snapshot = await getCountFromServer(coll);
            setEventsCount(snapshot.data().count);
        } catch (e) {
            console.error(e);
            Alert.alert('Network Error', 'Failed to load profile statistics.');
        }
    }, [user?.uid, user?.displayName, role]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    // Re-fetch on every focus so newly earned badges appear immediately.
    useFocusEffect(
        useCallback(() => {
            fetchUserData();
        }, [fetchUserData]),
    );

    const handleSave = async () => {
        if (!name) return Alert.alert('Error', 'Name cannot be empty');

        const trimmedInstagram = instagram.trim();
        const trimmedLinkedin = linkedin.trim();
        const urlPattern = /^https:\/\/.+/;
        if (trimmedInstagram && !urlPattern.test(trimmedInstagram)) {
            return Alert.alert('Invalid URL', 'Instagram link must start with https://');
        }
        if (trimmedLinkedin && !urlPattern.test(trimmedLinkedin)) {
            return Alert.alert('Invalid URL', 'LinkedIn link must start with https://');
        }

        setLoading(true);
        try {
            await updateProfile(user, { displayName: name });

            let finalBranch = branch;
            if (role === 'admin') {
                finalBranch = 'All';
            }

            await updateDoc(doc(db, 'users', user.uid), {
                displayName: name,
                headline: headline,
                bio: bio,
                instagram: instagram,
                linkedin: linkedin,
                year: parseInt(year),
                branch: finalBranch,
            });

            Alert.alert('Success', 'Profile updated!');
            setIsEditing(false);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSendDailyDigest = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const idToken = await user.getIdToken();
            const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

            const res = await fetch(`${API_URL}/api/sendDailyDigest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
            });

            const data = await res.json();
            // The HTML snippet below is likely intended for a server-side email template.
            // Inserting it directly into client-side JavaScript would cause a syntax error.
            // If this is meant to be part of the message content, it should be passed as a string.
            // For now, assuming the user wants to modify the error message structure if `res.ok` is false.
            if (!res.ok) throw new Error(data.message || 'Failed');

            Alert.alert('Success', data.message || `Digest sent! Events today: ${data.count}`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message || 'Failed to send digest');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitRequest = async () => {
        if (!requestMessage)
            return Alert.alert(
                'Error',
                'Please enter a message explaining why you want to be an organizer.',
            );
        try {
            setLoading(true);
            await addDoc(collection(db, 'clubs'), {
                title: name || 'New Club',
                // description: bio, // Keep bio if needed, but message is primary
                message: requestMessage,
                subject: requestSubject,
                ownerId: user.uid,
                ownerEmail: user.email,
                approvalStatus: 'pending',
                createdAt: new Date(),
            });
            setShowRequestModal(false);
            Alert.alert('Success', 'Application submitted! Pending Admin approval.');
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProfileBadge = async badge => {
        if (loading || updatingBadgeRef.current) return;

        if (badge.id === activeProfileBadge.id) {
            setShowBadgeModal(false);
            return;
        }

        if (!canUseProfileBadge(badge.id, levelInfo.level)) {
            Alert.alert('Locked Badge', `Reach Level ${badge.requiredLevel} to unlock this badge.`);
            return;
        }

        try {
            updatingBadgeRef.current = badge.id;
            setLoading(true);
            await updateDoc(doc(db, 'users', user.uid), {
                selectedProfileBadge: badge.id,
            });
            if (updatingBadgeRef.current !== badge.id) return;

            setSelectedProfileBadge(badge.id);
            setShowBadgeModal(false);
            Alert.alert('Badge Updated', `${badge.label} is now shown on your profile.`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to update profile badge');
        } finally {
            if (updatingBadgeRef.current === badge.id) {
                updatingBadgeRef.current = null;
                setLoading(false);
            }
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={{ paddingBottom: 150 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Profile Section */}
                <LinearGradient
                    colors={[
                        theme.colors.surface + '15',
                        'rgba(255, 183, 77, 0.10)',
                        theme.colors.primary + '20',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.57, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.profileTopRow}>
                        <View style={styles.profileLeft}>
                            <View style={styles.avatarContainer}>
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarText}>
                                        {name?.[0]?.toUpperCase() ||
                                            user?.email?.[0]?.toUpperCase() ||
                                            'U'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.profileInfo}>
                                <Text style={styles.profileName}>{name || 'User'}</Text>
                                <Text style={styles.profileEmail}>{user?.email}</Text>
                            </View>
                        </View>
                        {!isEditing && (
                            <TouchableOpacity
                                style={styles.editIconBtn}
                                onPress={() => setIsEditing(true)}
                            >
                                <MaterialIcons name="edit" size={18} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.profileContent}>
                        {headline ? (
                            <Text style={styles.profileHeadline} numberOfLines={3}>
                                {headline}
                            </Text>
                        ) : null}
                        {bio ? (
                            <Text style={styles.profileBio} numberOfLines={3}>
                                {bio}
                            </Text>
                        ) : null}
                        <ActiveProfileBadge
                            badge={activeProfileBadge}
                            onPress={() => setShowBadgeModal(true)}
                            styles={styles}
                        />
                        <ProfileBadgeShelf
                            badges={unlockedProfileBadges}
                            selectedBadgeId={activeProfileBadge.id}
                            onSelectBadge={handleSelectProfileBadge}
                            onManagePress={() => setShowBadgeModal(true)}
                            styles={styles}
                            disabled={loading}
                        />
                    </View>
                </LinearGradient>

                {/* Stats Row */}
                {!isEditing && (
                    <>
                        <View style={styles.statsRow}>
                            {role === 'club' || role === 'admin' ? (
                                <>
                                    <StatCard
                                        label="Rating"
                                        value={rating && rating > 0 ? rating : '-'}
                                        icon="star-outline"
                                        theme={theme}
                                        styles={styles}
                                    />
                                    <StatCard
                                        label="Points"
                                        value={points}
                                        icon="trophy-outline"
                                        theme={theme}
                                        styles={styles}
                                    />
                                    <StatCard
                                        label="Events"
                                        value={eventsCount}
                                        icon="calendar-outline"
                                        theme={theme}
                                        styles={styles}
                                    />
                                </>
                            ) : (
                                <>
                                    <StatCard
                                        label="Year"
                                        value={year || '-'}
                                        icon="school-outline"
                                        theme={theme}
                                        styles={styles}
                                    />
                                    <StatCard
                                        label="Points"
                                        value={points}
                                        icon="trophy-outline"
                                        theme={theme}
                                        styles={styles}
                                    />
                                    <StatCard
                                        label="Events"
                                        value={eventsCount}
                                        icon="calendar-outline"
                                        theme={theme}
                                        styles={styles}
                                    />
                                </>
                            )}
                        </View>
                        <LevelProgressCard
                            levelInfo={levelInfo}
                            progressInfo={progressInfo}
                            points={points}
                            theme={theme}
                            styles={styles}
                        />
                    </>
                )}

                {/* Badges Section */}
                {!isEditing &&
                    badges.length > 0 &&
                    (() => {
                        const earlyBirdCount = badges.filter(b =>
                            b.startsWith('early_bird'),
                        ).length;
                        const otherBadges = badges.filter(b => !b.startsWith('early_bird'));

                        return (
                            <View style={styles.badgesContainer}>
                                <Text style={styles.groupTitle}>🏅 My Badges</Text>

                                {/* Early Bird badge card — gold & black theme */}
                                {earlyBirdCount > 0 && (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: '#1a1400',
                                            borderColor: '#F59E0B',
                                            borderWidth: 1.5,
                                            borderRadius: 14,
                                            paddingVertical: 10,
                                            paddingHorizontal: 14,
                                            marginBottom: 10,
                                            gap: 12,
                                        }}
                                    >
                                        {/* Gold circle with black bird icon */}
                                        <View
                                            style={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: 21,
                                                backgroundColor: '#F59E0B',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Ionicons name="leaf" size={20} color="#000" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={{
                                                    fontWeight: '800',
                                                    fontSize: 14,
                                                    color: '#F59E0B',
                                                    letterSpacing: 0.3,
                                                }}
                                            >
                                                Early Bird
                                            </Text>
                                            <Text
                                                style={{
                                                    color: '#D97706',
                                                    fontSize: 11,
                                                    marginTop: 1,
                                                }}
                                            >
                                                Registered early for {earlyBirdCount} event
                                                {earlyBirdCount > 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                        {/* Black pill with gold text */}
                                        <View
                                            style={{
                                                backgroundColor: '#000',
                                                borderRadius: 20,
                                                borderWidth: 1,
                                                borderColor: '#F59E0B',
                                                paddingVertical: 4,
                                                paddingHorizontal: 10,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: '#F59E0B',
                                                    fontWeight: '800',
                                                    fontSize: 13,
                                                }}
                                            >
                                                ×{earlyBirdCount}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                {/* Other badges as chips */}
                                {otherBadges.length > 0 && (
                                    <View style={styles.badgesRow}>
                                        {otherBadges.map(badge => (
                                            <View
                                                key={badge}
                                                style={[
                                                    styles.badgeChip,
                                                    {
                                                        backgroundColor:
                                                            theme.colors.primary + '20',
                                                        borderColor: theme.colors.primary,
                                                    },
                                                ]}
                                            >
                                                <Text style={{ fontSize: 16 }}>🏅</Text>
                                                <Text
                                                    style={[
                                                        styles.badgeText,
                                                        { color: theme.colors.primary },
                                                    ]}
                                                >
                                                    {badge.replaceAll('_', ' ').toUpperCase()}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })()}

                {/* Edit Form */}
                {isEditing ? (
                    <View style={styles.formContainer}>
                        <Text style={[styles.sectionTitle, { marginBottom: 20 }]}>
                            Edit Profile
                        </Text>

                        {/* Basic Info */}
                        <Text style={[styles.groupTitle, { marginBottom: 15, marginLeft: 4 }]}>
                            Basic Info
                        </Text>
                        <PremiumInput
                            label="Full Name"
                            value={name}
                            onChangeText={setName}
                            placeholder="John Doe"
                            icon={
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={theme.colors.textSecondary}
                                />
                            }
                        />
                        <PremiumInput
                            label="Headline / Tagline"
                            value={headline}
                            onChangeText={setHeadline}
                            placeholder="e.g. Official Student Chapter"
                            icon={
                                <Ionicons
                                    name="text-outline"
                                    size={20}
                                    color={theme.colors.textSecondary}
                                />
                            }
                        />
                        <PremiumInput
                            label="Bio"
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell us about yourself..."
                            icon={
                                <Ionicons
                                    name="information-circle-outline"
                                    size={20}
                                    color={theme.colors.textSecondary}
                                />
                            }
                            multiline
                            numberOfLines={4}
                        />

                        {/* Social Links - Only for Club/Admin */}
                        {(role === 'club' || role === 'admin') && (
                            <View style={{ marginVertical: 10 }}>
                                <Text
                                    style={[styles.groupTitle, { marginBottom: 15, marginLeft: 4 }]}
                                >
                                    Social Links
                                </Text>
                                <PremiumInput
                                    label="Instagram URL"
                                    value={instagram}
                                    onChangeText={setInstagram}
                                    placeholder="https://instagram.com/..."
                                    icon={
                                        <Ionicons
                                            name="logo-instagram"
                                            size={20}
                                            color={theme.colors.textSecondary}
                                        />
                                    }
                                />
                                <PremiumInput
                                    label="LinkedIn URL"
                                    value={linkedin}
                                    onChangeText={setLinkedin}
                                    placeholder="https://linkedin.com/in/..."
                                    icon={
                                        <Ionicons
                                            name="logo-linkedin"
                                            size={20}
                                            color={theme.colors.textSecondary}
                                        />
                                    }
                                />
                            </View>
                        )}

                        {/* Academic Info Header */}
                        {role !== 'admin' && (
                            <Text
                                style={[
                                    styles.groupTitle,
                                    { marginBottom: 15, marginLeft: 4, marginTop: 10 },
                                ]}
                            >
                                Academic Info
                            </Text>
                        )}

                        {role !== 'admin' && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={styles.label}>Year of Study</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.chipScroll}
                                >
                                    {YEARS.map(y => (
                                        <TouchableOpacity
                                            key={y}
                                            style={[styles.chip, year === y && styles.chipActive]}
                                            onPress={() => setYear(y)}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    year === y && styles.chipTextActive,
                                                ]}
                                            >
                                                {getYearLabel(y)} Year
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {role !== 'admin' && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={styles.label}>Branch</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.chipScroll}
                                >
                                    {BRANCHES.map(b => (
                                        <TouchableOpacity
                                            key={b}
                                            style={[styles.chip, branch === b && styles.chipActive]}
                                            onPress={() => setBranch(b)}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    branch === b && styles.chipTextActive,
                                                ]}
                                            >
                                                {b}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.formActions}>
                            <PremiumButton
                                title="Cancel"
                                variant="outline"
                                onPress={() => setIsEditing(false)}
                                style={{ flex: 1 }}
                            />
                            <View style={{ width: 10 }} />
                            <PremiumButton
                                title="Save"
                                onPress={handleSave}
                                loading={loading}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                ) : (
                    <View style={styles.menuContainer}>
                        {/* Activity Section */}
                        <View style={styles.menuGroup}>
                            <Text style={styles.groupTitle}>Activity</Text>
                            {role === 'admin' && (
                                <View style={styles.bentoRow}>
                                    <MenuItem
                                        icon="calendar-outline"
                                        label="My Created Events"
                                        description="Manage your hosted events"
                                        width="48%"
                                        onPress={() => navigation.navigate('MyEvents')}
                                        theme={theme}
                                        styles={styles}
                                    />
                                    <MenuItem
                                        icon="notifications-outline"
                                        label="Send Daily Update"
                                        description="Notify users instantly"
                                        width="48%"
                                        onPress={handleSendDailyDigest}
                                        theme={theme}
                                        styles={styles}
                                    />
                                </View>
                            )}
                            <View style={styles.bentoRow}>
                                <MenuItem
                                    icon="heart-outline"
                                    label="My Calendar"
                                    description="Track upcoming events"
                                    width="48%"
                                    onPress={() => navigation.navigate('MyRegisteredEvents')}
                                    theme={theme}
                                    styles={styles}
                                />
                                <MenuItem
                                    icon="bookmark-outline"
                                    label="Saved Events"
                                    description="Your bookmarked events"
                                    width="48%"
                                    onPress={() => navigation.navigate('SavedEvents')}
                                    theme={theme}
                                    styles={styles}
                                />
                            </View>
                            <View style={styles.bentoRow}>
                                <MenuItem
                                    icon="trophy-outline"
                                    label="My Wrapped"
                                    description="Your yearly event recap"
                                    width="48%"
                                    onPress={() => navigation.navigate('Wrapped')}
                                    theme={theme}
                                    styles={styles}
                                />
                                <MenuItem
                                    icon="wallet-outline"
                                    label="My Wallet"
                                    description="Rewards and transactions"
                                    width="48%"
                                    onPress={() => navigation.navigate('Wallet')}
                                    theme={theme}
                                    styles={styles}
                                />
                            </View>
                            {role !== 'club' && role !== 'admin' && (
                                <MenuItem
                                    icon="briefcase-outline"
                                    label="Request Organizer Access"
                                    description="Apply to create and manage events"
                                    width="100%"
                                    onPress={() => setShowRequestModal(true)}
                                    theme={theme}
                                    styles={styles}
                                />
                            )}
                        </View>

                        {/* Settings Section */}
                        <View style={styles.menuGroup}>
                            <Text style={styles.groupTitle}>Settings</Text>
                            <View style={styles.bentoRow}>
                                <MenuItem
                                    icon="moon-outline"
                                    label="Dark Mode"
                                    width="100%"
                                    theme={theme}
                                    styles={styles}
                                    showChevron={false}
                                    rightElement={
                                        <Switch
                                            value={isDarkMode}
                                            onValueChange={toggleTheme}
                                            trackColor={{
                                                false: '#767577',
                                                true: theme.colors.primary,
                                            }}
                                            thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
                                        />
                                    }
                                />
                            </View>

                            {/* Account Switching Horizontal Scroll inside Menu */}
                            <View
                                style={{
                                    padding: 18,
                                    backgroundColor: theme.colors.surface,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: theme.colors.border,
                                }}
                            >
                                <Text style={[styles.switchAccountLabel, { marginBottom: 10 }]}>
                                    Switch Accounts
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {/* Active Account */}
                                    <View
                                        style={[
                                            styles.accountAvatarSmall,
                                            styles.activeAccountBorder,
                                            { borderColor: theme.colors.primary },
                                        ]}
                                    >
                                        <Text style={styles.accountAvatarText}>
                                            {name?.[0]?.toUpperCase() || 'U'}
                                        </Text>
                                    </View>

                                    {/* Saved Accounts */}
                                    {savedAccounts
                                        .filter(acc => acc.email !== user?.email)
                                        .map((acc, i) => (
                                            <TouchableOpacity
                                                key={acc.email}
                                                onPress={() => switchAccount(acc.email)}
                                                onLongPress={() => removeSavedAccount(acc.email)}
                                                activeOpacity={0.7}
                                            >
                                                <View
                                                    style={[
                                                        styles.accountAvatarSmall,
                                                        {
                                                            backgroundColor:
                                                                theme.colors.primary + '40',
                                                            borderWidth: 1,
                                                            borderColor:
                                                                theme.colors.primary + '60',
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.accountAvatarText,
                                                            { color: theme.colors.primary },
                                                        ]}
                                                    >
                                                        {acc.displayName?.[0]?.toUpperCase() ||
                                                            acc.email?.[0]?.toUpperCase()}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}

                                    {/* Add Account Button */}
                                    <TouchableOpacity onPress={() => signOut()} activeOpacity={0.7}>
                                        <View
                                            style={[
                                                styles.accountAvatarSmall,
                                                {
                                                    backgroundColor: 'transparent',
                                                    borderWidth: 2,
                                                    borderColor: theme.colors.textSecondary,
                                                    borderStyle: 'dashed',
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="add"
                                                size={20}
                                                color={theme.colors.textSecondary}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                </ScrollView>
                                <Text style={styles.helperText}>
                                    Tap to switch • Long press to remove
                                </Text>
                            </View>
                        </View>

                        {/* Support Section */}
                        <View style={styles.menuGroup}>
                            <Text style={styles.groupTitle}>Support</Text>
                            <MenuItem
                                icon="bug-outline"
                                label="Report a Bug"
                                description="Report issues and share feedback"
                                width="100%"
                                onPress={() => navigation.navigate('ReportBug')}
                                theme={theme}
                                styles={styles}
                            />
                        </View>

                        {/* Logout Button */}
                        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
                            <Ionicons name="log-out-outline" size={20} color={'#FF5A3C'} />
                            <Text style={styles.logoutText}>Sign Out</Text>
                        </TouchableOpacity>

                        <Text
                            style={{
                                textAlign: 'center',
                                marginTop: 20,
                                color: theme.colors.textSecondary,
                                fontSize: 12,
                            }}
                        >
                            v1.0.0
                        </Text>
                    </View>
                )}
            </ScrollView>

            <Modal visible={showRequestModal} transparent animationType="slide">
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <View
                        style={{
                            backgroundColor: theme.colors.background,
                            padding: 20,
                            borderRadius: 12,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: 'bold',
                                color: theme.colors.text,
                                marginBottom: 15,
                            }}
                        >
                            Request Club Access
                        </Text>

                        <Text style={{ color: theme.colors.textSecondary, marginBottom: 5 }}>
                            Subject
                        </Text>
                        <TextInput
                            value={requestSubject}
                            onChangeText={setRequestSubject}
                            style={{
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                                borderRadius: 8,
                                padding: 10,
                                color: theme.colors.text,
                                marginBottom: 15,
                            }}
                        />

                        <Text style={{ color: theme.colors.textSecondary, marginBottom: 5 }}>
                            Message to Admin
                        </Text>
                        <TextInput
                            value={requestMessage}
                            onChangeText={setRequestMessage}
                            placeholder="Why do you want to start a club?"
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            numberOfLines={4}
                            style={{
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                                borderRadius: 8,
                                padding: 10,
                                color: theme.colors.text,
                                height: 100,
                                textAlignVertical: 'top',
                                marginBottom: 20,
                            }}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowRequestModal(false)}
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: theme.colors.border,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: theme.colors.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSubmitRequest}
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    borderRadius: 8,
                                    backgroundColor: theme.colors.primary,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showBadgeModal} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.badgeModal, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.badgeModalHeader}>
                            <View>
                                <Text style={styles.badgeModalTitle}>Choose Profile Badge</Text>
                                <Text style={styles.badgeModalSubtitle}>
                                    Level {levelInfo.level} unlocks{' '}
                                    {
                                        PROFILE_BADGES.filter(
                                            badge => badge.requiredLevel <= levelInfo.level,
                                        ).length
                                    }{' '}
                                    badges
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.badgeModalClose}
                                onPress={() => setShowBadgeModal(false)}
                            >
                                <Ionicons name="close" size={22} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.profileBadgeGrid}
                            showsVerticalScrollIndicator={false}
                        >
                            {PROFILE_BADGES.map(badge => {
                                const isUnlocked = canUseProfileBadge(badge.id, levelInfo.level);
                                const isSelected = activeProfileBadge.id === badge.id;

                                return (
                                    <TouchableOpacity
                                        key={badge.id}
                                        style={[
                                            styles.profileBadgeOption,
                                            {
                                                backgroundColor: theme.colors.surface,
                                                borderColor: isSelected
                                                    ? badge.color
                                                    : theme.colors.border,
                                                opacity: isUnlocked ? 1 : 0.55,
                                            },
                                        ]}
                                        disabled={!isUnlocked || loading}
                                        activeOpacity={isUnlocked && !loading ? 0.85 : 1}
                                        onPress={() => handleSelectProfileBadge(badge)}
                                    >
                                        <View
                                            style={[
                                                styles.profileBadgeOptionIcon,
                                                { backgroundColor: badge.color + '20' },
                                            ]}
                                        >
                                            <Ionicons
                                                name={isUnlocked ? badge.icon : 'lock-closed'}
                                                size={24}
                                                color={badge.color}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.profileBadgeOptionTitle}>
                                                {badge.label}
                                            </Text>
                                            <Text style={styles.profileBadgeOptionDescription}>
                                                {badge.description}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.profileBadgeOptionMeta,
                                                    { color: badge.color },
                                                ]}
                                            >
                                                {isUnlocked
                                                    ? `Unlocked at Level ${badge.requiredLevel}`
                                                    : `Unlocks at Level ${badge.requiredLevel}`}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={22}
                                                color={badge.color}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        header: {
            marginTop: 10,
            marginBottom: 20,
            marginHorizontal: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 20,
            padding: 18,
        },
        profileTopRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            width: '100%',
        },
        profileLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            paddingRight: 12,
        },
        avatarContainer: {
            width: 70,
            height: 70,
            borderRadius: 40,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.06)',
            padding: 3,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15,
        },
        avatarInner: {
            width: '100%',
            height: '100%',
            borderRadius: 40,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.primary,
        },
        avatarText: {
            fontSize: 32,
            fontWeight: 'bold',
            color: theme.colors.text,
        },
        profileInfo: {
            flex: 1,
            overflow: 'hidden',
            paddingRight: 8,
        },
        profileName: {
            fontSize: 22,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 2,
        },
        profileEmail: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginBottom: 10,
        },
        profileContent: {
            flex: 1,
        },
        profileHeadline: {
            fontSize: 18,
            textAlign: 'left',
            color: theme.colors.primary,
            marginTop: 4,
            marginBottom: 4,
            lineHeight: 22,
            fontWeight: '600',
        },
        profileBio: {
            fontSize: 12,
            textAlign: 'left',
            color: theme.colors.textSecondary,
            marginTop: 2,
        },
        activeProfileBadge: {
            alignSelf: 'flex-start',
            minWidth: 210,
            maxWidth: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderRadius: 18,
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginTop: 2,
            backgroundColor: theme.colors.surface,
            ...theme.shadows.small,
        },
        activeProfileBadgeIcon: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },
        activeProfileBadgeTitle: {
            color: theme.colors.text,
            fontSize: 13,
            fontWeight: '800',
        },
        activeProfileBadgeText: {
            color: theme.colors.textSecondary,
            fontSize: 11,
            marginTop: 1,
        },
        profileBadgeShelf: {
            width: '100%',
            marginTop: 12,
            paddingHorizontal: theme.spacing.m,
        },
        profileBadgeShelfHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        profileBadgeShelfTitle: {
            color: theme.colors.textSecondary,
            fontSize: 12,
            fontWeight: '800',
            textTransform: 'uppercase',
        },
        profileBadgeShelfAction: {
            color: theme.colors.primary,
            fontSize: 12,
            fontWeight: '800',
        },
        profileBadgeShelfList: {
            gap: 8,
            paddingRight: theme.spacing.m,
        },
        profileBadgeShelfItem: {
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        },
        profileBadgeShelfCheck: {
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 16,
            height: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: theme.colors.background,
        },
        editIconBtn: {
            backgroundColor: theme.colors.primary + '20',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            width: 38,
            height: 38,
            borderRadius: 40,
        },
        statsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.m,
            marginBottom: 20,
            gap: 10,
        },
        statCard: {
            flex: 1,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 16,
            alignItems: 'center',
            ...theme.shadows.small,
        },
        statCardRow: {
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        statIconSection: {
            width: 40,
            height: 40,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.primary + '20',
        },
        statContentSection: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statValue: {
            fontSize: 18,
            fontWeight: 'bold',
            color: theme.colors.text,
            marginBottom: 2,
            textAlign: 'center',
        },
        statLabel: {
            fontSize: 12,
            color: theme.colors.textSecondary,
        },
        levelCard: {
            marginHorizontal: theme.spacing.m,
            marginBottom: 20,
            padding: 16,
            borderRadius: 16,
            ...theme.shadows.small,
        },
        levelHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        levelIcon: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        levelTitle: {
            color: theme.colors.text,
            fontSize: 17,
            fontWeight: '800',
        },
        levelSubtitle: {
            color: theme.colors.textSecondary,
            fontSize: 12,
            marginTop: 2,
        },
        levelPoints: {
            color: theme.colors.primary,
            fontSize: 14,
            fontWeight: '800',
        },
        progressTrack: {
            height: 8,
            borderRadius: 8,
            backgroundColor: theme.colors.border,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            borderRadius: 8,
        },
        levelHint: {
            color: theme.colors.textSecondary,
            fontSize: 12,
            marginTop: 8,
        },
        menuContainer: {
            paddingHorizontal: theme.spacing.m,
        },
        menuGroup: {
            marginBottom: 20,
        },
        groupTitle: {
            fontSize: 14,
            fontWeight: 'bold',
            color: theme.colors.textSecondary,
            marginBottom: 10,
            marginLeft: 5,
            textTransform: 'uppercase',
        },
        bentoMenuItem: {
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 20,
            padding: 18,
            backgroundColor: theme.colors.surface,
            ...theme.shadows.small,
        },
        bentoTop: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        menuIconContainer: {
            width: 36,
            height: 36,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        bentoContent: {
            flex: 1,
            marginLeft: 18,
            justifyContent: 'space-between',
            height: '100%',
        },
        bentoLabel: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
        },
        bentoDescription: {
            marginTop: 8,
            fontSize: 12,
            lineHeight: 18,
            color: theme.colors.textSecondary,
        },
        bentoChevron: {
            alignSelf: 'flex-end',
            marginTop: 10,
        },
        bentoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 14,
        },
        switchAccountLabel: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 12,
        },
        helperText: {
            color: theme.colors.textSecondary,
            marginTop: 10,
        },
        formContainer: {
            paddingHorizontal: theme.spacing.m,
            paddingTop: 10,
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: theme.colors.text,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: 8,
            marginLeft: 4,
        },

        // Chips Styles
        chipRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
        chipScroll: { marginBottom: 5 },
        chip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginRight: 8,
            minWidth: 60,
            alignItems: 'center',
        },
        chipActive: {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
        },
        chipText: {
            color: theme.colors.text,
            fontWeight: '500',
        },
        chipTextActive: {
            color: '#fff',
            fontWeight: 'bold',
        },

        // Badges Styles
        badgesContainer: {
            paddingHorizontal: 20,
            marginBottom: 20,
        },
        badgesRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        badgeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 1,
            gap: 6,
        },
        badgeText: {
            fontSize: 12,
            fontWeight: 'bold',
        },
        modalBackdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'flex-end',
        },
        badgeModal: {
            maxHeight: '82%',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
        },
        badgeModalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
        },
        badgeModalTitle: {
            color: theme.colors.text,
            fontSize: 20,
            fontWeight: '900',
        },
        badgeModalSubtitle: {
            color: theme.colors.textSecondary,
            fontSize: 12,
            marginTop: 4,
        },
        badgeModalClose: {
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surface,
        },
        profileBadgeGrid: {
            paddingBottom: 24,
            gap: 10,
        },
        profileBadgeOption: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderRadius: 16,
            padding: 12,
        },
        profileBadgeOptionIcon: {
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        profileBadgeOptionTitle: {
            color: theme.colors.text,
            fontSize: 15,
            fontWeight: '800',
        },
        profileBadgeOptionDescription: {
            color: theme.colors.textSecondary,
            fontSize: 12,
            marginTop: 2,
        },
        profileBadgeOptionMeta: {
            fontSize: 11,
            fontWeight: '800',
            marginTop: 5,
        },

        formActions: {
            flexDirection: 'row',
            marginTop: 20,
        },
        accountAvatarSmall: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15,
            backgroundColor: theme.colors.primary,
        },
        activeAccountBorder: {
            borderWidth: 2,
            padding: 2,
        },
        accountAvatarText: {
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 18,
        },
        logoutBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 18,
            borderRadius: 20,
            marginBottom: 20,
            backgroundColor: 'rgba(120, 20, 20, 0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255, 90, 90, 0.15)',
            gap: 10,
            ...theme.shadows.small,
        },
        logoutText: {
            color: '#FF5A3C',
            fontWeight: '700',
            fontSize: 17,
        },
    });

MenuItem.propTypes = {
    icon: PropTypes.any,
    label: PropTypes.any,
    description: PropTypes.any,
    onPress: PropTypes.any,
    theme: PropTypes.object,
    styles: PropTypes.object,
    showChevron: PropTypes.any,
    rightElement: PropTypes.object,
    width: PropTypes.string,
};
StatCard.propTypes = {
    label: PropTypes.any,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    icon: PropTypes.any,
    theme: PropTypes.object,
    styles: PropTypes.object,
};
ProfileScreen.propTypes = {
    navigation: PropTypes.object,
};
