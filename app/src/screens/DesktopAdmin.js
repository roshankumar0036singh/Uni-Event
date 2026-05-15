import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../lib/firebaseConfig';

import { useAuth } from '../lib/AuthContext';

export default function DesktopAdmin() {
    const [activeTab, setActiveTab] = useState('clubs'); // 'clubs' | 'events' | 'analytics'
    const [clubs, setClubs] = useState([]);
    const [events, setEvents] = useState([]);

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

    const { user } = useAuth(); // Get current admin user
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'; // Backend URL

    const approveClub = async (clubId, ownerId) => {
        try {
            // 1. Update Firestore
            await updateDoc(doc(db, 'clubs', clubId), { approved: true });

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
                                        {club.approved ? 'Approved' : 'Pending'}
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
                        <View style={styles.table}>
                            <View style={[styles.row, styles.headerRow]}>
                                <Text style={styles.cell}>Title</Text>
                                <Text style={styles.cell}>Date</Text>
                                <Text style={styles.cell}>Category</Text>
                            </View>
                            {events.map(event => (
                                <View key={event.id} style={styles.row}>
                                    <Text style={styles.cell}>{event.title}</Text>
                                    <Text style={styles.cell}>
                                        {new Date(event.startAt).toLocaleDateString()}
                                    </Text>
                                    <Text style={styles.cell}>{event.category}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {activeTab === 'analytics' && (
                        <View>
                            <Text>Analytics Placeholder</Text>
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
});
