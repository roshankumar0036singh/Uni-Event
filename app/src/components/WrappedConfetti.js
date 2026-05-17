import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

const { width } = Dimensions.get('window');

const CONFETTI_COLORS = [
    '#FFB74D',
    '#FF6B6B',
    '#7B61FF',
    '#00C9A7',
    '#FFD600',
    '#2979FF',
    '#FF4081',
    '#00E5FF',
    '#FF9800',
    '#4CAF50',
    '#E91E63',
    '#9C27B0',
];

export default function WrappedConfetti({ visible, onComplete }) {
    const { theme } = useTheme();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const checkmarkScale = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(100)).current;

    const ripple1 = useRef(new Animated.Value(0)).current;
    const ripple2 = useRef(new Animated.Value(0)).current;
    const ripple3 = useRef(new Animated.Value(0)).current;

    const rippleLoopsRef = useRef([]);
    const timeoutIdsRef = useRef([]);

    const particles = useRef(
        CONFETTI_COLORS.map(() => ({
            x: new Animated.Value(0),
            y: new Animated.Value(0),
            opacity: new Animated.Value(0),
            scale: new Animated.Value(0),
            rotate: new Animated.Value(0),
        })),
    ).current;

    useEffect(() => {
        if (!visible) return;

        // Reset all
        fadeAnim.setValue(0);
        scaleAnim.setValue(0);
        checkmarkScale.setValue(0);
        cardSlide.setValue(100);
        ripple1.setValue(0);
        ripple2.setValue(0);
        ripple3.setValue(0);
        particles.forEach(p => {
            p.x.setValue(0);
            p.y.setValue(0);
            p.opacity.setValue(0);
            p.scale.setValue(0);
            p.rotate.setValue(0);
        });

        // 1. Fade in overlay
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();

        // 2. Main circle pop
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();

        // 3. Ripples
        const rippleAnim = (anim, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]),
            );

        const loop1 = rippleAnim(ripple1, 0);
        const loop2 = rippleAnim(ripple2, 400);
        const loop3 = rippleAnim(ripple3, 800);
        rippleLoopsRef.current = [loop1, loop2, loop3];
        rippleLoopsRef.current.forEach(loop => loop.start());

        // 4. Confetti burst
        const burstTimeout = setTimeout(() => {
            const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
            particles.forEach((p, i) => {
                const angle = (angles[i] * Math.PI) / 180;
                const distance = 130 + Math.random() * 80;
                Animated.parallel([
                    Animated.timing(p.opacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.spring(p.scale, {
                        toValue: 1,
                        friction: 4,
                        useNativeDriver: true,
                    }),
                    Animated.timing(p.x, {
                        toValue: Math.cos(angle) * distance,
                        duration: 700,
                        easing: Easing.out(Easing.back(1.2)),
                        useNativeDriver: true,
                    }),
                    Animated.timing(p.y, {
                        toValue: Math.sin(angle) * distance,
                        duration: 700,
                        easing: Easing.out(Easing.back(1.2)),
                        useNativeDriver: true,
                    }),
                    Animated.timing(p.rotate, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ]).start(() => {
                    Animated.timing(p.opacity, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }).start();
                });
            });
        }, 300);
        timeoutIdsRef.current.push(burstTimeout);

        // 5a. Star appears fast
        const starTimeout = setTimeout(() => {
            Animated.spring(checkmarkScale, {
                toValue: 1,
                friction: 5,
                tension: 50,
                useNativeDriver: true,
            }).start();
        }, 200);
        timeoutIdsRef.current.push(starTimeout);

        // 5b. Card slides up after confetti
        const cardTimeout = setTimeout(() => {
            Animated.spring(cardSlide, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        }, 1500);
        timeoutIdsRef.current.push(cardTimeout);

        // 6. No auto dismiss — user clicks button

        return () => {
            rippleLoopsRef.current.forEach(loop => loop.stop());
            rippleLoopsRef.current = [];
            timeoutIdsRef.current.forEach(id => clearTimeout(id));
            timeoutIdsRef.current = [];
        };
    }, [
        visible,
        cardSlide,
        checkmarkScale,
        fadeAnim,
        particles,
        ripple1,
        ripple2,
        ripple3,
        scaleAnim,
    ]);

    const handleDismiss = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            if (onComplete) onComplete();
        });
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
            <Animated.View
                style={[
                    styles.container,
                    { opacity: fadeAnim, backgroundColor: theme.colors.background },
                ]}
            >
                {/* Ripples */}
                {[ripple1, ripple2, ripple3].map((ripple, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.ripple,
                            {
                                backgroundColor: theme.colors.primary,
                                transform: [
                                    {
                                        scale: ripple.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.8, 3],
                                        }),
                                    },
                                ],
                                opacity: ripple.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.15, 0],
                                }),
                            },
                        ]}
                    />
                ))}

                {/* Confetti particles */}
                {particles.map((p, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.particle,
                            {
                                backgroundColor: CONFETTI_COLORS[i],
                                transform: [
                                    { translateX: p.x },
                                    { translateY: p.y },
                                    { scale: p.scale },
                                    {
                                        rotate: p.rotate.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0deg', '360deg'],
                                        }),
                                    },
                                ],
                                opacity: p.opacity,
                            },
                        ]}
                    />
                ))}

                {/* Main circle */}
                <Animated.View
                    style={[
                        styles.circleWrapper,
                        {
                            transform: [{ scale: scaleAnim }],
                            backgroundColor: theme.colors.surface,
                        },
                    ]}
                >
                    <LinearGradient
                        colors={[theme.colors.primary, theme.colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.circle}
                    >
                        <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
                            <Text style={styles.starEmoji}>🌟</Text>
                        </Animated.View>
                    </LinearGradient>
                </Animated.View>

                {/* Card */}
                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: theme.colors.surface,
                            opacity: checkmarkScale,
                            transform: [{ translateY: cardSlide }],
                        },
                    ]}
                >
                    <Text style={[styles.title, { color: theme.colors.text }]}>
                        UniEvent Wrapped
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.primary }]}>
                        Your year in review!
                    </Text>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: theme.colors.primary }]}
                        onPress={handleDismiss}
                    >
                        <Text style={styles.btnText}>See My Stats →</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Footer */}
                <Animated.Text
                    style={[
                        styles.footer,
                        { color: theme.colors.textSecondary, opacity: checkmarkScale },
                    ]}
                >
                    Powered by UniEvent
                </Animated.Text>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ripple: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        zIndex: -1,
    },
    particle: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 3,
    },
    circleWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        marginBottom: 24,
    },
    circle: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    starEmoji: {
        fontSize: 44,
    },
    card: {
        width: width * 0.78,
        padding: 18,
        borderRadius: 32,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 16,
    },
    divider: {
        width: '100%',
        height: 1,
        marginBottom: 14,
        opacity: 0.5,
    },
    btn: {
        paddingHorizontal: 28,
        paddingVertical: 11,
        borderRadius: 24,
        marginTop: 2,
    },
    btnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});

WrappedConfetti.propTypes = {
    visible: PropTypes.any,
    onComplete: PropTypes.any,
};
