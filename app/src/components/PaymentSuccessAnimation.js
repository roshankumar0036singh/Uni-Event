import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import PropTypes from 'prop-types';

const { width } = Dimensions.get('window');

export default function PaymentSuccessAnimation({ visible, onComplete, amount }) {
    const { theme } = useTheme();
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const checkmarkScale = useRef(new Animated.Value(0)).current;
    const receiptSlide = useRef(new Animated.Value(100)).current; // Slide up effect

    // Ripple animations
    const ripple1 = useRef(new Animated.Value(0)).current;
    const ripple2 = useRef(new Animated.Value(0)).current;
    const ripple3 = useRef(new Animated.Value(0)).current;

    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    const checkmarkTimerRef = useRef(null);
    const completeTimerRef = useRef(null);
    const rippleAnimsRef = useRef([]);

    useEffect(() => {
        let mounted = true;

        if (visible) {
            // Reset
            scaleAnim.setValue(0);
            fadeAnim.setValue(0);
            checkmarkScale.setValue(0);
            receiptSlide.setValue(100);
            ripple1.setValue(0);
            ripple2.setValue(0);
            ripple3.setValue(0);

            // 1. Fade In Overlay
            const f1 = Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            });
            f1.start();

            // 2. Main Circle Pop
            const s1 = Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            });
            s1.start();

            // 3. Ripples (Staggered)
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
                        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }), // Reset immediately
                    ]),
                );

            // Start ripples
            const r1 = rippleAnim(ripple1, 0);
            const r2 = rippleAnim(ripple2, 400);
            const r3 = rippleAnim(ripple3, 800);
            r1.start();
            r2.start();
            r3.start();

            rippleAnimsRef.current = [f1, s1, r1, r2, r3];

            // 4. Checkmark Pop & Receipt Slide (Delayed slightly)
            checkmarkTimerRef.current = setTimeout(() => {
                if (!mounted) return;
                const p1 = Animated.parallel([
                    Animated.spring(checkmarkScale, {
                        toValue: 1,
                        friction: 5,
                        tension: 50,
                        useNativeDriver: true,
                    }),
                    Animated.spring(receiptSlide, {
                        toValue: 0,
                        friction: 8,
                        tension: 40,
                        useNativeDriver: true,
                    }),
                ]);
                rippleAnimsRef.current.push(p1);
                p1.start();
            }, 300);

            // 5. Complete
            completeTimerRef.current = setTimeout(() => {
                if (!mounted) return;
                const f2 = Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                });
                rippleAnimsRef.current.push(f2);
                f2.start(() => {
                    if (mounted && onCompleteRef.current) {
                        onCompleteRef.current();
                    }
                });
            }, 3500); // Slightly longer to appreciate the "Receipt"
        }

        return () => {
            mounted = false;
            if (checkmarkTimerRef.current) clearTimeout(checkmarkTimerRef.current);
            if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
            rippleAnimsRef.current.forEach(anim => {
                if (anim && typeof anim.stop === 'function') {
                    anim.stop();
                }
            });
            rippleAnimsRef.current = [];
        };
    }, [visible, checkmarkScale, fadeAnim, receiptSlide, ripple1, ripple2, ripple3, scaleAnim]);

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
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            backgroundColor: theme.colors.primary,
                            transform: [
                                {
                                    scale: ripple1.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.8, 3],
                                    }),
                                },
                            ],
                            opacity: ripple1.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.15, 0],
                            }),
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            backgroundColor: theme.colors.primary,
                            transform: [
                                {
                                    scale: ripple2.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.8, 3],
                                    }),
                                },
                            ],
                            opacity: ripple2.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.15, 0],
                            }),
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            backgroundColor: theme.colors.primary,
                            transform: [
                                {
                                    scale: ripple3.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.8, 3],
                                    }),
                                },
                            ],
                            opacity: ripple3.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.15, 0],
                            }),
                        },
                    ]}
                />

                {/* Main Circle */}
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
                            <Ionicons
                                name="checkmark"
                                size={60}
                                color="#fff"
                                style={{ fontWeight: 'bold' }}
                            />
                        </Animated.View>
                    </LinearGradient>
                </Animated.View>

                {/* Receipt Card Effect */}
                <Animated.View
                    style={[
                        styles.receiptCard,
                        {
                            backgroundColor: theme.colors.surface,
                            opacity: checkmarkScale,
                            transform: [{ translateY: receiptSlide }],
                        },
                    ]}
                >
                    <Text style={[styles.title, { color: theme.colors.text }]}>
                        Payment Successful
                    </Text>
                    <Text style={[styles.amount, { color: theme.colors.primary }]}>₹{amount}</Text>

                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    <View style={styles.row}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            Transaction ID
                        </Text>
                        <Text style={[styles.value, { color: theme.colors.text }]}>
                            TXN-{Math.floor(Math.random() * 1000000)}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            Date
                        </Text>
                        <Text style={[styles.value, { color: theme.colors.text }]}>
                            {new Date().toLocaleDateString()}
                        </Text>
                    </View>
                </Animated.View>

                {/* Branding Footer */}
                <Animated.Text
                    style={[
                        styles.footer,
                        { color: theme.colors.textSecondary, opacity: checkmarkScale },
                    ]}
                >
                    Secured by UniEvent
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
        marginBottom: 30, // Space for receipt
    },
    circle: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    receiptCard: {
        width: width * 0.8,
        padding: 24,
        borderRadius: 24,
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
        marginBottom: 8,
    },
    amount: {
        fontSize: 36,
        fontWeight: '800',
        marginBottom: 20,
    },
    divider: {
        width: '100%',
        height: 1,
        marginBottom: 15,
        opacity: 0.5,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'monospace', // Adds a nice tech/receipt touch
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

PaymentSuccessAnimation.propTypes = {
    visible: PropTypes.any,
    onComplete: PropTypes.any,
    amount: PropTypes.any,
};
