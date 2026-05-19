import { StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

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

GradientWrapper.propTypes = {
    children: PropTypes.any,
    style: PropTypes.any,
};
