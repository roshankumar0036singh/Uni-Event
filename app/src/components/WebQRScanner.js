import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import PropTypes from 'prop-types';

export default function WebQRScanner({ onScan, style }) {
    const onScanRef = useRef(onScan);
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        let html5QrCode;

        const startScanner = async () => {
            // Dynamic import to avoid issues on native
            try {
                const { Html5Qrcode } = require('html5-qrcode');
                html5QrCode = new Html5Qrcode('reader');

                await html5QrCode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        // qrbox: { width: 250, height: 250 } // Commented out to prevent default library overlay brackets
                    },
                    (decodedText, decodedResult) => {
                        if (onScanRef.current) onScanRef.current(decodedText);
                        // Optional: Stop scanning after first success if needed, or keep scanning
                        // html5QrCode.stop();
                    },
                    errorMessage => {
                        // parsed error, ignore
                    },
                );
            } catch (err) {
                console.error('Failed to start scanner', err);
            }
        };

        // Delay slightly to ensure DOM is ready
        setTimeout(startScanner, 500);

        return () => {
            if (html5QrCode) {
                html5QrCode.stop().catch(err => console.error(err));
            }
        };
    }, []);

    if (Platform.OS !== 'web') return null;

    return (
        <View style={[styles.container, style]}>
            <div id="reader" style={{ width: '100%', height: '100%' }}></div>
            <Text style={{ textAlign: 'center', marginTop: 10, color: '#666' }}>
                Allow camera access to scan
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
    },
});

WebQRScanner.propTypes = {
    onScan: PropTypes.any,
    style: PropTypes.any,
};
