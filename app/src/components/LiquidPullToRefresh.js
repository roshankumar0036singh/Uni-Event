import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import PropTypes from 'prop-types';
import { Canvas, Path, Skia, Circle } from '@shopify/react-native-skia';
import { useTheme } from '../lib/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DROPLET_MAX_WIDTH = 40;
const DROPLET_MAX_HEIGHT = 55;
const PULL_THRESHOLD = 80;

const createDropletPath = (progress, canvasWidth, pulseScale) => {
    const path = Skia.Path.Make();
    if (progress < 0.01) return path;

    const cx = canvasWidth / 2;
    const cy = 35;

    const t = Math.min(progress, 1);
    const scale = Math.min(t * 1.8, 1) * (pulseScale || 1);

    const w = DROPLET_MAX_WIDTH * scale;
    const h = DROPLET_MAX_HEIGHT * scale * (1 + t * 0.3);
    const hw = w / 2;

    const top = cy - h * 0.35;
    const bottom = cy + h * 0.65;

    path.moveTo(cx, top);
    path.cubicTo(
        cx + hw * 0.85,
        top + h * 0.15,
        cx + hw,
        top + h * 0.35,
        cx + hw * 0.35,
        top + h * 0.5,
    );
    path.cubicTo(cx + hw * 0.35, top + h * 0.7, cx + hw * 0.15, bottom, cx, bottom);
    path.cubicTo(
        cx - hw * 0.15,
        bottom,
        cx - hw * 0.35,
        top + h * 0.7,
        cx - hw * 0.35,
        top + h * 0.5,
    );
    path.cubicTo(cx - hw, top + h * 0.35, cx - hw * 0.85, top + h * 0.15, cx, top);
    path.close();
    return path;
};

export default function LiquidPullToRefresh({ pullDistance, isRefreshing, color }) {
    const { theme } = useTheme();
    const dropletColor = color || theme.colors.primary;
    const rawProgress = Math.max(0, Math.min(1, pullDistance / PULL_THRESHOLD));
    const displayProgress = isRefreshing ? 1 : rawProgress;

    const [pulseScale, setPulseScale] = useState(1);
    const pulseRef = useRef(null);
    const [splashParticles, setSplashParticles] = useState([]);
    const splashRef = useRef(null);
    const isAtThreshold = rawProgress >= 0.85;

    // Pulse animation when at threshold
    useEffect(() => {
        if (isAtThreshold && !isRefreshing) {
            let growing = true;
            const pulse = () => {
                setPulseScale(prev => {
                    const next = growing ? prev + 0.015 : prev - 0.015;
                    if (next >= 1.08) growing = false;
                    if (next <= 1) growing = true;
                    return next;
                });
                pulseRef.current = setTimeout(pulse, 30);
            };
            pulseRef.current = setTimeout(pulse, 30);
            return () => {
                if (pulseRef.current) clearTimeout(pulseRef.current);
            };
        } else if (!isRefreshing) {
            setPulseScale(1);
        }
    }, [isAtThreshold, isRefreshing]);

    // Splash on refresh
    useEffect(() => {
        if (isRefreshing) {
            const count = 10;
            const baseParticles = Array.from({ length: count }, (_, i) => ({
                id: i,
                angle: (i / count) * Math.PI * 2 + i * 0.06,
                maxRadius: 25 + ((i * 7) % 40),
                size: 2 + (i % 4),
            }));

            const startTime = Date.now();
            const duration = 500;
            let active = true;

            const tick = () => {
                if (!active) return;
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);

                setSplashParticles(
                    baseParticles.map(p => ({
                        ...p,
                        radius: p.maxRadius * progress,
                        opacity: 1 - progress * 0.8,
                    })),
                );

                if (progress < 1) {
                    splashRef.current = setTimeout(tick, 16);
                } else {
                    splashRef.current = setTimeout(() => setSplashParticles([]), 50);
                }
            };

            tick();
            return () => {
                active = false;
                if (splashRef.current) clearTimeout(splashRef.current);
            };
        } else {
            setSplashParticles([]);
        }
    }, [isRefreshing]);

    if (displayProgress < 0.01 && splashParticles.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Canvas style={{ width: SCREEN_WIDTH, height: PULL_THRESHOLD }}>
                <Path
                    path={createDropletPath(displayProgress, SCREEN_WIDTH, pulseScale)}
                    color={dropletColor}
                    style="fill"
                />
                {splashParticles.map(p => (
                    <Circle
                        key={p.id}
                        cx={SCREEN_WIDTH / 2 + Math.cos(p.angle) * p.radius}
                        cy={35 + Math.sin(p.angle) * p.radius * 0.6}
                        r={p.size}
                        color={dropletColor}
                        opacity={p.opacity}
                    />
                ))}
            </Canvas>
        </View>
    );
}

LiquidPullToRefresh.propTypes = {
    pullDistance: PropTypes.number,
    isRefreshing: PropTypes.bool,
    color: PropTypes.string,
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: PULL_THRESHOLD,
        zIndex: 1000,
        pointerEvents: 'none',
    },
});
