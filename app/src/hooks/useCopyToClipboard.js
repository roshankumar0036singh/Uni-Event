import { useState, useRef, useEffect, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';

/**
 * A custom hook to handle copying text to the clipboard with clean timeout management.
 * Prevents memory leaks and handles rapid successive copy actions safely.
 *
 * @param {number} duration - Time in ms to show the copied/toast status (default 2000)
 */
export function useCopyToClipboard(duration = 2000) {
    const [activeCopiedField, setActiveCopiedField] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    const copiedFieldTimeoutRef = useRef(null);
    const toastTimeoutRef = useRef(null);

    const handleCopyToClipboard = useCallback(
        async (text, fieldName) => {
            if (!text) return;
            try {
                await Clipboard.setStringAsync(text);

                // Clear any active timeouts to prevent overlapping state updates
                if (copiedFieldTimeoutRef.current) clearTimeout(copiedFieldTimeoutRef.current);
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

                setActiveCopiedField(fieldName);
                setToastMessage(`${fieldName} copied to clipboard!`);

                copiedFieldTimeoutRef.current = setTimeout(() => {
                    setActiveCopiedField(prev => (prev === fieldName ? '' : prev));
                }, duration);

                toastTimeoutRef.current = setTimeout(() => {
                    setToastMessage(prev =>
                        prev === `${fieldName} copied to clipboard!` ? '' : prev,
                    );
                }, duration);
            } catch (error) {
                console.error('Failed to copy to clipboard', error);
            }
        },
        [duration],
    );

    // Cleanup timeouts on component unmount
    useEffect(() => {
        return () => {
            if (copiedFieldTimeoutRef.current) clearTimeout(copiedFieldTimeoutRef.current);
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        };
    }, []);

    return {
        activeCopiedField,
        setActiveCopiedField,
        toastMessage,
        setToastMessage,
        handleCopyToClipboard,
    };
}
