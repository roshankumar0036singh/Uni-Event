import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function NotificationBell() {
    const { user } = useAuth();
    const { theme, isDarkMode } = useTheme();
    const styles = useMemo(() => getStyles(theme, isDarkMode), [theme, isDarkMode]);

    const [notifications, setNotifications] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
        );

        const unsubscribe = onSnapshot(q, snapshot => {
            const list = [];
            let unread = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.read) unread++;
                list.push({ id: doc.id, ...data });
            });
            setNotifications(list);
            setUnreadCount(unread);
        });

        return unsubscribe;
    }, [user]);

    const handleNotificationPress = async item => {
        // Mark as read
        if (!item.read) {
            try {
                const ref = doc(db, 'users', user.uid, 'notifications', item.id);
                await updateDoc(ref, { read: true });
            } catch (e) {
                console.error('Error marking read:', e);
            }
        }
        // Future: Navigate to event if eventId exists
    };

    return (
        <>
            <TouchableOpacity onPress={() => setShowModal(true)} style={styles.container}>
                <Text style={styles.bell}>🔔</Text>
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Notifications</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={styles.close}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={notifications}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.item, !item.read && styles.unread]}
                                    onPress={() => handleNotificationPress(item)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>{item.title}</Text>
                                        <Text style={styles.itemBody}>{item.body}</Text>
                                        <Text style={styles.itemTime}>
                                            {new Date(item.createdAt).toLocaleString()}
                                        </Text>
                                    </View>
                                    {!item.read && <View style={styles.dot} />}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No notifications</Text>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </>
    );
}

const getStyles = (theme, isDarkMode) =>
    StyleSheet.create({
        container: {
            padding: 10,
            marginRight: 10,
        },
        bell: {
            fontSize: 24,
        },
        badge: {
            position: 'absolute',
            top: 5,
            right: 5,
            backgroundColor: theme.colors.error,
            borderRadius: 10,
            width: 20,
            height: 20,
            justifyContent: 'center',
            alignItems: 'center',
        },
        badgeText: {
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: theme.colors.surface,
            height: '60%',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 15,
            alignItems: 'center',
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: theme.colors.text,
        },
        close: {
            color: theme.colors.primary,
            fontSize: 16,
            fontWeight: 'bold',
        },
        item: {
            padding: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
        },
        unread: {
            backgroundColor: isDarkMode ? '#2c2c2c' : '#f0f8ff',
        },
        itemTitle: {
            fontWeight: 'bold',
            marginBottom: 2,
            color: theme.colors.text,
        },
        itemBody: {
            color: theme.colors.textSecondary,
            fontSize: 14,
        },
        itemTime: {
            color: theme.colors.textSecondary,
            fontSize: 10,
            marginTop: 4,
        },
        dot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: theme.colors.primary,
            marginLeft: 10,
        },
        emptyText: {
            textAlign: 'center',
            marginTop: 20,
            color: theme.colors.textSecondary,
        },
    });
