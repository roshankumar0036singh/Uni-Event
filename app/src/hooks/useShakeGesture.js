import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

export default function useShakeGesture(onShake) {
    const lastShakeRef = useRef(0);

    useEffect(() => {
        Accelerometer.setUpdateInterval(100);

        const subscription = Accelerometer.addListener(({ x, y, z }) => {
            const acceleration = Math.hypot(x, y, z);
            const now = Date.now();

            if (acceleration > 2.2 && now - lastShakeRef.current > 1000) {
                lastShakeRef.current = now;
                onShake?.();
            }
        });

        return () => subscription.remove();
    }, [onShake]);
}
