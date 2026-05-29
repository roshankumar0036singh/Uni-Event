import logger from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Platform, Alert } from 'react-native';
import { auth, db } from './firebaseConfig';
import PropTypes from 'prop-types';
import { getUserLevel, getUserLevelProgress } from './userLevels';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null); // New state for Firestore data
    const [role, setRole] = useState('student');
    const [loading, setLoading] = useState(true);
    const [savedAccounts, setSavedAccounts] = useState([]);

    // Helper to interact with storage abstractly
    const getItemAsync = useCallback(async key => {
        if (Platform.OS === 'web') {
            const value = await AsyncStorage.getItem(key);
            return value;
        } else {
            return await SecureStore.getItemAsync(key);
        }
    }, []);

    const setItemAsync = async (key, value) => {
        if (Platform.OS === 'web') {
            return await AsyncStorage.setItem(key, value);
        } else {
            return await SecureStore.setItemAsync(key, value);
        }
    };

    const loadSavedAccounts = useCallback(async () => {
        try {
            const json = await getItemAsync('saved_accounts');
            if (json) {
                setSavedAccounts(JSON.parse(json));
            }
        } catch (e) {
            logger.debug('Failed to load saved accounts', e);
        }
    }, [getItemAsync]);

    useEffect(() => {
        if ('window' in globalThis && globalThis.Cypress) {
            globalThis.setMockUser = (mockUser, mockRole = 'student', mockData = {}) => {
                setUser(mockUser);
                setRole(mockRole);
                setUserData(mockData);
                setLoading(false);
            };
            setLoading(false);
        }

        loadSavedAccounts(); // Load accounts on mount
        const unsubscribe = onAuthStateChanged(auth, async currentUser => {
            setLoading(true);
            if (currentUser) {
                let userRole = 'student';
                let dbData = {};

                // 1. Check Custom Claims (Preferred)
                const tokenResult = await currentUser
                    .getIdTokenResult()
                    .catch(() => ({ claims: {} }));
                if (tokenResult.claims.admin) userRole = 'admin';
                else if (tokenResult.claims.club) userRole = 'club';

                // 2. Fallback: Check Firestore Document
                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        dbData = userDoc.data();
                        if (dbData.role === 'admin' || dbData.role === 'club') {
                            userRole = dbData.role;
                        }
                    }
                } catch (e) {
                    logger.debug('Error fetching user role from db', e);
                }

                setRole(userRole);
                setUser(currentUser);
                setUserData(dbData); // Store profile data separately
            } else {
                setUser(null);
                setUserData(null);
                setRole('student');
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            if (globalThis.setMockUser) {
                delete globalThis.setMockUser;
            }
        };
    }, [loadSavedAccounts]);

    // Unified DRY saving logic that safely stores password on Mobile (SecureStore)
    // and omits it on Web (AsyncStorage) to mitigate plaintext password leaks
    const saveAccount = useCallback(
        async (user, provider, password = null) => {
            try {
                // Get existing accounts
                let currentAccounts = [];
                const json = await getItemAsync('saved_accounts');
                if (json) currentAccounts = JSON.parse(json);

                // Update or Add
                const existingIndex = currentAccounts.findIndex(a => a.email === user.email);
                const newAccount = {
                    email: user.email,
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL,
                    uid: user.uid,
                    provider: provider,
                    // Save password only on native systems (with secure hardware storage)
                    password: Platform.OS !== 'web' ? password : null,
                    lastSignedInAt: new Date().toISOString(),
                };

                if (existingIndex >= 0) {
                    currentAccounts[existingIndex] = newAccount;
                } else {
                    currentAccounts.push(newAccount);
                }

                await setItemAsync('saved_accounts', JSON.stringify(currentAccounts));
                setSavedAccounts(currentAccounts);
            } catch (e) {
                logger.debug(`Failed to save account credentials for ${provider}`, e);
            }
        },
        [getItemAsync],
    );

    const switchAccount = useCallback(
        async targetEmail => {
            // Use a separate flag for switching to prevent "flash" of Auth screen
            // We will handle this in the UI by keeping the current screen or showing a loader
            setLoading(true);

            try {
                const account = savedAccounts.find(a => a.email === targetEmail);
                if (!account) throw new Error('Account not found');

                await firebaseSignOut(auth);

                if (account.provider === 'google' || !account.password) {
                    // Cannot auto-login Google accounts without prompting.
                    // For MVP, we just sign out and let them click "Continue with Google" again on AuthScreen.
                    // Ideally, we'd trigger the prompt here, but we need the hook.
                    // Pass a param? No.
                    // Just return, user is now signed out.
                    // App will go to AuthScreen.
                    return;
                }

                await signInWithEmailAndPassword(auth, account.email, account.password);
                // Don't need to manually set user, onAuthStateChanged in useEffect will handle it
            } catch (e) {
                logger.error('Switch failed', e);
                Alert.alert(
                    'Authentication Failed',
                    'Could not switch accounts automatically. Please enter your credentials manually.',
                );
            } finally {
                setLoading(false);
            }
        },
        [savedAccounts],
    );

    const removeSavedAccount = useCallback(
        async targetEmail => {
            const newAccounts = savedAccounts.filter(a => a.email !== targetEmail);
            await setItemAsync('saved_accounts', JSON.stringify(newAccounts));
            setSavedAccounts(newAccounts);
        },
        [savedAccounts],
    );

    // --- Auth Actions ---

    const signIn = useCallback(
        async (email, password) => {
            const result = await signInWithEmailAndPassword(auth, email, password);
            await saveAccount(result.user, 'password', password); // Auto-save with password
            return result;
        },
        [saveAccount],
    );

    const signUp = useCallback(
        async (email, password, additionalData = {}) => {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const { user } = result;

            // Create user document
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                role: 'student', // Default role
                createdAt: new Date().toISOString(),
                ...additionalData,
            });

            await saveAccount(user, 'password', password); // Auto-save with password
            return result;
        },
        [saveAccount],
    );

    const signOut = useCallback(() => {
        return firebaseSignOut(auth);
    }, []);

    const value = useMemo(() => {
        const points = userData?.points ?? 0;
        const userLevel = getUserLevel(points);
        const levelProgress = getUserLevelProgress(points);

        return {
            user,
            userData,
            role,
            userLevel,
            levelProgress,
            loading,
            signIn,
            signUp,
            signOut,
            savedAccounts,
            switchAccount,
            removeSavedAccount,
            saveGoogleAccountCredentials: u => saveAccount(u, 'google'),
        };
    }, [
        user,
        userData,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        savedAccounts,
        switchAccount,
        removeSavedAccount,
        saveAccount,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
    children: PropTypes.any,
};
