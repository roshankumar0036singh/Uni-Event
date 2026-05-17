import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import UniEventLogo from './UniEventLogo';

export default function ScreenWrapper({
    children,
    style,
    edges = ['top', 'left', 'right', 'bottom'],
    showLogo = true,
}) {
    const { theme } = useTheme();

    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
            edges={edges}
        >
            <View style={[styles.container, { paddingHorizontal: theme.spacing.m }, style]}>
                {showLogo && (
                    <View style={styles.logoContainer}>
                        <UniEventLogo size={24} />
                    </View>
                )}
                {children}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    logoContainer: {
        paddingVertical: 10,
        alignItems: 'flex-start',
        marginBottom: 5,
    },
});
