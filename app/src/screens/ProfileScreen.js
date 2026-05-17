import { Ionicons } from '@expo/vector-icons';
// import { Picker } from '@react-native-picker/picker'; // Removed native picker
import { LinearGradient } from 'expo-linear-gradient';
import { updateProfile } from 'firebase/auth';
import { addDoc, collection, doc, getCountFromServer, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
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

// Helper for menu items
const MenuItem = ({ icon, label, onPress, theme, styles, showChevron = true, rightElement }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <View style={[styles.menuIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons name={icon} size={20} color={theme.colors.primary} />
        </View>
        <Text style={styles.menuText}>{label}</Text>
        {rightElement}
        {showChevron && !rightElement && (
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        )}
    </TouchableOpacity>
);

const StatCard = ({ label, value, icon, theme, styles }) => (
    <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} style={{ marginBottom: 5 }} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

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
    const [isEditing, setIsEditing] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestSubject, setRequestSubject] = useState('Request Club Access');
    const [requestMessage, setRequestMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.uid) fetchUserData();
    }, [user]);

    const fetchUserData = async () => {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.year) setYear(String(data.year));
                if (data.displayName) setName(data.displayName);
                if (data.headline) setHeadline(data.headline);
                if (data.bio) setBio(data.bio);
                if (data.instagram) setInstagram(data.instagram);
                if (data.linkedin) setLinkedin(data.linkedin);
                if (data.branch) setBranch(data.branch);
                if (data.points) setPoints(data.points);

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
        }
    };

    const handleSave = async () => {
        if (!name) return Alert.alert('Error', 'Name cannot be empty');
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

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={{ paddingBottom: 150 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Profile Section */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <LinearGradient
                            colors={[
                                theme.colors.primary || '#6200ee',
                                theme.colors.secondary || '#03dac6',
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.avatarGradientBorder}
                        >
                            <View
                                style={[
                                    styles.avatarInner,
                                    { backgroundColor: theme.colors.background },
                                ]}
                            >
                                <Text style={styles.avatarText}>
                                    {name?.[0]?.toUpperCase() ||
                                        user?.email?.[0]?.toUpperCase() ||
                                        'U'}
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <Text style={styles.profileName}>{name || 'User'}</Text>
                        {bio ? (
                            <Text style={styles.profileBio} numberOfLines={3}>
                                {bio}
                            </Text>
                        ) : null}
                        <Text style={styles.profileEmail}>{user?.email}</Text>
                    </View>

                    {!isEditing && (
                        <TouchableOpacity
                            style={styles.editIconBtn}
                            onPress={() => setIsEditing(true)}
                        >
                            <Ionicons name="pencil" size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 4 }}>
                                Edit
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats Row */}
                {!isEditing && (
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
                )}

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
                                                {y === '1'
                                                    ? '1st'
                                                    : y === '2'
                                                      ? '2nd'
                                                      : y === '3'
                                                        ? '3rd'
                                                        : y + 'th'}{' '}
                                                Year
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
                            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                                {role === 'admin' && (
                                    <>
                                        <MenuItem
                                            icon="calendar-outline"
                                            label="My Created Events"
                                            onPress={() => navigation.navigate('MyEvents')}
                                            theme={theme}
                                            styles={styles}
                                        />
                                        <View style={styles.divider} />
                                        <MenuItem
                                            icon="notifications-outline"
                                            label="Send Daily Update"
                                            onPress={handleSendDailyDigest}
                                            theme={theme}
                                            styles={styles}
                                        />
                                        <View style={styles.divider} />
                                    </>
                                )}
                                <MenuItem
                                    icon="heart-outline"
                                    label="My Calendar"
                                    onPress={() => navigation.navigate('MyRegisteredEvents')}
                                    theme={theme}
                                    styles={styles}
                                />
                                <View style={styles.divider} />
                                <MenuItem
                                    icon="bookmark-outline"
                                    label="Saved Events"
                                    onPress={() => navigation.navigate('SavedEvents')}
                                    theme={theme}
                                    styles={styles}
                                />
                                <View style={styles.divider} />
                                <MenuItem
                                    icon="wallet-outline"
                                    label="My Wallet"
                                    onPress={() => navigation.navigate('Wallet')}
                                    theme={theme}
                                    styles={styles}
                                />
                                {role !== 'club' && role !== 'admin' && (
                                    <>
                                        <View style={styles.divider} />
                                        <MenuItem
                                            icon="briefcase-outline"
                                            label="Request Organizer Access"
                                            onPress={() => setShowRequestModal(true)}
                                            theme={theme}
                                            styles={styles}
                                        />
                                    </>
                                )}
                            </View>
                        </View>

                        {/* Settings Section */}
                        <View style={styles.menuGroup}>
                            <Text style={styles.groupTitle}>Settings</Text>
                            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                                <MenuItem
                                    icon="moon-outline"
                                    label="Dark Mode"
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
                                {/* Account Switching Horizontal Scroll inside Menu */}
                                <View style={styles.divider} />
                                <View style={{ padding: 15 }}>
                                    <Text style={[styles.label, { marginBottom: 10 }]}>
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
                                                    key={i}
                                                    onPress={() => switchAccount(acc.email)}
                                                    onLongPress={() =>
                                                        removeSavedAccount(acc.email)
                                                    }
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
                                        <TouchableOpacity
                                            onPress={() => signOut()}
                                            activeOpacity={0.7}
                                        >
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
                                    <Text
                                        style={[
                                            styles.helperText,
                                            { color: theme.colors.textSecondary, marginTop: 8 },
                                        ]}
                                    >
                                        Tap to switch • Long press to remove
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Logout Button */}
                        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
                            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
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
                        <View style={{ height: 50 }} />
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
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        header: {
            alignItems: 'center',
            paddingVertical: 30,
            marginBottom: 10,
        },
        avatarContainer: {
            marginBottom: 15,
            ...theme.shadows.medium,
        },
        avatarGradientBorder: {
            width: 100,
            height: 100,
            borderRadius: 50,
            padding: 3,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarInner: {
            width: '100%',
            height: '100%',
            borderRadius: 50,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarText: {
            fontSize: 36,
            fontWeight: 'bold',
            color: theme.colors.primary,
        },
        profileName: {
            fontSize: 26,
            fontWeight: 'bold',
            color: theme.colors.text,
            marginBottom: 4,
        },
        profileEmail: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginBottom: 10,
        },
        profileBio: {
            fontSize: 16,
            textAlign: 'center',
            color: theme.colors.primary, // Highlight bio
            paddingHorizontal: 20,
            marginTop: 4,
            marginBottom: 4,
            lineHeight: 22,
            fontWeight: '500',
        },
        roleBadge: {
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 20,
        },
        roleText: {
            fontSize: 12,
            fontWeight: 'bold',
        },
        editIconBtn: {
            position: 'absolute',
            top: 20,
            right: 20,
            backgroundColor: theme.colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 20,
            ...theme.shadows.default,
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
            padding: 15,
            borderRadius: 16,
            alignItems: 'center',
            ...theme.shadows.small,
        },
        statValue: {
            fontSize: 18,
            fontWeight: 'bold',
            color: theme.colors.text,
            marginBottom: 2,
        },
        statLabel: {
            fontSize: 12,
            color: theme.colors.textSecondary,
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
        card: {
            borderRadius: 16,
            overflow: 'hidden',
        },
        menuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
        },
        menuIconContainer: {
            width: 36,
            height: 36,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15,
        },
        menuText: {
            flex: 1,
            fontSize: 16,
            color: theme.colors.text,
            fontWeight: '500',
        },
        divider: {
            height: 1,
            backgroundColor: theme.colors.border,
            marginLeft: 60,
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
            padding: 16,
            borderRadius: 16,
            backgroundColor: '#ffebee',
            borderWidth: 1,
            borderColor: '#ffcdd2',
            marginBottom: 20,
        },
        logoutText: {
            color: theme.colors.error,
            fontWeight: 'bold',
            fontSize: 16,
            marginLeft: 8,
        },
    });
