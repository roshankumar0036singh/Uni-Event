import { collection, doc, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db, functions } from '../lib/firebaseConfig';

import { useAuth } from '../lib/AuthContext';
import { formatEventDate } from '../lib/formatEventDate';

const downloadBase64Pdf = ({ base64, fileName }) => {
    if (Platform.OS !== 'web') {
        Alert.alert(
            'Download unavailable',
            'PDF reports are currently available from the web admin panel.',
        );
        return;
    }

    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.codePointAt(i);
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'branch-participation-report.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export default function DesktopAdmin() {
    const [activeTab, setActiveTab] = useState('clubs'); // 'clubs' | 'events' | 'analytics'
    const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'deleted'
    const [clubs, setClubs] = useState([]);
    const [events, setEvents] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSummary, setReportSummary] = useState(null);

    useEffect(() => {
        if (activeTab === 'clubs') fetchClubs();
        if (activeTab === 'events') fetchEvents();
    }, [activeTab]);

    const fetchClubs = async () => {
        const snapshot = await getDocs(collection(db, 'clubs'));
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setClubs(list);
    };

    const fetchEvents = async () => {
        const snapshot = await getDocs(collection(db, 'events'));
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setEvents(list);
    };

    const { user } = useAuth();
    const navigation = useNavigation();
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    const downloadBranchReport = async () => {
        if (Platform.OS !== 'web') {
            Alert.alert(
                'Download unavailable',
                'PDF reports are currently available from the web admin panel.',
            );
            return;
        }
        setReportLoading(true);

        try {
            const generateReport = httpsCallable(functions, 'generateBranchParticipationReport');
            const response = await generateReport();
            const report = response.data;

            if (!report?.base64) {
                throw new Error('The report did not include PDF data.');
            }

            downloadBase64Pdf({
                base64: report.base64,
                fileName: report.fileName,
            });

            setReportSummary(report.summary || null);
            Alert.alert('Success', 'Branch participation report generated.');
        } catch (error) {
            console.error('Branch report error:', error);
            Alert.alert(
                'Report Failed',
                error?.message || 'Failed to generate branch participation report.',
            );
        } finally {
            setReportLoading(false);
        }
    };

    const handleRestoreEvent = async eventId => {
        try {
            await updateDoc(doc(db, 'events', eventId), {
                deletedAt: deleteField(),
                deletedBy: deleteField(),
            });
            fetchEvents();
            Alert.alert('Restored', 'Event restored successfully.');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to restore event');
        }
    };

    const approveClub = async (clubId, ownerId) => {
        try {
            // 1. Update Firestore
            if (!ownerId) {
                console.error('Owner ID is missing');
                return;
            }

            await Promise.all([
                updateDoc(doc(db, 'clubs', clubId), {
                    approved: true,
                    verificationStatus: 'verified',
                }),

                updateDoc(doc(db, 'users', ownerId), {
                    verificationStatus: 'verified',
                }),
            ]);

            // 2. Call Backend to Set Role
            if (user && ownerId) {
                const token = await user.getIdToken();
                const response = await fetch(`${API_URL}/api/setRole`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ uid: ownerId, role: 'club' }),
                });

                if (!response.ok) {
                    const err = await response.text();
                    console.error('Backend Error:', err);
                    Alert.alert('Warning', 'Club approved but Role update failed: ' + err);
                    return;
                }
            }

            fetchClubs();
            Alert.alert('Success', 'Club approved and Owner Role updated!');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to approve');
        }
    };

    return (
        <View style={styles.container}>
            {/* Sidebar */}
            <View style={styles.sidebar}>
                <Text style={styles.sidebarTitle}>Admin Panel</Text>
                <TouchableOpacity
                    style={[styles.navItem, activeTab === 'clubs' && styles.navActive]}
                    onPress={() => setActiveTab('clubs')}
                >
                    <Text style={styles.navText}>Clubs</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.navItem, activeTab === 'events' && styles.navActive]}
                    onPress={() => setActiveTab('events')}
                >
                    <Text style={styles.navText}>Events</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.navItem, activeTab === 'analytics' && styles.navActive]}
                    onPress={() => setActiveTab('analytics')}
                >
                    <Text style={styles.navText}>Analytics</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => navigation.navigate('LocationHeatmap')}
                >
                    <Text style={styles.navText}>Heatmap</Text>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={styles.main}>
                <Text style={styles.header}>
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management
                </Text>

                <ScrollView style={styles.contentArea}>
                    {activeTab === 'clubs' && (
                        <View style={styles.table}>
                            <View style={[styles.row, styles.headerRow]}>
                                <Text style={styles.cell}>Name</Text>
                                <Text style={styles.cell}>Owner</Text>
                                <Text style={styles.cell}>Status</Text>
                                <Text style={styles.cell}>Action</Text>
                            </View>
                            {clubs.map(club => (
                                <View key={club.id} style={styles.row}>
                                    <Text style={styles.cell}>{club.name}</Text>
                                    <Text style={styles.cell}>{club.ownerUserId}</Text>
                                    <Text style={styles.cell}>
                                        {club.verificationStatus === 'verified'
                                            ? 'Verified'
                                            : 'Pending'}
                                    </Text>
                                    <View style={styles.cell}>
                                        {!club.approved && (
                                            <TouchableOpacity
                                                style={styles.approveBtn}
                                                onPress={() =>
                                                    approveClub(club.id, club.ownerUserId)
                                                }
                                            >
                                                <Text style={styles.approveText}>Approve</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {activeTab === 'events' && (
                        <View>
                            <View style={styles.tabRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.subTab,
                                        activeSubTab === 'active' && styles.activeSubTab,
                                    ]}
                                    onPress={() => setActiveSubTab('active')}
                                >
                                    <Text
                                        style={[
                                            styles.subTabText,
                                            activeSubTab === 'active' && styles.activeSubTabText,
                                        ]}
                                    >
                                        Active
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.subTab,
                                        activeSubTab === 'deleted' && styles.activeSubTab,
                                    ]}
                                    onPress={() => setActiveSubTab('deleted')}
                                >
                                    <Text
                                        style={[
                                            styles.subTabText,
                                            activeSubTab === 'deleted' && styles.activeSubTabText,
                                        ]}
                                    >
                                        Deleted
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.table}>
                                <View style={[styles.row, styles.headerRow]}>
                                    <Text style={styles.cell}>Title</Text>
                                    <Text style={styles.cell}>Date</Text>
                                    <Text style={styles.cell}>Category</Text>
                                    <Text style={styles.cell}>Action</Text>
                                </View>
                                {events
                                    .filter(e =>
                                        activeSubTab === 'deleted'
                                            ? e.deletedAt != null
                                            : !e.deletedAt,
                                    )
                                    .map(event => (
                                        <View key={event.id} style={styles.row}>
                                            <Text style={styles.cell}>{event.title}</Text>
                                            <Text style={styles.cell}>
                                                {formatEventDate(event.startAt)}
                                            </Text>
                                            <Text style={styles.cell}>{event.category}</Text>
                                            <View style={styles.cell}>
                                                {activeSubTab === 'deleted' && (
                                                    <TouchableOpacity
                                                        style={styles.restoreBtn}
                                                        onPress={() => handleRestoreEvent(event.id)}
                                                    >
                                                        <Text style={styles.restoreBtnText}>
                                                            Restore
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                            </View>
                        </View>
                    )}

                    {activeTab === 'analytics' && (
                        <View style={styles.analyticsPanel}>
                            <Text style={styles.analyticsTitle}>
                                Branch-wise Participation Report
                            </Text>
                            <Text style={styles.analyticsDescription}>
                                Generate a PDF summary of registrations and attendance grouped by
                                academic branch for dean-level review.
                            </Text>

                            {reportSummary && (
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryValue}>
                                            {reportSummary.branchCount}
                                        </Text>
                                        <Text style={styles.summaryLabel}>Branches</Text>
                                    </View>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryValue}>
                                            {reportSummary.totalRegistrations}
                                        </Text>
                                        <Text style={styles.summaryLabel}>Registrations</Text>
                                    </View>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryValue}>
                                            {reportSummary.totalAttendance}
                                        </Text>
                                        <Text style={styles.summaryLabel}>Attendance</Text>
                                    </View>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryValue}>
                                            {reportSummary.eventCount}
                                        </Text>
                                        <Text style={styles.summaryLabel}>Events</Text>
                                    </View>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.reportBtn,
                                    reportLoading && styles.reportBtnDisabled,
                                ]}
                                onPress={downloadBranchReport}
                                disabled={reportLoading}
                            >
                                <Text style={styles.reportBtnText}>
                                    {reportLoading ? 'Generating PDF...' : 'Download PDF Report'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: 250,
        backgroundColor: '#333',
        padding: 20,
    },
    sidebarTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 30,
    },
    navItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    navActive: {
        backgroundColor: '#444',
    },
    navText: {
        color: '#fff',
        fontSize: 16,
    },
    main: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f4f4f4',
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    contentArea: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    table: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    headerRow: {
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 2,
        borderBottomColor: '#ddd',
    },
    cell: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    approveBtn: {
        backgroundColor: 'green',
        padding: 5,
        borderRadius: 4,
        alignItems: 'center',
        width: 80,
    },
    approveText: {
        color: '#fff',
        fontSize: 12,
    },
    analyticsPanel: {
        gap: 16,
        maxWidth: 760,
    },
    analyticsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#222',
    },
    analyticsDescription: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#f8f8f8',
        borderWidth: 1,
        borderColor: '#e6e6e6',
        borderRadius: 8,
        padding: 16,
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#222',
    },
    summaryLabel: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    reportBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 14,
        alignItems: 'center',
        alignSelf: 'flex-start',
        minWidth: 210,
    },
    reportBtnDisabled: {
        opacity: 0.6,
    },
    reportBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tabRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    subTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#eee',
    },
    activeSubTab: {
        backgroundColor: '#2563eb',
    },
    subTabText: {
        fontSize: 14,
        color: '#555',
        fontWeight: '600',
    },
    activeSubTabText: {
        color: '#fff',
    },
    restoreBtn: {
        backgroundColor: '#4CAF50',
        padding: 5,
        borderRadius: 4,
        alignItems: 'center',
        width: 80,
    },
    restoreBtnText: {
        color: '#fff',
        fontSize: 12,
    },
});
