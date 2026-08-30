const functionsTest = require('firebase-functions-test');

jest.mock('firebase-admin', () => {
    const getMock = jest.fn();
    const updateMock = jest.fn();
    const collectionMock = jest.fn(() => ({
        doc: jest.fn(() => ({
            get: getMock,
            update: updateMock,
        })),
    }));
    return {
        apps: [],
        initializeApp: jest.fn(),
        firestore: jest.fn(() => ({ collection: collectionMock })),
    };
});

jest.mock('./utils/emailSender', () => {
    const sendEmailWithRetry = jest.fn();
    return {
        sendEmail: jest.fn(async () => ({ success: true })),
        sendEmailWithRetry,
    };
});

jest.mock('./utils/emailResilience', () => ({
    emailCircuitBreaker: {
        isOpen: jest.fn(() => false),
    },
    DEFAULT_RETRY_DELAYS_MS: [1000, 2000, 4000, 8000, 16000],
}));

import { retryDeadLetterEmail } from './retryDeadLetterEmail';
import { sendEmailWithRetry } from './utils/emailSender';

const testEnv = functionsTest();
const wrapped = testEnv.wrap(retryDeadLetterEmail as any);

describe('retryDeadLetterEmail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects unauthenticated calls', async () => {
        await expect(wrapped({ entryId: 'x' }, { auth: null } as any)).rejects.toThrow(
            'You must be signed in.',
        );
    });

    it('rejects students', async () => {
        await expect(
            wrapped({ entryId: 'x' }, { auth: { uid: 's1', token: {} } } as any),
        ).rejects.toThrow('Only admins or clubs can retry dead-letter emails.');
    });

    it('rejects a missing entryId', async () => {
        await expect(
            wrapped({}, { auth: { uid: 'a1', token: { admin: true } } } as any),
        ).rejects.toThrow(/entryId/);
    });

    it('re-sends a queued entry and marks it delivered', async () => {
        const admin = require('firebase-admin');
        admin.firestore().collection('email_dead_letter_queue') // init chain
            .doc('dlq-1')
            .get
            .mockResolvedValue({
                exists: true,
                data: () => ({
                    to: 'user@example.com',
                    subject: 'Hello',
                    templateId: 'universal_email_template',
                    templateData: {},
                    provider: 'resend',
                    retryCount: 1,
                    status: 'queued',
                }),
            });
        admin.firestore().collection('email_dead_letter_queue').doc('dlq-1').update.mockResolvedValue({});
        (sendEmailWithRetry as unknown as jest.Mock).mockResolvedValue({
            success: true,
            messageId: 'msg-retry',
        });

        const result = await wrapped(
            { entryId: 'dlq-1' },
            { auth: { uid: 'a1', token: { admin: true } } } as any,
        );

        expect(result).toEqual({ success: true, entryId: 'dlq-1', retryCount: 2 });
        expect(sendEmailWithRetry).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'user@example.com' }),
        );
    });
});