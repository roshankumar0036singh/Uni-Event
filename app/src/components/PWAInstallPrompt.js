import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

export default function PWAInstallPrompt() {
    const { theme } = useTheme();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handler = e => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }

        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
            ]}
        >
            <View style={styles.content}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="download" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Install App</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Add to Home Screen for better experience
                    </Text>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => setIsVisible(false)} style={styles.btnSecondary}>
                    <Text style={{ color: theme.colors.textSecondary }}>Not Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleInstall}
                    style={[styles.btnPrimary, { backgroundColor: theme.colors.primary }]}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Install</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        maxWidth: 500, // Don't stretch too wide on desktop
        alignSelf: 'center', // Center on desktop
        zIndex: 1000,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 15,
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 15,
        alignItems: 'center',
    },
    btnPrimary: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    btnSecondary: {
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
});
