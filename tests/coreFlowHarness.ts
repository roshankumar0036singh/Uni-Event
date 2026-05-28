export type Attendee = {
    uid: string;
    email: string;
    ticketId: string;
};

const POSITIVE_WORDS = new Set([
    'amazing',
    'excellent',
    'great',
    'wonderful',
    'insightful',
    'engaging',
]);

const NEGATIVE_WORDS = new Set(['awful', 'bad', 'boring', 'confusing', 'poor', 'terrible']);

export function buildCertificate(eventId: string, userId: string, slug: string) {
    return {
        eventId,
        userId,
        certificateUrl: `https://storage.example/certificates/${slug}.pdf`,
    };
}

export function buildCancellationNotification(eventId: string, title: string, reason: string) {
    return {
        type: 'event_cancelled',
        eventId,
        title: `${title} cancelled`,
        body: reason,
        read: false,
    };
}

export function buildRefund(eventId: string, attendee: Attendee, amount: number) {
    return {
        eventId,
        ticketId: attendee.ticketId,
        userId: attendee.uid,
        amount,
        status: 'processed',
    };
}

export function analyzeFeedbackSentiment(text: string) {
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    const score = words.reduce((total, word) => {
        if (POSITIVE_WORDS.has(word)) return total + 1;
        if (NEGATIVE_WORDS.has(word)) return total - 1;
        return total;
    }, 0);

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
}

export function buildOrganizerFeedbackNotification(eventId: string, sentiment: string, rating: number) {
    return {
        type: 'feedback_sentiment',
        eventId,
        sentiment,
        rating,
        read: false,
    };
}
