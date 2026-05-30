import { Ionicons } from '@expo/vector-icons';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function EventChatScreen({ route, navigation }) {
    const { eventId, eventTitle } = route.params;
    const { user, role } = useAuth();
    const { theme } = useTheme();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(true);

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉', '👋', '🙏', '💯', '👀'];

    const onEmojiSelect = emoji => {
        setInputText(prev => prev + emoji);
    };

    // Check if user is organizer/admin to show badge
    const [isOrganizer, setIsOrganizer] = useState(false);

    useEffect(() => {
        let unsubscribeMessages;
        let isActive = true;

        const checkAccessAndSubscribe = async () => {
            if (!user?.uid) {
                if (!isActive) return;

                setIsOrganizer(false);
                setHasAccess(false);
                setCheckingAccess(false);
                return;
            }

            try {
                if (isActive) setCheckingAccess(true);

                const eventDoc = await getDoc(doc(db, 'events', eventId));

                if (!isActive) return;

                const isOwner = eventDoc.exists() && eventDoc.data().ownerId === user.uid;

                const isAdmin = role === 'admin';

                const participantDoc = await getDoc(
                    doc(db, 'events', eventId, 'participants', user.uid),
                );

                if (!isActive) return;

                const participantData = participantDoc.exists() ? participantDoc.data() : null;

                const eventScopedClubStaff =
                    participantDoc.exists() &&
                    (participantData?.role === 'club' || participantData?.isStaff === true);

                const allowed =
                    participantDoc.exists() || isOwner || isAdmin || eventScopedClubStaff;

                setIsOrganizer(isOwner);
                setHasAccess(allowed);

                if (!allowed) {
                    setMessages([]);
                    return;
                }

                const q = query(
                    collection(db, 'events', eventId, 'messages'),
                    orderBy('createdAt', 'desc'),
                );

                const localUnsub = onSnapshot(q, snapshot => {
                    if (!isActive) return;

                    setMessages(
                        snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                        })),
                    );
                });

                unsubscribeMessages = localUnsub;
            } catch (error) {
                console.error('Access check failed', error);

                if (!isActive) return;

                setHasAccess(false);
                setMessages([]);
            } finally {
                if (isActive) {
                    setCheckingAccess(false);
                }
            }
        };

        checkAccessAndSubscribe();

        return () => {
            isActive = false;

            if (unsubscribeMessages) {
                unsubscribeMessages();
            }
        };
    }, [eventId, user?.uid, role]);

    const handleSend = async () => {
        if (!inputText.trim() || !user?.uid || !hasAccess) return;
        setSending(true);
        try {
            await addDoc(collection(db, 'events', eventId, 'messages'), {
                text: inputText.trim(),
                userId: user.uid,
                displayName: user.displayName || 'Anonymous',
                createdAt: serverTimestamp(),
                isOrganizer: isOrganizer || role === 'admin',
                role: role, // 'student', 'admin', 'club'
            });
            setInputText('');
        } catch (error) {
            console.error('Send failed', error);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = item.userId === user.uid;
        const isAdminOrMod = item.isOrganizer || item.role === 'admin' || item.role === 'club';

        return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
                {!isMe && (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.avatarText}>
                            {item.displayName?.[0]?.toUpperCase()}
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.bubble,
                        isMe
                            ? { backgroundColor: theme.colors.primary }
                            : { backgroundColor: theme.colors.surface },
                        isMe ? styles.myBubble : styles.otherBubble,
                    ]}
                >
                    {!isMe && (
                        <View style={styles.senderHeader}>
                            <Text
                                style={[styles.senderName, { color: theme.colors.textSecondary }]}
                            >
                                {item.displayName}
                            </Text>
                            {isAdminOrMod && (
                                <View style={styles.adminBadge}>
                                    <Text style={styles.adminBadgeText}>Host</Text>
                                </View>
                            )}
                        </View>
                    )}
                    <Text
                        style={[
                            styles.messageText,
                            isMe ? { color: '#fff' } : { color: theme.colors.text },
                        ]}
                    >
                        {item.text}
                    </Text>
                    <Text
                        style={[
                            styles.timeText,
                            isMe
                                ? { color: 'rgba(255,255,255,0.7)' }
                                : { color: theme.colors.textSecondary },
                        ]}
                    >
                        {item.createdAt?.toMillis
                            ? new Date(item.createdAt.toMillis()).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                              })
                            : 'Just now'}
                    </Text>
                </View>
            </View>
        );
    };

    if (checkingAccess) {
        return (
            <SafeAreaView
                style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}
            >
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.accessText, { color: theme.colors.textSecondary }]}>
                    Checking chat access...
                </Text>
            </SafeAreaView>
        );
    }

    if (!hasAccess) {
        return (
            <SafeAreaView
                style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}
            >
                <Ionicons name="lock-closed" size={56} color={theme.colors.textSecondary} />
                <Text style={[styles.accessTitle, { color: theme.colors.text }]}>
                    Chat Access Restricted
                </Text>
                <Text style={[styles.accessText, { color: theme.colors.textSecondary }]}>
                    You must register for this event to access the chat.
                </Text>

                <TouchableOpacity
                    style={[styles.backAccessBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backAccessText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            edges={['bottom']}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
                        {eventTitle}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                        {messages.length} messages
                    </Text>
                </View>
            </View>

            {/* Chat List */}
            <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                inverted
                contentContainerStyle={styles.listContent}
            />

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View
                    style={[
                        styles.inputContainer,
                        {
                            backgroundColor: theme.colors.surface,
                            borderTopColor: theme.colors.border,
                        },
                    ]}
                >
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.colors.background,
                                color: theme.colors.text,
                                borderColor: theme.colors.border,
                            },
                        ]}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.iconBtn, { marginRight: 8 }]}
                        onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                        <Ionicons
                            name="happy-outline"
                            size={24}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.sendBtn,
                            {
                                backgroundColor: theme.colors.primary,
                                opacity: inputText.trim() ? 1 : 0.5,
                            },
                        ]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={20} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>

                {showEmojiPicker && (
                    <View
                        style={[
                            styles.emojiPicker,
                            {
                                backgroundColor: theme.colors.surface,
                                borderTopColor: theme.colors.border,
                            },
                        ]}
                    >
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ padding: 10, gap: 15 }}
                        >
                            {emojis.map(emoji => (
                                <TouchableOpacity key={emoji} onPress={() => onEmojiSelect(emoji)}>
                                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    accessTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        textAlign: 'center',
    },
    accessText: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    backAccessBtn: {
        marginTop: 20,
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: 10,
    },
    backAccessText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        gap: 15,
    },
    listContent: { padding: 15 },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 15,
        width: '100%',
    },
    myMessageRow: {
        justifyContent: 'flex-end',
    },
    otherMessageRow: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginTop: 5,
    },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    bubble: {
        padding: 12,
        borderRadius: 18,
        minWidth: 50,
        maxWidth: '80%',
    },
    myBubble: {
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        borderTopLeftRadius: 4,
    },
    senderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 5,
    },
    senderName: { fontSize: 12, fontWeight: 'bold' },
    adminBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
    },
    adminBadgeText: { fontSize: 8, fontWeight: 'bold', color: '#000' },
    messageText: { fontSize: 16 },
    timeText: { fontSize: 10, marginTop: 4, textAlign: 'right' },
    inputContainer: {
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        gap: 10,
    },
    input: {
        flex: 1,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        maxHeight: 100,
        borderWidth: 1,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiPicker: {
        height: 60,
        borderTopWidth: 1,
    },
});

EventChatScreen.propTypes = {
    route: PropTypes.object,
    navigation: PropTypes.object,
};
