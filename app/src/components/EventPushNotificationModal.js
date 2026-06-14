import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { sendEventPushNotification } from '../lib/eventPushNotificationService';

export default function EventPushNotificationModal({
    visible,
    eventId,
    eventTitle,
    theme,
    onClose,
}) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const closeModal = () => {
        if (sending) return;
        setTitle('');
        setMessage('');
        onClose();
    };

    const showDeliverySummary = result => {
        if (result.targetedCount === 0) {
            Alert.alert(
                'No Reachable Attendees',
                'Registered attendees do not have valid push notification tokens yet.',
            );
            return;
        }

        const summary = [`Sent to ${result.sentCount} attendee(s).`];
        if (result.failedCount > 0) {
            summary.push(`${result.failedCount} delivery attempt(s) failed.`);
        }
        if (result.skippedCount > 0) {
            summary.push(`${result.skippedCount} attendee(s) could not receive push.`);
        }
        Alert.alert('Push Update Sent', summary.join('\n'));
    };

    const handleSend = async () => {
        if (sending) return;

        const normalizedTitle = title.trim();
        const normalizedMessage = message.trim();

        if (!normalizedTitle || !normalizedMessage) {
            Alert.alert('Missing Details', 'Enter both a notification title and message.');
            return;
        }

        setSending(true);
        try {
            const result = await sendEventPushNotification(
                eventId,
                normalizedTitle,
                normalizedMessage,
            );
            showDeliverySummary(result);
            setTitle('');
            setMessage('');
            onClose();
        } catch (error) {
            console.error('Push notification failed:', error);
            Alert.alert('Unable to Send', error.message || 'Failed to send push notification.');
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
            <View style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.header}>
                        <View style={styles.heading}>
                            <Ionicons
                                name="notifications-outline"
                                size={22}
                                color={theme.colors.primary}
                            />
                            <Text style={[styles.title, { color: theme.colors.text }]}>
                                Push Update
                            </Text>
                        </View>
                        <TouchableOpacity onPress={closeModal} disabled={sending}>
                            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                        Send an immediate update to registered attendees who enabled push
                        notifications.
                    </Text>

                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            Title
                        </Text>
                        <Text
                            style={[styles.characterCount, { color: theme.colors.textSecondary }]}
                        >
                            {title.length}/80
                        </Text>
                    </View>
                    <TextInput
                        style={[
                            styles.input,
                            { color: theme.colors.text, borderColor: theme.colors.border },
                        ]}
                        placeholder={`Update for ${eventTitle}`}
                        placeholderTextColor={theme.colors.textSecondary}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={80}
                        editable={!sending}
                    />

                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            Message
                        </Text>
                        <Text
                            style={[styles.characterCount, { color: theme.colors.textSecondary }]}
                        >
                            {message.length}/500
                        </Text>
                    </View>
                    <TextInput
                        style={[
                            styles.input,
                            styles.messageInput,
                            { color: theme.colors.text, borderColor: theme.colors.border },
                        ]}
                        placeholder="Share a venue, schedule, or event update..."
                        placeholderTextColor={theme.colors.textSecondary}
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        maxLength={500}
                        editable={!sending}
                    />

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            { backgroundColor: theme.colors.primary },
                            sending && styles.disabledButton,
                        ]}
                        onPress={handleSend}
                        disabled={sending}
                    >
                        {sending ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.sendButtonContent}>
                                <Ionicons name="send" size={18} color="#fff" />
                                <Text style={styles.sendButtonText}>Send Push Update</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

EventPushNotificationModal.propTypes = {
    visible: PropTypes.bool.isRequired,
    eventId: PropTypes.string.isRequired,
    eventTitle: PropTypes.string.isRequired,
    theme: PropTypes.shape({
        colors: PropTypes.shape({
            surface: PropTypes.string.isRequired,
            primary: PropTypes.string.isRequired,
            text: PropTypes.string.isRequired,
            textSecondary: PropTypes.string.isRequired,
            border: PropTypes.string.isRequired,
        }).isRequired,
    }).isRequired,
    onClose: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        borderRadius: 20,
        padding: 20,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    heading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 18,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
    },
    characterCount: {
        fontSize: 12,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
    },
    messageInput: {
        height: 120,
        textAlignVertical: 'top',
    },
    sendButton: {
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.65,
    },
    sendButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
