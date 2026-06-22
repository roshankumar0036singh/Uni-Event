import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

export default function useShakeGesture(onShake) {
    useEffect(() => {
        const lastShakeRef = useRef(0);

        Accelerometer.setUpdateInterval(100);

        const subscription = Accelerometer.addListener(({ x, y, z }) => {
            const acceleration = Math.sqrt(x * x + y * y + z * z);
            const now = Date.now();

            if (acceleration > 2.2 && now - lastShakeRef.current > 1000) {
                lastShakeRef.current = now;
                onShake?.();
            }
        });

        return () => subscription.remove();
    }, [onShake]);
}
