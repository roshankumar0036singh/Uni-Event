import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    Modal,
    Switch,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Picker } from '@react-native-picker/picker';
import { db, functions } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function ManageVolunteersScreen({ route, navigation }) {
    const { eventId, eventTitle } = route.params;
    const { theme } = useTheme();

    const [volunteers, setVolunteers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Draft state
    const [drafting, setDrafting] = useState(false);

    // Award state
    const [awardModalVisible, setAwardModalVisible] = useState(false);
    const [selectedVolunteer, setSelectedVolunteer] = useState(null);
    const [awardRemark, setAwardRemark] = useState('easy');
    const [awarding, setAwarding] = useState(false);

    // Drop state
    const [dropModalVisible, setDropModalVisible] = useState(false);
    const [dropReason, setDropReason] = useState('');
    const [revokePoints, setRevokePoints] = useState(false);
    const [dropping, setDropping] = useState(false);

    useEffect(() => {
        const q = query(collection(db, `events/${eventId}/volunteers`));
        const unsubscribe = onSnapshot(q, async snapshot => {
            const list = [];
            const userIds = snapshot.docs.map(doc => doc.id);

            let userMap = {};
            if (userIds.length > 0) {
                try {
                    const searchVolunteerCandidates = httpsCallable(
                        functions,
                        'searchVolunteerCandidates',
                    );
                    const response = await searchVolunteerCandidates({ eventId, userIds });
                    if (response.data?.users) {
                        response.data.users.forEach(u => {
                            userMap[u.id] = u;
                        });
                    }
                } catch (e) {
                    console.error('Error fetching user data via callable:', e);
                }
            }

            for (const docSnapshot of snapshot.docs) {
                const userData = userMap[docSnapshot.id] || {
                    displayName: 'Unknown',
                    email: docSnapshot.id,
                };
                list.push({
                    id: docSnapshot.id,
                    ...docSnapshot.data(),
                    displayName: userData.displayName,
                    email: userData.email,
                });
            }
            setVolunteers(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [eventId]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const searchVolunteerCandidates = httpsCallable(functions, 'searchVolunteerCandidates');
            const response = await searchVolunteerCandidates({
                eventId,
                searchQuery: searchQuery.trim(),
            });

            setSearchResults(response.data?.users || []);
        } catch (error) {
            console.error('Search error:', error);
            Alert.alert('Search Failed', error.message);
        } finally {
            setSearching(false);
        }
    };

    const handleDraft = async targetUserId => {
        setDrafting(true);
        try {
            const draftVolunteer = httpsCallable(functions, 'draftVolunteer');
            await draftVolunteer({ eventId, userId: targetUserId });
            Alert.alert('Success', 'Volunteer drafted successfully!');
            setSearchResults([]);
            setSearchQuery('');
        } catch (error) {
            console.error('Draft error:', error);
            Alert.alert('Draft Failed', error.message);
        } finally {
            setDrafting(false);
        }
    };

    const handleAwardPoints = async () => {
        if (!selectedVolunteer) return;
        setAwarding(true);
        try {
            const awardVolunteerPoints = httpsCallable(functions, 'awardVolunteerPoints');
            await awardVolunteerPoints({
                eventId,
                userId: selectedVolunteer.id,
                remark: awardRemark,
            });
            Alert.alert('Success', 'Points awarded successfully!');
            setAwardModalVisible(false);
        } catch (error) {
            console.error('Award error:', error);
            Alert.alert('Award Failed', error.message);
        } finally {
            setAwarding(false);
        }
    };

    const handleDrop = async () => {
        if (!selectedVolunteer) return;
        setDropping(true);
        try {
            const dropVolunteer = httpsCallable(functions, 'dropVolunteer');
            await dropVolunteer({
                eventId,
                userId: selectedVolunteer.id,
                reason: dropReason,
                revokePoints,
            });
            Alert.alert('Success', 'Volunteer dropped successfully!');
            setDropModalVisible(false);
            setDropReason('');
            setRevokePoints(false);
        } catch (error) {
            console.error('Drop error:', error);
            Alert.alert('Drop Failed', error.message);
        } finally {
            setDropping(false);
        }
    };

    const renderVolunteer = ({ item }) => (
        <View style={[styles.volunteerCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.volunteerInfo}>
                <Text style={[styles.volunteerName, { color: theme.colors.text }]}>
                    {item.displayName || 'Unknown Volunteer'}
                </Text>
                <Text style={{ color: theme.colors.textSecondary }}>{item.email || item.id}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>Status: {item.status}</Text>
            </View>

            {item.status !== 'dropped' && (
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[
                            styles.button,
                            { backgroundColor: theme.colors.success || '#4CAF50' },
                        ]}
                        onPress={() => {
                            setSelectedVolunteer(item);
                            setAwardRemark('easy');
                            setAwardModalVisible(true);
                        }}
                    >
                        <Text style={styles.buttonText}>Award</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.error }]}
                        onPress={() => {
                            setSelectedVolunteer(item);
                            setDropModalVisible(true);
                        }}
                    >
                        <Text style={styles.buttonText}>Drop</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryDark || '#000']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Manage Volunteers</Text>
                    <Text style={styles.headerSubtitle}>{eventTitle}</Text>
                </View>
            </LinearGradient>

            <View style={styles.container}>
                {/* Search Section */}
                <View style={styles.searchSection}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                        Draft Volunteer
                    </Text>
                    <View style={styles.searchRow}>
                        <TextInput
                            style={[
                                styles.searchInput,
                                {
                                    backgroundColor: theme.colors.surface,
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                },
                            ]}
                            placeholder="Search by exact email or name..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <TouchableOpacity
                            style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
                            onPress={handleSearch}
                            disabled={searching}
                        >
                            {searching ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="search" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {searchResults.map(userObj => (
                        <View
                            key={userObj.id}
                            style={[
                                styles.searchResultCard,
                                { backgroundColor: theme.colors.surface },
                            ]}
                        >
                            <View style={styles.volunteerInfo}>
                                <Text style={[styles.volunteerName, { color: theme.colors.text }]}>
                                    {userObj.displayName || 'Unknown'}
                                </Text>
                                <Text style={{ color: theme.colors.textSecondary }}>
                                    {userObj.email}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.draftButton,
                                    { backgroundColor: theme.colors.primary },
                                ]}
                                onPress={() => handleDraft(userObj.id)}
                                disabled={drafting}
                            >
                                <Text style={styles.buttonText}>Draft</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* Volunteers List */}
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>
                    Current Volunteers
                </Text>
                {loading ? (
                    <ActivityIndicator
                        size="large"
                        color={theme.colors.primary}
                        style={{ marginTop: 20 }}
                    />
                ) : (
                    <FlatList
                        data={volunteers}
                        keyExtractor={item => item.id}
                        renderItem={renderVolunteer}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={
                            <Text
                                style={{
                                    color: theme.colors.textSecondary,
                                    textAlign: 'center',
                                    marginTop: 20,
                                }}
                            >
                                No volunteers drafted yet.
                            </Text>
                        }
                    />
                )}
            </View>

            {/* Award Points Modal */}
            <Modal visible={awardModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            Award Points
                        </Text>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: 15 }}>
                            Award points for:{' '}
                            {selectedVolunteer?.displayName ||
                                selectedVolunteer?.email ||
                                selectedVolunteer?.id}
                        </Text>

                        <Text style={{ color: theme.colors.text, marginBottom: 5 }}>
                            Task Difficulty:
                        </Text>
                        <View
                            style={{
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                                borderRadius: 8,
                                backgroundColor:
                                    Platform.OS === 'web' ? '#fff' : theme.colors.background,
                                marginBottom: 15,
                            }}
                        >
                            <Picker
                                selectedValue={awardRemark}
                                onValueChange={itemValue => setAwardRemark(itemValue)}
                                style={{
                                    color: Platform.OS === 'web' ? '#000' : theme.colors.text,
                                    backgroundColor: 'transparent',
                                    borderWidth: 0,
                                }}
                                dropdownIconColor={
                                    Platform.OS === 'web' ? '#000' : theme.colors.text
                                }
                            >
                                <Picker.Item
                                    label="Easy (5 Points)"
                                    value="easy"
                                    color={Platform.OS === 'web' ? undefined : theme.colors.text}
                                />
                                <Picker.Item
                                    label="Hard (10 Points)"
                                    value="hard"
                                    color={Platform.OS === 'web' ? undefined : theme.colors.text}
                                />
                                <Picker.Item
                                    label="Major (20 Points)"
                                    value="major"
                                    color={Platform.OS === 'web' ? undefined : theme.colors.text}
                                />
                            </Picker>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: theme.colors.border },
                                ]}
                                onPress={() => setAwardModalVisible(false)}
                            >
                                <Text style={{ color: theme.colors.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: theme.colors.primary },
                                ]}
                                onPress={handleAwardPoints}
                                disabled={awarding}
                            >
                                {awarding ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Award</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Drop Volunteer Modal */}
            <Modal visible={dropModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            Drop Volunteer
                        </Text>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: 15 }}>
                            Dropping:{' '}
                            {selectedVolunteer?.displayName ||
                                selectedVolunteer?.email ||
                                selectedVolunteer?.id}
                        </Text>

                        <TextInput
                            style={[
                                styles.reasonInput,
                                {
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                },
                            ]}
                            placeholder="Reason for dropping (Optional)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={dropReason}
                            onChangeText={setDropReason}
                            multiline
                        />

                        <View style={styles.switchRow}>
                            <Text style={{ color: theme.colors.text }}>
                                Revoke all volunteer points?
                            </Text>
                            <Switch value={revokePoints} onValueChange={setRevokePoints} />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: theme.colors.border },
                                ]}
                                onPress={() => setDropModalVisible(false)}
                            >
                                <Text style={{ color: theme.colors.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: theme.colors.error },
                                ]}
                                onPress={handleDrop}
                                disabled={dropping}
                            >
                                {dropping ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Drop</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

ManageVolunteersScreen.propTypes = {
    route: PropTypes.shape({
        params: PropTypes.shape({
            eventId: PropTypes.string.isRequired,
            eventTitle: PropTypes.string.isRequired,
        }).isRequired,
    }).isRequired,
    navigation: PropTypes.shape({
        goBack: PropTypes.func.isRequired,
    }).isRequired,
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 10,
    },
    backButton: {
        marginRight: 16,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    container: {
        flex: 1,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    searchSection: {
        marginBottom: 20,
    },
    searchRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        marginRight: 10,
    },
    searchButton: {
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchResultCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    draftButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    volunteerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    volunteerInfo: {
        flex: 1,
    },
    volunteerName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        borderRadius: 12,
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 20,
    },
    modalButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    reasonInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        height: 80,
        textAlignVertical: 'top',
        marginBottom: 15,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
