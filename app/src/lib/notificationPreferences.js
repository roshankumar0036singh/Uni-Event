import { doc, getDoc, setDoc } from 'firebase/firestore';

export const DEFAULT_NOTIFICATION_PREFERENCES = {
    eventReminders: true,
    rsvpConfirmations: true,
    leaderboardUpdates: true,
    newEventsNearby: true,
    attendanceSummary: true,
};

export const NOTIFICATION_PREFERENCE_LABELS = {
    eventReminders: {
        label: 'Event Reminders',
        description: 'A reminder 10 minutes before events you are attending',
    },
    rsvpConfirmations: {
        label: 'RSVP Confirmations',
        description: 'A confirmation when your registration succeeds',
    },
    leaderboardUpdates: {
        label: 'Leaderboard Updates',
        description: 'Alerts when your leaderboard rank changes',
    },
    newEventsNearby: {
        label: 'New Events Near You',
        description: 'Alerts when a new event is created',
    },
    attendanceSummary: {
        label: 'Attendance Summary',
        description: 'Post-event confirmation of your check-in',
    },
};

const PREFS_DOC_ID = 'prefs';

export async function getNotificationPreferences(db, uid) {
    if (!uid) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    try {
        const snap = await getDoc(doc(db, 'users', uid, 'notificationPreferences', PREFS_DOC_ID));
        return snap.exists()
            ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...snap.data() }
            : { ...DEFAULT_NOTIFICATION_PREFERENCES };
    } catch (error) {
        console.warn('Failed to read notification preferences:', error);
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
}

export async function setNotificationPreference(db, uid, key, value) {
    if (!uid || !(key in DEFAULT_NOTIFICATION_PREFERENCES)) {
        return;
    }
    await setDoc(
        doc(db, 'users', uid, 'notificationPreferences', PREFS_DOC_ID),
        { [key]: value },
        { merge: true },
    );
}

export async function setNotificationPreferences(db, uid, preferences) {
    if (!uid) {
        return;
    }
    const sanitized = Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).reduce((acc, key) => {
        if (key in preferences) {
            acc[key] = preferences[key];
        }
        return acc;
    }, {});
    if (Object.keys(sanitized).length === 0) {
        return;
    }
    await setDoc(doc(db, 'users', uid, 'notificationPreferences', PREFS_DOC_ID), sanitized, {
        merge: true,
    });
}
