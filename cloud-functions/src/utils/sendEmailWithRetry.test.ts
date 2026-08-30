import { sendEmail, sendEmailWithRetry } from './emailSender';

const mockResendSend = jest.fn();
jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: {
            send: mockResendSend,
        },
    })),
}));

jest.mock('./emailTemplateRenderer', () => ({
    renderTemplate: jest.fn(() => '<h1>Hello</h1>'),
}));

jest.mock('firebase-admin', () => ({
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            add: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
        })),
    })),
}));

import { emailCircuitBreaker } from './emailResilience';

const baseOptions = {
    to: 'user@example.com',
    subject: 'Test',
    templateName: 'universal_email_template',
    templateData: { name: 'World' },
};

describe('sendEmailWithRetry', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        process.env = { ...originalEnv, RESEND_API_KEY: 'test-key' };
        emailCircuitBreaker.consecutiveFailures = 0;
        emailCircuitBreaker.state = 'CLOSED' as never;
        emailCircuitBreaker.openedAt = null;
        mockResendSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    });

    afterEach(() => {
        jest.useRealTimers();
        process.env = originalEnv;
    });

    it('succeeds on the first attempt', async () => {
        const result = await sendEmailWithRetry(baseOptions);
        expect(result.success).toBe(true);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it('retries transient failures and succeeds', async () => {
        mockResendSend
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });

        const promise = sendEmailWithRetry(baseOptions);
        await jest.runOnlyPendingTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(mockResendSend).toHaveBeenCalledTimes(2);
    });

    it('queues the email to the dead-letter queue after exhausting retries', async () => {
        mockResendSend.mockResolvedValue({ data: null, error: { message: 'RESEND_500' } });

        const promise = sendEmailWithRetry(baseOptions, { eventId: 'event-1' });
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('RESEND_500');
        expect(mockResendSend).toHaveBeenCalledTimes(6);
        expect(emailCircuitBreaker.consecutiveFailures).toBeGreaterThan(0);
    });

    it('short-circuits while the circuit breaker is open', async () => {
        emailCircuitBreaker.recordFailure();
        emailCircuitBreaker.recordFailure();
        emailCircuitBreaker.recordFailure();
        emailCircuitBreaker.recordFailure();
        emailCircuitBreaker.recordFailure();
        expect(emailCircuitBreaker.isOpen()).toBe(true);

        const result = await sendEmailWithRetry(baseOptions);
        expect(result.success).toBe(false);
        expect(result.error).toContain('circuit breaker is open');
        expect(mockResendSend).not.toHaveBeenCalled();
    });
});
