import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_PREFERENCE_LABELS,
    getNotificationPreferences,
    setNotificationPreference,
    setNotificationPreferences,
} from '../lib/notificationPreferences';

export default function NotificationPreferencesScreen() {
    const { theme } = useTheme();
    const { user } = useAuth();
    const uid = user?.uid;
    const styles = useMemo(() => getStyles(theme), [theme]);

    const [preferences, setPreferences] = useState({ ...DEFAULT_NOTIFICATION_PREFERENCES });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function load() {
            const prefs = await getNotificationPreferences(db, uid);
            if (mounted) {
                setPreferences(prefs);
                setLoading(false);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, [uid]);

    const togglePreference = async key => {
        const next = { ...preferences, [key]: !preferences[key] };
        setPreferences(next);
        try {
            await setNotificationPreference(db, uid, key, next[key]);
        } catch (error) {
            console.warn(`Failed to save preference "${key}":`, error);
            setPreferences(previous => ({ ...previous, [key]: !previous[key] }));
        }
    };

    const toggleAll = async () => {
        const enabled = !preferences.allEnabled;
        const next = { ...preferences, allEnabled: enabled };
        for (const key of Object.keys(NOTIFICATION_PREFERENCE_LABELS)) {
            next[key] = enabled;
        }
        setPreferences(next);
        try {
            await setNotificationPreferences(db, uid, next);
        } catch (error) {
            console.warn('Failed to save preferences:', error);
            await load();
        }
    };

    async function load() {
        const prefs = await getNotificationPreferences(db, uid);
        setPreferences(prefs);
    }

    const enabledCount = Object.keys(NOTIFICATION_PREFERENCE_LABELS).filter(
        key => preferences[key],
    ).length;

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.header}>Notification Preferences</Text>
                <Text style={styles.subHeader}>
                    Choose which notifications you receive. Changes apply immediately.
                </Text>

                {/* Master Toggle */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.label}>All Notifications</Text>
                            <Text style={styles.subLabel}>
                                Master switch for every category below
                            </Text>
                        </View>
                        <Switch
                            value={preferences.allEnabled}
                            onValueChange={toggleAll}
                            disabled={loading}
                            trackColor={{ false: '#767577', true: theme.colors.primary }}
                            thumbColor={preferences.allEnabled ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Per-category Toggles */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    {Object.entries(NOTIFICATION_PREFERENCE_LABELS).map(
                        ([key, { label, description }], index) => (
                            <View
                                key={key}
                                style={[
                                    styles.row,
                                    index > 0 && {
                                        borderTopWidth: 1,
                                        borderTopColor: theme.colors.border,
                                    },
                                ]}
                            >
                                <View style={styles.rowText}>
                                    <Text style={styles.label}>{label}</Text>
                                    <Text style={styles.subLabel}>{description}</Text>
                                </View>
                                <Switch
                                    value={preferences[key]}
                                    onValueChange={() => togglePreference(key)}
                                    disabled={loading}
                                    trackColor={{ false: '#767577', true: theme.colors.primary }}
                                    thumbColor={preferences[key] ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        ),
                    )}
                </View>

                {/* Status */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <Text style={styles.label}>
                        {loading
                            ? 'Loading preferences…'
                            : enabledCount === 0
                              ? 'All notifications are disabled.'
                              : `${enabledCount} of ${Object.keys(NOTIFICATION_PREFERENCE_LABELS).length} notification categories enabled.`}
                    </Text>
                    <Text style={styles.subLabel}>
                        System permission on your device can still override these settings. You can
                        manage it from your device settings.
                    </Text>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const getStyles = theme =>
    StyleSheet.create({
        container: { padding: 20 },
        header: { fontSize: 28, fontWeight: 'bold', color: theme.colors.text, marginBottom: 6 },
        subHeader: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20 },
        section: {
            borderRadius: 12,
            paddingHorizontal: 18,
            paddingVertical: 8,
            marginBottom: 16,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
        },
        rowText: { flex: 1, paddingRight: 16 },
        label: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
        subLabel: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
    });
