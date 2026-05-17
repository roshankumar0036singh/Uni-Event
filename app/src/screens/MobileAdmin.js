import { Ionicons } from '@expo/vector-icons';
import { collection, deleteField, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function MobileAdmin() {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);
    const [activeTab, setActiveTab] = useState('events');
    const [events, setEvents] = useState([]);
    const [requests, setRequests] = useState([]);
    const [appeals, setAppeals] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // Suspension Modal State
    const [suspendModalVisible, setSuspendModalVisible] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [targetEventId, setTargetEventId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            if (activeTab === 'events') {
                const q = query(collection(db, 'events'), where('status', '==', 'active'));
                const snapshot = await getDocs(q);
                const list = [];
                const now = new Date();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Filter future/ongoing events (endAt >= now, or startAt >= now if no endAt)
                    if (new Date(data.endAt || data.startAt) >= now) {
                        list.push({ id: doc.id, ...data });
                    }
                });
                setEvents(list);
            } else if (activeTab === 'requests') {
                const q = query(collection(db, 'clubs'), where('approvalStatus', '==', 'pending'));
                const snapshot = await getDocs(q);
                const list = [];
                snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
                setRequests(list);
            } else {
                const q = query(collection(db, 'events'), where('appealStatus', '==', 'pending'));
                const snapshot = await getDocs(q);
                const list = [];
                snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
                setAppeals(list);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not fetch data');
        } finally {
            setRefreshing(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openSuspendModal = eventId => {
        setTargetEventId(eventId);
        setSuspendReason('');
        setSuspendModalVisible(true);
    };

    const handleConfirmSuspend = async () => {
        if (!suspendReason.trim()) {
            Alert.alert('Required', 'Please enter a reason.');
            return;
        }
        try {
            await updateDoc(doc(db, 'events', targetEventId), {
                status: 'suspended',
                appealStatus: 'none',
                suspensionReason: suspendReason,
            });
            Alert.alert('Suspended', 'Event suspended successfully.');
            setSuspendModalVisible(false);
            fetchData();
        } catch (_error) {
            Alert.alert('Error', 'Failed to suspend event');
        }
    };

    const handleAcceptAppeal = async eventId => {
        try {
            await updateDoc(doc(db, 'events', eventId), {
                status: 'active',
                appealStatus: 'resolved',
                suspensionReason: deleteField(),
            });
            Alert.alert('Restored', 'Event is active again.');
            fetchData();
        } catch (_e) {
            Alert.alert('Error', 'Failed to restore event');
        }
    };

    const handleRejectAppeal = async eventId => {
        try {
            await updateDoc(doc(db, 'events', eventId), {
                appealStatus: 'rejected',
            });
            Alert.alert('Rejected', 'Appeal rejected.');
            fetchData();
        } catch (_e) {
            Alert.alert('Error', 'Failed to update');
        }
    };

    const handleApproveClub = async (reqId, ownerId) => {
        try {
            await updateDoc(doc(db, 'clubs', reqId), { approvalStatus: 'approved' });
            if (ownerId) await updateDoc(doc(db, 'users', ownerId), { role: 'club' });
            Alert.alert('Approved', 'Club approved and user promoted.');
            fetchData();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    const handleRejectClub = async reqId => {
        try {
            await updateDoc(doc(db, 'clubs', reqId), { approvalStatus: 'rejected' });
            Alert.alert('Rejected', 'Club request rejected.');
            fetchData();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderEventItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF6B3520' }]}>
                    <Ionicons name="calendar" size={24} color="#FF6B35" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.ownerEmail || 'Organizer'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#FF6B3520' }]}>
                    <Text style={[styles.badgeText, { color: '#FF6B35' }]}>ACTIVE</Text>
                </View>
            </View>
            <Text style={styles.cardDesc}>
                {new Date(item.startAt).toLocaleDateString()} at {item.location}
            </Text>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => openSuspendModal(item.id)}
                >
                    <Text style={[styles.actionBtnText, { color: '#FF4444' }]}>Suspend</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderRequestItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF6B3520' }]}>
                    <Ionicons name="people" size={24} color="#FF6B35" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title || 'New Club'}</Text>
                    <Text style={styles.cardSubtitle}>{item.ownerEmail || 'Requester'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#FF6B3520' }]}>
                    <Text style={[styles.badgeText, { color: '#FF6B35' }]}>PENDING</Text>
                </View>
            </View>
            <Text style={styles.cardDesc}>{item.description || 'No description provided.'}</Text>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectClub(item.id)}
                >
                    <Text style={[styles.actionBtnText, { color: '#FF4444' }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApproveClub(item.id, item.ownerId)}
                >
                    <Text style={[styles.actionBtnText, { color: '#4CAF50' }]}>Approve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderAppealItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF444420' }]}>
                    <Ionicons name="alert-circle" size={24} color="#FF4444" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={[styles.cardSubtitle, { color: '#FF4444' }]}>SUSPENDED</Text>
                </View>
            </View>
            <View style={styles.appealBox}>
                <Text style={styles.appealLabel}>Appeal Message:</Text>
                <Text style={styles.appealText}>
                    &quot;{item.appealMessage || 'No message provided'}&quot;
                </Text>
            </View>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectAppeal(item.id)}
                >
                    <Text style={[styles.actionBtnText, { color: '#FF4444' }]}>Reject Appeal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleAcceptAppeal(item.id)}
                >
                    <Text style={[styles.actionBtnText, { color: '#4CAF50' }]}>Restore Event</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                    <Text style={styles.headerSubtitle}>Manage platform activity</Text>
                </View>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'events' && styles.activeTab]}
                    onPress={() => setActiveTab('events')}
                >
                    <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
                        Events
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                    onPress={() => setActiveTab('requests')}
                >
                    <Text
                        style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}
                    >
                        Club Requests
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'appeals' && styles.activeTab]}
                    onPress={() => setActiveTab('appeals')}
                >
                    <Text style={[styles.tabText, activeTab === 'appeals' && styles.activeTabText]}>
                        Appeals
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={
                    activeTab === 'events' ? events : activeTab === 'requests' ? requests : appeals
                }
                keyExtractor={item => item.id}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={
                    activeTab === 'events'
                        ? renderEventItem
                        : activeTab === 'requests'
                          ? renderRequestItem
                          : renderAppealItem
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={64} color="#666" />
                        <Text style={styles.emptyText}>
                            {activeTab === 'events'
                                ? 'No active events found'
                                : activeTab === 'requests'
                                  ? 'No pending club requests'
                                  : 'No pending appeals'}
                        </Text>
                    </View>
                }
            />

            <Modal
                visible={suspendModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSuspendModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Suspend Event</Text>
                        <Text style={styles.modalSubtitle}>
                            Please provide a reason for suspension.
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Reason (e.g. Violation of terms)..."
                            placeholderTextColor="#666"
                            multiline
                            value={suspendReason}
                            onChangeText={setSuspendReason}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setSuspendModalVisible(false)}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.confirmBtn]}
                                onPress={handleConfirmSuspend}
                            >
                                <Text style={styles.confirmText}>Suspend</Text>
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
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 10,
            marginBottom: 20,
        },
        headerTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
        headerSubtitle: { fontSize: 14, color: theme.colors.textSecondary },
        tabContainer: {
            flexDirection: 'row',
            marginHorizontal: 20,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 4,
            marginBottom: 20,
        },
        tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
        activeTab: { backgroundColor: theme.colors.surface, ...theme.shadows.small },
        tabText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
        activeTabText: { color: theme.colors.primary, fontWeight: '700' },
        card: {
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
            ...theme.shadows.small,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
        iconContainer: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#FFA50020',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
        cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary },
        badge: {
            backgroundColor: '#FFA50020',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        badgeText: { fontSize: 10, fontWeight: '700', color: '#FFA500' },
        cardDesc: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: 16,
            lineHeight: 20,
        },
        appealBox: {
            backgroundColor: 'rgba(255,255,255,0.03)',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            borderLeftWidth: 2,
            borderLeftColor: '#FFA500',
        },
        appealLabel: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 },
        appealText: { fontSize: 14, color: theme.colors.text, fontStyle: 'italic' },
        actionRow: {
            flexDirection: 'row',
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.1)',
            paddingTop: 16,
        },
        actionBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)',
        },
        approveBtn: { backgroundColor: '#4CAF5015' },
        rejectBtn: { backgroundColor: '#FF444415' },
        actionBtnText: { fontWeight: '700', fontSize: 14 },
        emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
        emptyText: { marginTop: 16, fontSize: 16, color: theme.colors.textSecondary },

        // Modal Styles
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        modalContent: {
            width: '100%',
            backgroundColor: theme.colors.surface,
            borderRadius: 20,
            padding: 24,
            ...theme.shadows.large,
        },
        modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
        modalSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20 },
        modalInput: {
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            padding: 16,
            borderRadius: 12,
            minHeight: 100,
            textAlignVertical: 'top',
            marginBottom: 20,
        },
        modalButtons: { flexDirection: 'row', gap: 12 },
        modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
        cancelBtn: { backgroundColor: theme.colors.background },
        confirmBtn: { backgroundColor: '#FF4444' },
        cancelText: { color: theme.colors.text, fontWeight: '600' },
        confirmText: { color: '#fff', fontWeight: 'bold' },
    });
