export const TAG_DICTIONARY = {
    'programming': 'coding',
    'code': 'coding',
    'software': 'coding',
    'development': 'coding',
    'hackathon': 'hackathon',
    'hack': 'hackathon',
    'ai': 'artificial-intelligence',
    'machine learning': 'artificial-intelligence',
    'ml': 'artificial-intelligence',
    'web-dev': 'web-development',
    'webdev': 'web-development',
    'frontend': 'web-development',
    'backend':'web-development',
    'app-dev':'app-development',

    'seminar': 'seminar',
    'talk': 'seminar',
    'lecture': 'seminar',
    'workshop': 'workshop',
    'hands-on': 'workshop',
    'bootcamp': 'workshop',
    'competition': 'competition',
    'contest': 'competition',
    'fest': 'festival',
    'festival': 'festival',
    'cultural': 'cultural',
    'culture': 'cultural',

    'music': 'music',
    'singing': 'music',
    'band': 'music',
    'concert': 'music',
    'performance': 'performance',

    'sports': 'sports',
    'football': 'sports',
    'soccer': 'sports',
    'basketball': 'sports',
    'tennis': 'sports',
    'marathon': 'sports',
    'yoga': 'fitness',
    'fitness': 'fitness',
    'gym': 'fitness',

    'placement': 'careers',
    'internship': 'careers',
    'job': 'careers',
    'resume': 'careers',
    'interview': 'careers',
    'networking': 'networking',

    'exam': 'academics',
    'study': 'academics',
    'quiz': 'quiz',
    'trivia': 'quiz',

};

export function normalizeTags(rawTags){
    const seen = new Set();
    const result = [];

    for(const raw of rawTags ){
        const cleaned = raw.replace(/^#/, '').toLowerCase().trim();
        const canonical = TAG_DICTIONARY[cleaned] ?? cleaned;

        if(canonical && !seen.has(canonical)){
            seen.add(canonical);
            result.push(canonical);
        }
    }
    return result;
}
