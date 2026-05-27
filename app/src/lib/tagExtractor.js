const TAG_VOCABULARY = {
    Workshop: ['workshop', 'hands-on', 'practical session', 'training', 'learn'],
    Seminar: ['seminar', 'talk', 'guest lecture', 'lecture', 'presentation', 'speaker'],
    Hackathon: ['hackathon', 'hack', 'coding competition', 'build', '24-hour'],
    Competition: ['competition', 'contest', 'challenge', 'tournament', 'championship', 'battle'],
    Concert: ['concert', 'live music', 'band', 'gig', 'performance', 'orchestra'],
    'Cultural Fest': ['cultural', 'fest', 'celebration', 'traditional', 'ethnic', 'annual day'],
    Tech: ['tech', 'technology', 'technical', 'coding', 'programming', 'software', 'digital'],
    Sports: [
        'sports',
        'tournament',
        'match',
        'game',
        'athletics',
        'cricket',
        'football',
        'basketball',
        'badminton',
    ],
    Music: ['music', 'singing', 'song', 'vocal', 'instrumental', 'guitar', 'piano'],
    Dance: ['dance', 'choreography', 'hip-hop', 'contemporary', 'folk dance'],
    Art: ['art', 'painting', 'sketching', 'drawing', 'exhibition', 'craft', 'pottery'],
    Photography: ['photography', 'photoshoot', 'camera', 'photo', 'click'],
    Debate: ['debate', 'discussion', 'speech', 'public speaking', 'spelling bee'],
    Quiz: ['quiz', 'trivia', 'brainstorm', 'puzzle', 'riddle'],
    Conference: ['conference', 'summit', 'symposium', 'convention'],
    Webinar: ['webinar', 'online session', 'virtual', 'zoom', 'google meet'],
    Meetup: ['meetup', 'networking', 'social', 'gathering', 'hangout'],
    'AI/ML': [
        'artificial intelligence',
        'machine learning',
        'deep learning',
        'ai',
        'ml',
        'neural',
        'data science',
    ],
    Cybersecurity: ['cyber', 'security', 'ethical hacking', 'penetration testing', 'encryption'],
    'Web Dev': ['web development', 'web dev', 'full stack', 'frontend', 'backend', 'react', 'node'],
    'App Dev': ['app development', 'mobile app', 'android', 'ios', 'flutter', 'react native'],
    Placement: ['placement', 'interview', 'resume', 'campus placement', 'recruitment', 'job'],
    Entrepreneurship: ['entrepreneur', 'startup', 'business', 'innovation', 'pitch', 'incubation'],
    Research: ['research', 'paper', 'publication', 'thesis', 'journal', 'project'],
    Alumni: ['alumni', 'alumnus', 'alma mater', 'old students'],
};

export function extractTags(description) {
    if (!description || typeof description !== 'string') {
        return [];
    }

    const normalized = description.toLowerCase().trim();
    if (!normalized) return [];

    const matches = Object.entries(TAG_VOCABULARY).map(([tag, keywords]) => {
        const matchCount = keywords.reduce((count, keyword) => {
            return count + (normalized.includes(keyword) ? 1 : 0);
        }, 0);
        return { tag, matchCount };
    });

    return matches
        .filter(m => m.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount)
        .map(m => m.tag)
        .slice(0, 5);
}
