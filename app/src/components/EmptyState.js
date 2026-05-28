import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import PropTypes from 'prop-types';
import { useTheme } from '../lib/ThemeContext';

export default function EmptyState({ message, subMessage, children, isSmall = false }) {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            <View
                style={{
                    width: isSmall ? 120 : 200,
                    height: isSmall ? 120 : 200,
                    overflow: 'hidden',
                }}
            >
                <LottieView
                    source={require('../../assets/empty-state-animation.json')}
                    autoPlay
                    loop
                    style={{
                        width: isSmall ? 120 : 200,
                        height: isSmall ? 120 : 200,
                    }}
                    resizeMode="cover"
                />
            </View>
            {message && (
                <Text style={[styles.message, { color: theme.colors.text }]}>{message}</Text>
            )}
            {subMessage && (
                <Text style={[styles.subMessage, { color: theme.colors.textSecondary }]}>
                    {subMessage}
                </Text>
            )}
            {children}
        </View>
    );
}

EmptyState.propTypes = {
    message: PropTypes.string,
    subMessage: PropTypes.string,
    children: PropTypes.node,
    isSmall: PropTypes.bool,
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        marginTop: 40,
    },
    animation: {
        width: 200,
        height: 200,
    },
    animationSmall: {
        width: 120,
        height: 120,
    },
    message: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
    },
    subMessage: {
        fontSize: 14,
        marginTop: 5,
        textAlign: 'center',
    },
});
