import { useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';

export default function useShakeGesture(onShake) {
    useEffect(() => {
        let lastShake = 0;

        Accelerometer.setUpdateInterval(100);

        const subscription = Accelerometer.addListener(({ x, y, z }) => {
            const acceleration = Math.sqrt(x * x + y * y + z * z);
            const now = Date.now();

            if (acceleration > 2.2 && now - lastShake > 1000) {
                lastShake = now;
                onShake?.();
            }
        });

        return () => subscription.remove();
    }, [onShake]);
}
