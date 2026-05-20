import { Ionicons } from '@expo/vector-icons';
import { collection, deleteField, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import HeatmapScreen from './HeatmapScreen';

export default function MobileAdmin() {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [activeTab, setActiveTab] = useState('events'); // 'events' | 'requests' | 'appeals' | 'heatmap'
    const [events, setEvents] = useState([]);
    const [requests, setRequests] = useState([]);
    const [appeals, setAppeals] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const [suspendModalVisible, setSuspendModalVisible] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [targetEventId, setTargetEventId] = useState(null);

    const fetchData = useCallback(async () => {
        if (activeTab === 'heatmap') {
            setRefreshing(false);
            return;
        }

        try {
            if (activeTab === 'events') {
                const q = query(collection(db, 'events'), where('status', '==', 'active'));
                const snapshot = await getDocs(q);
                const list = [];
                const now = new Date();
                snapshot.forEach(doc => {
                    const data = doc.data();
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
            console.error('Suspension failed:', _error);
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
            console.error('Accept appeal failed:', _e);
            Alert.alert('Error', 'Failed to restore event');
        }
    };

    const handleRejectAppeal = async eventId => {
        try {
            await updateDoc(doc(db, 'events', eventId), { appealStatus: 'rejected' });
            Alert.alert('Rejected', 'Appeal rejected.');
            fetchData();
        } catch (_e) {
            console.error('Reject appeal failed:', _e);
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
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>Approve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderAppealItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF6B3520' }]}>
                    <Ionicons name="alert-circle" size={24} color="#FF6B35" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.ownerEmail || 'Organizer'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#FF6B3520' }]}>
                    <Text style={[styles.badgeText, { color: '#FF6B35' }]}>APPEAL</Text>
                </View>
            </View>
            <Text style={styles.cardDesc}>
                Reason: {item.suspensionReason || 'No reason provided'}
            </Text>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectAppeal(item.id)}
                >
                    <Text style={[styles.actionBtnText, { color: '#FF4444' }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleAcceptAppeal(item.id)}
                >
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>Restore</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const getData = () => {
        if (activeTab === 'events') return events;
        if (activeTab === 'requests') return requests;
        if (activeTab === 'appeals') return appeals;
        return [];
    };

    const getRenderItem = () => {
        if (activeTab === 'events') return renderEventItem;
        if (activeTab === 'requests') return renderRequestItem;
        if (activeTab === 'appeals') return renderAppealItem;
        return () => null;
    };

    return (
        <ScreenWrapper>
            {/* ── Tab Bar ──────────────────────────────────────────────────── */}
            <View style={styles.tabBar}>
                {[
                    { key: 'events', icon: 'calendar', label: 'Events' },
                    { key: 'requests', icon: 'people', label: 'Requests' },
                    { key: 'appeals', icon: 'alert-circle', label: 'Appeals' },
                    // ▼ NEW TAB
                    { key: 'heatmap', icon: 'map', label: 'Heatmap' },
                    // ▲ END NEW TAB
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={18}
                            color={
                                activeTab === tab.key
                                    ? theme.colors.primary
                                    : theme.colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.tabText,
                                {
                                    color:
                                        activeTab === tab.key
                                            ? theme.colors.primary
                                            : theme.colors.textSecondary,
                                },
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Content ───────────────────────────────────────────────────── */}
            {activeTab === 'heatmap' ? (
                <View style={{ flex: 1 }}>
                    <HeatmapScreen navigation={null} />
                </View>
            ) : (
                // ▲ END NEW
                <FlatList
                    data={getData()}
                    renderItem={getRenderItem()}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={48}
                                color={theme.colors.textSecondary}
                            />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                Nothing here right now
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Suspension Modal — unchanged */}
            <Modal
                visible={suspendModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setSuspendModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            Suspend Event
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                            Provide a reason for suspension:
                        </Text>

                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                },
                            ]}
                            value={suspendReason}
                            onChangeText={setSuspendReason}
                            placeholder="e.g., Violation of campus policy..."
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            numberOfLines={3}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setSuspendModalVisible(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.confirmBtn]}
                                onPress={handleConfirmSuspend}
                            >
                                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                                    Confirm
                                </Text>
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
        tabBar: {
            flexDirection: 'row',
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        tab: {
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            gap: 4,
        },
        tabActive: {
            borderBottomWidth: 2,
            borderBottomColor: theme.colors.primary,
        },
        tabText: {
            fontSize: 11,
            fontWeight: '600',
        },
        listContent: {
            padding: 16,
            paddingBottom: 100,
        },
        card: {
            backgroundColor: theme.colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
        },
        iconContainer: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.colors.text,
        },
        cardSubtitle: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginTop: 2,
        },

        cardDesc: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginBottom: 12,
        },
        badge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
        },
        badgeText: {
            fontSize: 10,
            fontWeight: '800',
        },

        actionRow: {
            flexDirection: 'row',
            gap: 8,
        },
        actionBtn: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: 'center',
        },
        rejectBtn: {
            backgroundColor: '#FF444420',
        },
        approveBtn: {
            backgroundColor: '#FF6B35',
        },
        actionBtnText: {
            fontWeight: '700',
            fontSize: 13,
        },
        emptyState: {
            alignItems: 'center',
            paddingTop: 80,
            gap: 12,
        },
        emptyText: {
            fontSize: 15,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
        },

        modalTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 8,
        },
        modalSubtitle: {
            fontSize: 14,
            marginBottom: 12,
        },
        textInput: {
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            minHeight: 80,
            textAlignVertical: 'top',
            fontSize: 14,
            marginBottom: 16,
        },
        modalActions: {
            flexDirection: 'row',
            gap: 12,
        },
        modalBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: 'center',
        },
        cancelBtn: {
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        confirmBtn: {
            backgroundColor: '#FF4444',
        },
        modalBtnText: {
            fontWeight: '700',
            fontSize: 15,
        },
    });
