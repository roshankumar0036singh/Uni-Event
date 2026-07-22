import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    Platform,
} from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { functions } from '../src/lib/firebaseConfig';

export interface ClubSettingsProps {
    navigation?: any;
}

export const ClubSettings: React.FC<ClubSettingsProps> = ({ navigation }) => {
    const [successorEmail, setSuccessorEmail] = useState('');
    const [successorUid, setSuccessorUid] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);

    const auth = getAuth();
    const currentUser = auth.currentUser;

    const executeHandover = async () => {
        const targetEmail = successorEmail.trim();
        const targetUid = successorUid.trim();

        if ((!targetEmail && !targetUid) || (targetEmail && targetUid)) {
            const errorMsg =
                targetEmail && targetUid
                    ? 'Enter either the successor email address or UID, not both.'
                    : 'Please enter the email address or UID of the successor.';
            if (Platform.OS === 'web') {
                setStatusMessage({ type: 'error', text: errorMsg });
            } else {
                Alert.alert('Validation Error', errorMsg);
            }
            return;
        }

        setLoading(true);
        setStatusMessage(null);

        try {
            const handoverFn = httpsCallable(functions, 'handoverClubAdmin');
            const response = (await handoverFn({
                newAdminEmail: targetEmail || undefined,
                newAdminUid: targetUid || undefined,
            })) as { data: { success: boolean; message: string; newAdminUid: string } };

            const successText =
                response.data?.message || 'Club admin rights transferred successfully!';
            setStatusMessage({ type: 'success', text: successText });
            await currentUser?.getIdToken(true);

            if (Platform.OS !== 'web') {
                Alert.alert('Handover Successful', successText, [
                    {
                        text: 'OK',
                        onPress: () => {
                            if (navigation && typeof navigation.goBack === 'function') {
                                navigation?.goBack();
                            }
                        },
                    },
                ]);
            }

            setSuccessorEmail('');
            setSuccessorUid('');
        } catch (error: any) {
            const errorText =
                error?.message || 'Failed to transfer club admin rights. Please try again.';
            setStatusMessage({ type: 'error', text: errorText });

            if (Platform.OS !== 'web') {
                Alert.alert('Handover Failed', errorText);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleHandoverPress = () => {
        const confirmTitle = 'Confirm Club Handover';
        const confirmMessage =
            'Are you sure you want to pass club admin rights? You will lose admin privileges and your role will be set to student.';

        if (Platform.OS === 'web') {
            if (globalThis.confirm?.(`${confirmTitle}\n\n${confirmMessage}`)) {
                executeHandover();
            }
        } else {
            Alert.alert(confirmTitle, confirmMessage, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Transfer Rights', style: 'destructive', onPress: executeHandover },
            ]);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.headerTitle}>Club Settings</Text>

            {/* Current Admin Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Current Account</Text>
                <Text style={styles.cardSubtitle}>
                    Logged in as: {currentUser?.email || currentUser?.displayName || 'Club Admin'}
                </Text>
            </View>

            {/* Club Handover Protocol Card */}
            <View style={[styles.card, styles.handoverCard]}>
                <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>Annual Protocol</Text>
                </View>

                <Text style={styles.cardTitle}>Club Handover Protocol</Text>
                <Text style={styles.cardDescription}>
                    Pass club admin rights to someone else for next year. Transferring rights will
                    grant full club administration privileges to the new leader and set your account
                    role to student.
                </Text>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Successor Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="new.leader@university.edu"
                        placeholderTextColor="#888"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={successorEmail}
                        onChangeText={setSuccessorEmail}
                        accessibilityLabel="Successor Email Address"
                    />
                </View>

                <Text style={styles.orText}>— OR —</Text>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Successor User ID (UID)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. usr_123456789"
                        placeholderTextColor="#888"
                        autoCapitalize="none"
                        value={successorUid}
                        onChangeText={setSuccessorUid}
                        accessibilityLabel="Successor User ID"
                    />
                </View>

                {statusMessage && (
                    <View
                        style={[
                            styles.statusBanner,
                            statusMessage.type === 'success'
                                ? styles.successBanner
                                : styles.errorBanner,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusText,
                                statusMessage.type === 'success'
                                    ? styles.successText
                                    : styles.errorText,
                            ]}
                        >
                            {statusMessage.text}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.handoverButton, loading && styles.disabledButton]}
                    onPress={handleHandoverPress}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Pass Club Admin Rights"
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.handoverButtonText}>Pass Club Admin Rights</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#f8f9fa',
        flexGrow: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 20,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    handoverCard: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    badgeContainer: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e7ff',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 12,
    },
    badgeText: {
        color: '#4338ca',
        fontSize: 12,
        fontWeight: '600',
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    cardDescription: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
        marginBottom: 20,
    },
    formGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    orText: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
        marginVertical: 4,
    },
    statusBanner: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    successBanner: {
        backgroundColor: '#dcfce7',
        borderLeftWidth: 4,
        borderLeftColor: '#16a34a',
    },
    errorBanner: {
        backgroundColor: '#fee2e2',
        borderLeftWidth: 4,
        borderLeftColor: '#dc2626',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
    },
    successText: {
        color: '#15803d',
    },
    errorText: {
        color: '#b91c1c',
    },
    handoverButton: {
        backgroundColor: '#dc2626',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.6,
    },
    handoverButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ClubSettings;
