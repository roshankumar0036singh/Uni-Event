import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

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
]);

function analyzeSentiment(text: string): string {
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

const PAGE_SIZE = 100;

export const analyzeFeedbackSentiment = functions.pubsub
    .schedule('every 60 minutes')
    .onRun(async () => {
        const db = admin.firestore();
        const feedbackDocs = await db
            .collectionGroup('feedback')
            .where('sentiment', '==', null)
            .where('feedback', '!=', null)
            .limit(PAGE_SIZE)
            .get();

        if (feedbackDocs.empty) {
            console.log('No pending feedback to analyze.');
            return null;
        }

        const batch = db.batch();
        let analyzedCount = 0;

        for (const doc of feedbackDocs.docs) {
            const data = doc.data();
            const feedbackText = data.feedback;

            if (!feedbackText || typeof feedbackText !== 'string') continue;

            const sentiment = analyzeSentiment(feedbackText);
            batch.update(doc.ref, { sentiment });
            analyzedCount += 1;
        }

        if (analyzedCount > 0) {
            await batch.commit();
            console.log(`Analyzed sentiment for ${analyzedCount} feedback entries.`);
        }

        return null;
    });
