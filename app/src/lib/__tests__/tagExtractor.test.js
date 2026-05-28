import { extractTags } from '../tagExtractor';

describe('extractTags', () => {
    it.each([
        [
            'workshop and web dev keywords',
            'A hands-on workshop on web development using React and Node.js. Learn full stack development.',
            ['Workshop', 'Web Dev'],
        ],
        [
            'hackathon keywords',
            'Join our 24-hour hackathon where you build innovative solutions. Coding competition for all branches.',
            ['Hackathon'],
        ],
        [
            'cultural fest keywords',
            'Annual cultural fest with music, dance performances, and art exhibitions. Celebrate tradition.',
            ['Cultural Fest'],
        ],
        [
            'sports keywords',
            'Inter-department cricket tournament and football match. Sports championship.',
            ['Sports'],
        ],
        [
            'AI/ML keywords',
            'Seminar on artificial intelligence and machine learning. Deep learning and data science topics.',
            ['AI/ML'],
        ],
        [
            'music keywords',
            'Live music concert featuring bands and solo performances. Singing competition.',
            ['Music', 'Concert'],
        ],
    ])('detects %s', (_, description, expectedTags) => {
        const tags = extractTags(description);
        expectedTags.forEach(t => expect(tags).toContain(t));
    });

    it('returns multiple tags when description spans categories', () => {
        const tags = extractTags(
            'Tech workshop on cybersecurity and ethical hacking. Hands-on training.',
        );
        expect(tags.length).toBeGreaterThanOrEqual(2);
        expect(tags).toContain('Workshop');
        expect(tags).toContain('Cybersecurity');
    });

    it('returns empty array for empty description', () => {
        expect(extractTags('')).toEqual([]);
    });

    it('returns empty array for null description', () => {
        expect(extractTags(null)).toEqual([]);
    });

    it('returns empty array for description with no matching keywords', () => {
        expect(extractTags('Random text with no relevant keywords')).toEqual([]);
    });

    it('is case insensitive', () => {
        expect(extractTags('WORKSHOP on Coding')).toContain('Workshop');
    });

    it('limits suggestions to 5 tags', () => {
        const description =
            'workshop seminar hackathon conference concert music dance art sports tech';
        expect(extractTags(description).length).toBeLessThanOrEqual(5);
    });
});
