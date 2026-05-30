/**
 * Calculates the estimated reading time for a given text.
 *
 * @param {string} text - The input text to estimate read time for.
 * @param {number} [wordsPerMinute=200] - The reading speed (default is 200 WPM).
 * @returns {number} The estimated reading time in minutes (minimum of 1, 0 if empty/invalid).
 */
export function getReadTime(text, wordsPerMinute = 200) {
    if (!text || typeof text !== 'string') return 0;

    // Trim leading/trailing spaces and split by whitespace
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    if (wordCount === 0) return 0;

    // Calculate minutes and round up to the nearest whole minute
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
