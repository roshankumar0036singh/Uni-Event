import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { darkTheme, lightTheme } from '../lib/theme';
import UniEventLogo from './UniEventLogo';
import PropTypes from 'prop-types';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

export default function ScreenWrapper({
    children,
    style,
    edges = ['top', 'left', 'right', 'bottom'],
    showLogo = true,
}) {
    const { theme, interpolateThemeColor } = useTheme();

    const backgroundStyle = {
        backgroundColor: interpolateThemeColor(
            lightTheme.colors.background,
            darkTheme.colors.background,
        ),
    };

    return (
        <AnimatedSafeAreaView style={[styles.safeArea, backgroundStyle]} edges={edges}>
            <View style={[styles.container, { paddingHorizontal: theme.spacing.m }, style]}>
                {showLogo && (
                    <View style={styles.logoContainer}>
                        <UniEventLogo size={24} />
                    </View>
                )}
                {children}
            </View>
        </AnimatedSafeAreaView>
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

ScreenWrapper.propTypes = {
    children: PropTypes.any,
    style: PropTypes.any,
    edges: PropTypes.any,
    showLogo: PropTypes.any,
};
