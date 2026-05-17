import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Rating } from 'react-native-ratings';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function FeedbackModal({ visible, onClose, feedbackRequest, onSubmit }) {
    const { theme } = useTheme();
    const [attended, setAttended] = useState(null); // null, true, false
    const [eventRating, setEventRating] = useState(0);
    const [clubRating, setClubRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (attended === null) {
            Alert.alert('Required', 'Please confirm if you attended the event');
            return;
        }

        if (attended && (eventRating === 0 || clubRating === 0)) {
            Alert.alert('Required', 'Please rate both the event and organizer');
            return;
        }

        setLoading(true);
        try {
            await onSubmit({
                attended,
                eventRating: attended ? eventRating : null,
                clubRating: attended ? clubRating : null,
                feedback: attended ? feedback : null,
            });

            // Reset form
            setAttended(null);
            setEventRating(0);
            setClubRating(0);
            setFeedback('');
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!feedbackRequest) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Ionicons name="star" size={40} color={theme.colors.primary} />
                            <Text style={[styles.title, { color: theme.colors.text }]}>
                                Event Feedback
                            </Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                Help us improve future events
                            </Text>
                        </View>

                        {/* Event Info */}
                        <View style={[styles.eventInfo, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                                {feedbackRequest.eventTitle}
                            </Text>
                            <Text style={[styles.clubName, { color: theme.colors.textSecondary }]}>
                                by {feedbackRequest.clubName}
                            </Text>
                        </View>

                        {/* Attendance Confirmation */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Did you attend this event?
                            </Text>
                            <View style={styles.attendanceButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.attendanceButton,
                                        {
                                            backgroundColor:
                                                attended === true
                                                    ? theme.colors.primary
                                                    : theme.colors.surface,
                                            borderColor:
                                                attended === true
                                                    ? theme.colors.primary
                                                    : theme.colors.border,
                                        },
                                    ]}
                                    onPress={() => setAttended(true)}
                                >
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={24}
                                        color={
                                            attended === true ? '#fff' : theme.colors.textSecondary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.attendanceText,
                                            {
                                                color:
                                                    attended === true ? '#fff' : theme.colors.text,
                                            },
                                        ]}
                                    >
                                        Yes, I attended
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.attendanceButton,
                                        {
                                            backgroundColor:
                                                attended === false
                                                    ? theme.colors.error + '20'
                                                    : theme.colors.surface,
                                            borderColor:
                                                attended === false
                                                    ? theme.colors.error
                                                    : theme.colors.border,
                                        },
                                    ]}
                                    onPress={() => setAttended(false)}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={24}
                                        color={
                                            attended === false
                                                ? theme.colors.error
                                                : theme.colors.textSecondary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.attendanceText,
                                            {
                                                color:
                                                    attended === false
                                                        ? theme.colors.error
                                                        : theme.colors.text,
                                            },
                                        ]}
                                    >
                                        No, I didn&apos;t
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Rating Section - Only show if attended */}
                        {attended === true && (
                            <>
                                {/* Event Rating */}
                                <View style={styles.section}>
                                    <Text
                                        style={[styles.sectionTitle, { color: theme.colors.text }]}
                                    >
                                        How was the event?
                                    </Text>
                                    <Rating
                                        type="star"
                                        ratingCount={5}
                                        imageSize={40}
                                        startingValue={eventRating}
                                        onFinishRating={setEventRating}
                                        tintColor={theme.colors.background}
                                        style={styles.rating}
                                    />
                                    <Text
                                        style={[
                                            styles.ratingLabel,
                                            { color: theme.colors.textSecondary },
                                        ]}
                                    >
                                        {eventRating === 0
                                            ? 'Tap to rate'
                                            : eventRating === 1
                                              ? 'Poor'
                                              : eventRating === 2
                                                ? 'Fair'
                                                : eventRating === 3
                                                  ? 'Good'
                                                  : eventRating === 4
                                                    ? 'Very Good'
                                                    : 'Excellent'}
                                    </Text>
                                </View>

                                {/* Club Rating */}
                                <View style={styles.section}>
                                    <Text
                                        style={[styles.sectionTitle, { color: theme.colors.text }]}
                                    >
                                        How was the organizer?
                                    </Text>
                                    <Rating
                                        type="star"
                                        ratingCount={5}
                                        imageSize={40}
                                        startingValue={clubRating}
                                        onFinishRating={setClubRating}
                                        tintColor={theme.colors.background}
                                        style={styles.rating}
                                    />
                                    <Text
                                        style={[
                                            styles.ratingLabel,
                                            { color: theme.colors.textSecondary },
                                        ]}
                                    >
                                        {clubRating === 0
                                            ? 'Tap to rate'
                                            : clubRating === 1
                                              ? 'Poor'
                                              : clubRating === 2
                                                ? 'Fair'
                                                : clubRating === 3
                                                  ? 'Good'
                                                  : clubRating === 4
                                                    ? 'Very Good'
                                                    : 'Excellent'}
                                    </Text>
                                </View>

                                {/* Optional Feedback */}
                                <View style={styles.section}>
                                    <Text
                                        style={[styles.sectionTitle, { color: theme.colors.text }]}
                                    >
                                        Additional Comments (Optional)
                                    </Text>
                                    <TextInput
                                        style={[
                                            styles.textInput,
                                            {
                                                backgroundColor: theme.colors.surface,
                                                color: theme.colors.text,
                                                borderColor: theme.colors.border,
                                            },
                                        ]}
                                        placeholder="Share your experience..."
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={feedback}
                                        onChangeText={setFeedback}
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                    />
                                </View>
                            </>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.cancelButton,
                                    { borderColor: theme.colors.border },
                                ]}
                                onPress={onClose}
                                disabled={loading}
                            >
                                <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                                    Later
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.submitButton,
                                    { backgroundColor: theme.colors.primary },
                                ]}
                                onPress={handleSubmit}
                                disabled={loading || attended === null}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
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
        maxWidth: 500,
        borderRadius: 24,
        padding: 24,
        maxHeight: '90%',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 12,
    },
    subtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    eventInfo: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    clubName: {
        fontSize: 14,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    attendanceButtons: {
        gap: 12,
    },
    attendanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        gap: 12,
    },
    attendanceText: {
        fontSize: 16,
        fontWeight: '600',
    },
    rating: {
        paddingVertical: 16,
    },
    ratingLabel: {
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    textInput: {
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        minHeight: 100,
        borderWidth: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    submitButton: {
        // backgroundColor set dynamically
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

FeedbackModal.propTypes = {
    visible: PropTypes.any,
    onClose: PropTypes.any,
    feedbackRequest: PropTypes.any,
    onSubmit: PropTypes.any,
};
