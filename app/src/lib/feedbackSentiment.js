const POSITIVE_WORDS = new Set([
    'amazing',
    'excellent',
    'fantastic',
    'great',
    'wonderful',
    'awesome',
    'brilliant',
    'outstanding',
    'superb',
    'incredible',
    'perfect',
    'loved',
    'enjoyed',
    'fun',
    'best',
    'inspiring',
    'impressive',
    'phenomenal',
    'spectacular',
    'extraordinary',
    'terrific',
    'fabulous',
    'splendid',
    'recommend',
    'valuable',
    'insightful',
    'engaging',
    'memorable',
]);

const NEGATIVE_WORDS = new Set([
    'terrible',
    'awful',
    'horrible',
    'bad',
    'poor',
    'boring',
    'disappointed',
    'disappointing',
    'waste',
    'worst',
    'hate',
    'regret',
    'dreadful',
    'mediocre',
    'lousy',
    'pathetic',
    'useless',
    'mess',
    'disorganized',
    'chaotic',
    'confusing',
    'frustrating',
    'tedious',
    'pointless',
    'dull',
    'ridiculous',
    'pathetic',
]);

export function analyzeSentiment(text) {
    if (!text || typeof text !== 'string') {
        return 'neutral';
    }

    const normalized = text.toLowerCase().trim();
    if (!normalized) return 'neutral';

    const words = normalized.split(/\W+/).filter(Boolean);

    let positiveScore = 0;
    let negativeScore = 0;

    for (const word of words) {
        if (POSITIVE_WORDS.has(word)) positiveScore += 1;
        if (NEGATIVE_WORDS.has(word)) negativeScore += 1;
    }

    const diff = positiveScore - negativeScore;

    if (diff > 0) return 'positive';
    if (diff < 0) return 'negative';
    return 'neutral';
}
