/**
 * Centralized logger for the application.
 * Filters logs based on the environment to reduce noise in production.
 */

// Safe guard for __DEV__ global variable
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

const logger = {
    debug: (...args) => {
        if (isDev) {
            console.log('[DEBUG]', ...args);
        }
    },
    info: (...args) => {
        if (isDev) {
            console.log('[INFO]', ...args);
        }
    },
    warn: (...args) => {
        if (isDev) {
            console.warn('[WARN]', ...args);
        }
    },
    error: (...args) => {
        // Errors are usually kept in production for remote logging or debugging
        // but we prefix them for consistency.
        console.error('[ERROR]', ...args);
    },
};

export default logger;
