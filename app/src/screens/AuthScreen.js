import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { auth, db } from '../lib/firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

const MIN_PASSWORD_LENGTH = 6;
const ERR_PASSWORD_SHORT = 'Password must be at least 6 characters';

export default function AuthScreen() {
    const { theme } = useTheme();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const { signIn, signUp, saveGoogleAccountCredentials } = useAuth();

    const [request, response, promptAsync] = Google.useAuthRequest({
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        redirectUri:
            Platform.OS === 'web'
                ? window.location.origin || process.env.EXPO_PUBLIC_REDIRECT_URI
                : process.env.EXPO_PUBLIC_REDIRECT_URI || makeRedirectUri({ useProxy: true }),
    });

    useEffect(() => {
        setPasswordError('');
    }, [isLogin]);

    useEffect(() => {
        if (response?.type === 'error') {
            Alert.alert('Auth Error', JSON.stringify(response.error || 'Unknown Error', null, 2));
        } else if (response?.type === 'success') {
            const { id_token } = response.params;
            const { accessToken } = response.authentication || {};

            if (!id_token && !accessToken) {
                Alert.alert('Auth Error', 'No tokens returned from Google');
                return;
            }

            setLoading(true);

            // --- EMULATOR HYBRID FLOW ---
            if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
                // 1. Fetch real Google Profile using the valid Access Token
                fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                })
                    .then(res => res.json())
                    .then(async googleUser => {
                        // 2. "Sign In" to Emulator using this email
                        // We use a dummy password because we trust the Google Token verification step above
                        try {
                            await signIn(googleUser.email, 'google-emulator-pass');
                        } catch (e) {
                            // If user doesn't exist in Emulator, create them
                            if (
                                e.code === 'auth/user-not-found' ||
                                e.code === 'auth/invalid-credential'
                            ) {
                                await signUp(googleUser.email, 'google-emulator-pass', {
                                    displayName: googleUser.name,
                                    photoURL: googleUser.picture,
                                    provider: 'google', // Mark as google provider
                                });
                            } else {
                                throw e;
                            }
                        }
                    })
                    .catch(err => {
                        Alert.alert('Emulator Auth Error', err.message);
                    })
                    .finally(() => setLoading(false));

                return; // Stop here for Emulator
            }

            // --- PRODUCTION FLOW ---
            const credential = GoogleAuthProvider.credential(id_token || null, accessToken || null);
            signInWithCredential(auth, credential)
                .then(async userCredential => {
                    const user = userCredential.user;
                    saveGoogleAccountCredentials(user);

                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (!userDoc.exists()) {
                        await setDoc(userDocRef, {
                            email: user.email,
                            displayName: user.displayName,
                            role: 'student',
                            createdAt: new Date().toISOString(),
                            photoURL: user.photoURL,
                            provider: 'google',
                        });
                    }
                })
                .catch(error => {
                    Alert.alert('Google Sign-In Error', error.message);
                })
                .finally(() => setLoading(false));
        }
    }, [response, saveGoogleAccountCredentials, signIn, signUp]);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (!isLogin && password.length < MIN_PASSWORD_LENGTH) {
            setPasswordError(ERR_PASSWORD_SHORT);
            return;
        }

        setPasswordError('');
        setLoading(true);
        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                await signUp(email, password, { displayName: name });
            }
        } catch (error) {
            if (error.code === 'auth/weak-password') {
                setPasswordError(ERR_PASSWORD_SHORT);
            } else {
                Alert.alert('Error', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <LinearGradient
                    colors={[theme.colors.primary + '20', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconContainer,
                                { backgroundColor: theme.colors.surface },
                            ]}
                        >
                            <Ionicons
                                name={isLogin ? 'log-in' : 'person-add'}
                                size={32}
                                color={theme.colors.primary}
                            />
                        </View>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {isLogin ? 'Welcome Back!' : 'Join Us'}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            {isLogin
                                ? 'Sign in to continue exploring events'
                                : 'Create an account to get started'}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {!isLogin && (
                            <View
                                style={[
                                    styles.inputContainer,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={theme.colors.textSecondary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            color: theme.colors.text,
                                            backgroundColor: 'transparent',
                                        },
                                    ]}
                                    placeholder="Full Name"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>
                        )}

                        <View
                            style={[
                                styles.inputContainer,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: theme.colors.border,
                                },
                            ]}
                        >
                            <Ionicons
                                name="mail-outline"
                                size={20}
                                color={theme.colors.textSecondary}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={[
                                    styles.input,
                                    { color: theme.colors.text, backgroundColor: 'transparent' },
                                ]}
                                placeholder="Email Address"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View
                            style={[
                                styles.inputContainer,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: theme.colors.border,
                                },
                            ]}
                        >
                            <Ionicons
                                name="lock-closed-outline"
                                size={20}
                                color={theme.colors.textSecondary}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={[
                                    styles.input,
                                    { color: theme.colors.text, backgroundColor: 'transparent' },
                                ]}
                                placeholder="Password"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={password}
                                onChangeText={text => {
                                    setPassword(text);
                                    if (passwordError) setPasswordError('');
                                }}
                                secureTextEntry
                            />
                        </View>
                        {!isLogin && passwordError ? (
                            <Text style={styles.errorText}>{passwordError}</Text>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.authButton, { backgroundColor: theme.colors.primary }]}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.authButtonText}>
                                    {isLogin ? 'Sign In' : 'Sign Up'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dividerContainer}>
                        <View
                            style={[styles.dividerLine, { backgroundColor: theme.colors.border }]}
                        />
                        <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>
                            OR
                        </Text>
                        <View
                            style={[styles.dividerLine, { backgroundColor: theme.colors.border }]}
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.googleButton,
                            {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border,
                            },
                        ]}
                        onPress={() => promptAsync()}
                        disabled={!request || loading}
                    >
                        <Ionicons name="logo-google" size={20} color={theme.colors.text} />
                        <Text style={[styles.googleButtonText, { color: theme.colors.text }]}>
                            Continue with Google
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                            {isLogin ? "Don't have an account?" : 'Already have an account?'}
                        </Text>
                        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                            <Text style={[styles.footerLink, { color: theme.colors.primary }]}>
                                {isLogin ? ' Sign Up' : ' Login'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 30,
        zIndex: 1,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        elevation: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 15,
        paddingVertical: 16,
        minHeight: 56,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 0,
        outlineStyle: 'none',
        backgroundColor: 'transparent',
    },
    authButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        elevation: 4,
    },
    authButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 30,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 16,
        fontWeight: '600',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    footerText: {
        fontSize: 14,
    },
    footerLink: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: -8,
        marginLeft: 4,
    },
});
