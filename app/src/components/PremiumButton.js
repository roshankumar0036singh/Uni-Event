import { LinearGradient } from 'expo-linear-gradient';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

export default function PremiumButton({
    onPress,
    title,
    variant = 'primary', // primary, secondary, outline, ghost
    disabled = false,
    loading = false,
    icon,
    style,
}) {
    const { theme } = useTheme();

    const getColors = () => {
        if (disabled) return { bg: ['#e0e0e0', '#bdbdbd'], text: '#9e9e9e', border: 'transparent' };
        switch (variant) {
            case 'primary':
                return {
                    bg: theme.colors.primaryGradient || [
                        theme.colors.primary || '#6200ee',
                        theme.colors.secondary || '#03dac6',
                    ],
                    text: '#fff',
                    border: 'transparent',
                };
            case 'secondary':
                return {
                    bg: [theme.colors.secondary || '#03dac6', theme.colors.secondary || '#018786'],
                    text: '#000',
                    border: 'transparent',
                };
            case 'outline':
                return {
                    bg: ['transparent', 'transparent'],
                    text: theme.colors.primary || '#6200ee',
                    border: theme.colors.primary || '#6200ee',
                };
            case 'ghost':
                return {
                    bg: ['transparent', 'transparent'],
                    text: theme.colors.textSecondary || '#757575',
                    border: 'transparent',
                };
            default:
                return {
                    bg: theme.colors.primaryGradient || [
                        theme.colors.primary || '#6200ee',
                        theme.colors.secondary || '#03dac6',
                    ],
                    text: '#fff',
                    border: 'transparent',
                };
        }
    };

    const colors = getColors();

    const Container = variant === 'outline' || variant === 'ghost' ? View : LinearGradient;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={[styles.touchable, style]}
        >
            <Container
                colors={colors.bg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    styles.container,
                    variant === 'outline' && { borderWidth: 1.5, borderColor: colors.border },
                    loading && { opacity: 0.8 },
                ]}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={colors.text} />
                ) : (
                    <View style={styles.content}>
                        {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
                        <Text style={[styles.text, { color: colors.text }]}>{title}</Text>
                    </View>
                )}
            </Container>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touchable: {
        borderRadius: 14, // Modern rounded corners
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
            },
            android: { elevation: 4 },
        }),
    },
    container: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
});

PremiumButton.propTypes = {
    onPress: PropTypes.any,
    title: PropTypes.string,
    variant: PropTypes.any,
    disabled: PropTypes.bool,
    loading: PropTypes.bool,
    icon: PropTypes.any,
    style: PropTypes.any,
};
