import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
    browserLocalPersistence,
    getReactNativePersistence,
    initializeAuth,
    connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
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

// Validate Config
if (!firebaseConfig.apiKey) {
    console.error('Firebase Configuration Error: API Key is missing.');
    console.error('Please ensure you have a .env file with EXPO_PUBLIC_FIREBASE_API_KEY defined.');
}

// Initialize App
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
let auth;
if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
    });
} else {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
}

export { auth };

import { getMessaging } from 'firebase/messaging';

// Initialize other services
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Connect to Emulators if configured
if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
    const { LogBox } = require('react-native');
    LogBox.ignoreLogs([/Running in emulator mode/, /emulator/i]);

    console.log('Using Firebase Emulators...');
    const EMULATOR_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
}

export const VAPID_KEY = process.env.EXPO_PUBLIC_FCM_VAPID_KEY;

export default app;
