import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

export default function UniEventLogo({ size = 16, showText = true, style }) {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, style]}>
            {showText && (
                <Text style={[styles.text, { fontSize: size, color: theme.colors.text }]}>
                    Uni<Text style={{ color: theme.colors.primary }}>Event</Text>
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        fontWeight: '800',
        letterSpacing: -0.5,
    },
});
