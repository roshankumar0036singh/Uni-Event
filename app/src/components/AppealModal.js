import { Ionicons } from '@expo/vector-icons';
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
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function AppealModal({ visible, onClose, onSubmit, isSubmitting }) {
    const { theme } = useTheme();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = () => {
        if (!subject.trim() || !message.trim()) {
            Alert.alert('Required', 'Please fill in both subject and message.');
            return;
        }
        onSubmit({ subject, message });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.header}>
                        <Ionicons
                            name="chatbubbles-outline"
                            size={32}
                            color={theme.colors.primary}
                        />
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            Appeal Suspension
                        </Text>
                    </View>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Please provide a subject and detailed message for the admin to review.
                    </Text>

                    <Text style={[styles.label, { color: theme.colors.text }]}>Subject</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.colors.background,
                                color: theme.colors.text,
                                borderColor: theme.colors.border,
                            },
                        ]}
                        placeholder="e.g. Content Violation Fixed"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={subject}
                        onChangeText={setSubject}
                    />

                    <Text style={[styles.label, { color: theme.colors.text }]}>Message</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.colors.background,
                                color: theme.colors.text,
                                borderColor: theme.colors.border,
                                minHeight: 120,
                                textAlignVertical: 'top',
                            },
                        ]}
                        placeholder="Explain why the event should be restored..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                    />

                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={[
                                styles.btn,
                                styles.cancelBtn,
                                { borderColor: theme.colors.border },
                            ]}
                            onPress={onClose}
                        >
                            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: theme.colors.primary }]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                    Submit Appeal
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        borderRadius: 12,
        padding: 16,
        fontSize: 14,
        borderWidth: 1,
        marginBottom: 20,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    btn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
});

AppealModal.propTypes = {
    visible: PropTypes.any,
    onClose: PropTypes.any,
    onSubmit: PropTypes.any,
    isSubmitting: PropTypes.bool,
};
