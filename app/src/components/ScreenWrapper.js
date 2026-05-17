import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import UniEventLogo from './UniEventLogo';

export default function ScreenWrapper({
    children,
    style,
    edges = ['top', 'left', 'right', 'bottom'],
    showLogo = true,
}) {
    const { theme, themeAnim } = useTheme();

    const animatedBg = themeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#F8F9FA', '#121212'],
    });

    return (
        <SafeAreaView style={styles.safeArea} edges={edges}>
            <Animated.View
                style={[
                    styles.container,
                    { paddingHorizontal: theme.spacing.m },
                    style,
                    { backgroundColor: animatedBg },
                ]}
            >
                {showLogo && (
                    <View style={styles.logoContainer}>
                        <UniEventLogo size={24} />
                    </View>
                )}
                {children}
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    logoContainer: {
        paddingVertical: 10,
        alignItems: 'flex-start',
        marginBottom: 5,
    },
});