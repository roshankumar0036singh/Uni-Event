import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SHIMMER_DURATION = 1200;

export function ShimmerItem({ style }) {
    const { theme, isDarkMode } = useTheme();
    const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(translateX, {
                toValue: SCREEN_WIDTH,
                duration: SHIMMER_DURATION,
                useNativeDriver: true,
            }),
        );
        animation.start();
        return () => animation.stop();
    }, [translateX]);

    const baseColor = isDarkMode
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(0,0,0,0.06)';
    const shimmerColor = isDarkMode
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(255,255,255,0.7)';

    return (
        <View
            style={[style, { backgroundColor: baseColor, overflow: 'hidden' }]}
        >
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateX }] },
                ]}
            >
                <LinearGradient
                    colors={[
                        'transparent',
                        shimmerColor,
                        'transparent',
                    ]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
}

export function EventCardSkeleton() {
    return (
        <View style={styles.card}>
            {/* Banner */}
            <ShimmerItem style={styles.banner} />
            <View style={styles.content}>
                {/* Flyer thumbnail */}
                <ShimmerItem style={styles.flyer} />
                {/* Title lines */}
                <View style={styles.textBlock}>
                    <ShimmerItem style={styles.titleLine} />
                    <ShimmerItem style={styles.subtitleLine} />
                    <ShimmerItem style={styles.subtitleLineShort} />
                </View>
            </View>
            {/* Button */}
            <ShimmerItem style={styles.button} />
        </View>
    );
}

export function EventListSkeleton() {
    return (
        <View style={styles.container}>
            {[1, 2, 3].map(key => (
                <EventCardSkeleton key={key} />
            ))}
        </View>
    );
}

export function FeaturedCarouselSkeleton() {
    return (
        <View style={styles.carouselContainer}>
            <ShimmerItem style={styles.carouselTitleLine} />
            <View style={styles.carouselRow}>
                {[1, 2].map(key => (
                    <ShimmerItem key={key} style={styles.carouselCard} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    card: {
        marginBottom: 24,
        borderRadius: 16,
        overflow: 'hidden',
        paddingHorizontal: 0,
    },
    banner: {
        width: '100%',
        height: 180,
        borderRadius: 16,
    },
    content: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: -40,
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    flyer: {
        width: 100,
        height: 100,
        borderRadius: 20,
    },
    textBlock: {
        flex: 1,
        marginLeft: 12,
        marginTop: 50,
        gap: 8,
    },
    titleLine: {
        width: '85%',
        height: 20,
        borderRadius: 4,
    },
    subtitleLine: {
        width: '65%',
        height: 14,
        borderRadius: 4,
    },
    subtitleLineShort: {
        width: '45%',
        height: 14,
        borderRadius: 4,
    },
    button: {
        marginHorizontal: 16,
        height: 48,
        borderRadius: 16,
        marginBottom: 4,
    },
    carouselContainer: {
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    carouselTitleLine: {
        width: 140,
        height: 20,
        borderRadius: 4,
        marginBottom: 12,
    },
    carouselRow: {
        flexDirection: 'row',
        gap: 15,
    },
    carouselCard: {
        width: SCREEN_WIDTH * 0.6,
        height: (SCREEN_WIDTH * 0.6) / 1.8,
        borderRadius: 12,
    },
});