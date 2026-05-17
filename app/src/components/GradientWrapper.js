import { StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

// Simplified Wrapper - No Gradient
export default function GradientWrapper({ children, style }) {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
});
