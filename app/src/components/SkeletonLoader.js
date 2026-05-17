import { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

const SkeletonItem = ({ style }) => {
    const { theme } = useTheme();
    const opacity = new Animated.Value(0.3);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity,
                    backgroundColor: theme.colors.border,
                },
            ]}
        />
    );
};

export const EventListSkeleton = () => {
    return (
        <View style={styles.container}>
            {[1, 2, 3].map(key => (
                <View key={key} style={styles.card}>
                    <SkeletonItem style={styles.image} />
                    <View style={styles.content}>
                        <SkeletonItem style={styles.title} />
                        <SkeletonItem style={styles.subtitle} />
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    card: {
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 180,
        borderRadius: 12,
        marginBottom: 10,
    },
    content: {
        paddingHorizontal: 8,
    },
    title: {
        width: '80%',
        height: 20,
        borderRadius: 4,
        marginBottom: 8,
    },
    subtitle: {
        width: '50%',
        height: 14,
        borderRadius: 4,
    },
});
