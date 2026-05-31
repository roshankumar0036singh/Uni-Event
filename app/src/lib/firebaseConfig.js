import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
    browserLocalPersistence,
    // eslint-disable-next-line import/named
    getReactNativePersistence,
    initializeAuth,
    connectAuthEmulator,
} from 'firebase/auth';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
    console.error('Firebase Configuration Error: API Key is missing.');
}

const app = initializeApp(firebaseConfig);

if (__DEV__) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
}

// ReCaptchaV3Provider only works on web; for mobile production,
// consider DeviceCheck (iOS) or Play Integrity (Android) providers can be tracked in another issue
const recaptchaSiteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
const appCheckProvider = Platform.OS === 'web' && recaptchaSiteKey
    ? new ReCaptchaV3Provider(recaptchaSiteKey)
    : null;

if (!appCheckProvider && !__DEV__) {
    console.error('App Check: No provider available for this platform in production');
}

try {
    if (appCheckProvider) {
        initializeAppCheck(app, {
            provider: appCheckProvider,
            isTokenAutoRefreshEnabled: true,
        });
    }
} catch (error) {
    console.warn('AppCheck initialization failed:', error);
}

const auth = initializeAuth(app, {
    persistence:
        Platform.OS === 'web'
            ? browserLocalPersistence
            : getReactNativePersistence(ReactNativeAsyncStorage),
});

export { auth };

// 🚀 This turns on local storage database caching for offline use
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
    }),
});

export const functions = getFunctions(app);
export const storage = getStorage(app);
let messagingInstance = null;

export async function getWebMessaging() {
    if (Platform.OS !== 'web') return null;
    if (messagingInstance) return messagingInstance;
    const { getMessaging, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    messagingInstance = getMessaging(app);
    return messagingInstance;
}

if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
    const { LogBox } = require('react-native');
    LogBox.ignoreLogs([/Running in emulator mode/, /emulator/i]);
    const EMULATOR_HOST = Platform.OS === 'android' ? ['10', '0', '2', '2'].join('.') : 'localhost';

    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
}

export const VAPID_KEY = process.env.EXPO_PUBLIC_FCM_VAPID_KEY;
export default app;
