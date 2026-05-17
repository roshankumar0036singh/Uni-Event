import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebaseConfig';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';

const showAlert = (title, message, onOk) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
        if (onOk) onOk();
    } else {
        Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
};

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
];

const MIME_TO_EXTENSION = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
};

const validateScreenshotAsset = asset => {
    if (!asset?.uri) {
        return { ok: false, message: 'No image was selected.' };
    }

    const mime = asset.mimeType?.toLowerCase();
    if (mime && !ALLOWED_MIME_TYPES.includes(mime)) {
        return {
            ok: false,
            message: 'Unsupported file type. Please choose a JPG, PNG, WEBP, or HEIC image.',
        };
    }

    if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_SCREENSHOT_BYTES) {
        const sizeMB = (asset.fileSize / (1024 * 1024)).toFixed(1);
        return {
            ok: false,
            message: `Screenshot is too large (${sizeMB} MB). Maximum allowed size is 5 MB.`,
        };
    }

    return { ok: true };
};

const CATEGORIES = ['Bug', 'Feature Request', 'UI/UX', 'Other'];

export default function ReportBugScreen({ navigation }) {
    const { user, role } = useAuth();
    const { theme } = useTheme();

    const [category, setCategory] = useState('Bug');
    const [description, setDescription] = useState('');
    const [screenshotUri, setScreenshotUri] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const pickScreenshot = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            showAlert(
                'Permission needed',
                'Please allow photo library access to attach a screenshot.',
            );
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, // lets user crop/annotate basic
            quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            const asset = result.assets[0];
            const check = validateScreenshotAsset(asset);
            if (!check.ok) {
                showAlert('Invalid screenshot', check.message);
                return;
            }
            setScreenshotUri(asset.uri);
        }
    };

    const collectTelemetry = () => ({
        appVersion:
            Application.nativeApplicationVersion || Constants.expoConfig?.version || 'unknown',
        buildVersion: Application.nativeBuildVersion || 'unknown',
        os: Platform.OS,
        osVersion: Device.osVersion || 'unknown',
        deviceModel: Device.modelName || 'unknown',
        deviceBrand: Device.brand || 'unknown',
        isPhysicalDevice: Device.isDevice ?? null,
    });

    const uploadScreenshot = async uid => {
        if (!screenshotUri) return { url: null, path: null };
        const response = await fetch(screenshotUri);
        const blob = await response.blob();

        if (blob.size > MAX_SCREENSHOT_BYTES) {
            const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
            throw new ValidationError(
                `Screenshot is too large (${sizeMB} MB). Maximum allowed size is 5 MB.`,
            );
        }

        const contentType = blob.type?.toLowerCase() || 'image/jpeg';
        if (blob.type && !ALLOWED_MIME_TYPES.includes(contentType)) {
            throw new ValidationError(
                'Unsupported file type. Please choose a JPG, PNG, WEBP, or HEIC image.',
            );
        }

        const extension = MIME_TO_EXTENSION[contentType] || 'jpg';
        const path = `feedback/${uid}/${Date.now()}.${extension}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, blob, { contentType });
        const url = await getDownloadURL(sRef);
        return { url, path };
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            showAlert('Description required', 'Please describe the issue.');
            return;
        }
        if (!user) {
            showAlert('Not signed in', 'You must be signed in to submit feedback.');
            return;
        }
        setSubmitting(true);
        let uploadedPath = null;
        try {
            const { url: screenshotUrl, path: screenshotPath } = await uploadScreenshot(user.uid);
            uploadedPath = screenshotPath;

            await addDoc(collection(db, 'feedback'), {
                userId: user.uid,
                userEmail: user.email || null,
                userRole: role || 'student',
                category,
                description: description.trim(),
                screenshotUrl,
                telemetry: collectTelemetry(),
                status: 'open',
                createdAt: serverTimestamp(),
            });

            uploadedPath = null;

            showAlert('Thank you!', 'Your feedback has been submitted.', () => navigation.goBack());
        } catch (e) {
            console.error('Feedback submit failed', e);

            if (uploadedPath) {
                try {
                    await deleteObject(storageRef(storage, uploadedPath));
                } catch (cleanupError) {
                    console.error('Failed to clean up orphaned screenshot', cleanupError);
                }
            }

            const safeMessage =
                e instanceof ValidationError
                    ? e.message
                    : 'Something went wrong. Please try again.';
            showAlert('Submission failed', safeMessage);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.m }}>
                <Text
                    style={[
                        theme.typography.h2,
                        { color: theme.colors.text, marginBottom: theme.spacing.m },
                    ]}
                >
                    Report a Bug
                </Text>

                <Text
                    style={[
                        theme.typography.body,
                        { color: theme.colors.textSecondary, marginBottom: 6 },
                    ]}
                >
                    Category
                </Text>
                <View style={styles.chipRow}>
                    {CATEGORIES.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setCategory(c)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor:
                                        category === c
                                            ? theme.colors.primary
                                            : theme.colors.surface,
                                    borderColor: theme.colors.primary,
                                },
                            ]}
                        >
                            <Text
                                style={{
                                    color: category === c ? '#000' : theme.colors.text,
                                    fontWeight: '600',
                                }}
                            >
                                {c}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text
                    style={[
                        theme.typography.body,
                        {
                            color: theme.colors.textSecondary,
                            marginTop: theme.spacing.m,
                            marginBottom: 6,
                        },
                    ]}
                >
                    Describe the issue
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: theme.colors.surface,
                            color: theme.colors.text,
                            borderColor: theme.colors.border || '#444',
                        },
                    ]}
                    placeholder="What happened? Steps to reproduce..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                />

                <TouchableOpacity
                    onPress={pickScreenshot}
                    style={[styles.attachBtn, { borderColor: theme.colors.primary }]}
                >
                    <Ionicons
                        name="image-outline"
                        size={20}
                        color={theme.colors.primary}
                        style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                        {screenshotUri ? 'Change Screenshot' : 'Attach Screenshot'}
                    </Text>
                </TouchableOpacity>

                {screenshotUri && (
                    <Image
                        source={{ uri: screenshotUri }}
                        style={styles.preview}
                        resizeMode="contain"
                    />
                )}

                <TouchableOpacity
                    disabled={submitting}
                    onPress={handleSubmit}
                    style={[
                        styles.submitBtn,
                        { backgroundColor: theme.colors.primary, opacity: submitting ? 0.6 : 1 },
                    ]}
                >
                    {submitting ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={theme.typography.button}>Submit Feedback</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    attachBtn: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    preview: { width: '100%', height: 220, marginTop: 12, borderRadius: 8 },
    submitBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
});
