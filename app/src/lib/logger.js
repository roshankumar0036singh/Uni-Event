/**
 * Centralized logger for the application.
 * Filters logs based on the environment to reduce noise in production.
 */

const logger = {
    debug: (...args) => {
        if (__DEV__) {
            console.log('[DEBUG]', ...args);
        }
    },
    info: (...args) => {
        if (__DEV__) {
            console.log('[INFO]', ...args);
        }
    },
    warn: (...args) => {
        if (__DEV__) {
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
