import { analyzeSentiment } from '../feedbackSentiment';

describe('analyzeSentiment', () => {
    it.each([
        ['positive sentiment', 'The event was amazing and inspiring', 'positive'],
        ['very positive', 'Absolutely fantastic and brilliant experience', 'positive'],
        ['single positive word', 'Great event overall', 'positive'],
        ['negative sentiment', 'Terrible event, waste of time', 'negative'],
        ['very negative', 'Awful and disorganized. Boring and disappointing.', 'negative'],
        ['mixed but more positive', 'Amazing venue great organization', 'positive'],
        ['mixed but more negative', 'Nice venue but terrible management', 'negative'],
        ['neutral text', 'The event was held in the auditorium', 'neutral'],
        ['neutral with equal positive/negative', 'Great and terrible balance', 'neutral'],
        ['empty string', '', 'neutral'],
        ['null input', null, 'neutral'],
        ['whitespace only', '   ', 'neutral'],
        ['non-string input', 42, 'neutral'],
    ])('returns %s', (_, input, expected) => {
        expect(analyzeSentiment(input)).toBe(expected);
    });
});
