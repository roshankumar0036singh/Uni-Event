import {
    EmailCircuitBreaker,
    BreakerState,
    retryWithExponentialBackoff,
    enqueueDeadLetter,
} from './emailResilience';

jest.useFakeTimers();

const flushTimers = async () => {
    await jest.runAllTimersAsync();
};

describe('EmailCircuitBreaker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('opens after the failure threshold is reached', () => {
        const breaker = new EmailCircuitBreaker({ failureThreshold: 5, cooldownMs: 60000 });
        expect(breaker.state).toBe(BreakerState.CLOSED);
        for (let i = 0; i < 5; i += 1) breaker.recordFailure();
        expect(breaker.state).toBe(BreakerState.OPEN);
        expect(breaker.isOpen()).toBe(true);
    });

    it('closes again after a success', () => {
        const breaker = new EmailCircuitBreaker({ failureThreshold: 2, cooldownMs: 60000 });
        breaker.recordFailure();
        breaker.recordFailure();
        expect(breaker.isOpen()).toBe(true);
        breaker.recordSuccess();
        expect(breaker.isOpen()).toBe(false);
        expect(breaker.consecutiveFailures).toBe(0);
    });

    it('allows a trial request after the cooldown elapses (half-open)', () => {
        const breaker = new EmailCircuitBreaker({ failureThreshold: 1, cooldownMs: 60000 });
        breaker.recordFailure();
        expect(breaker.isOpen()).toBe(true);
        expect(breaker.tryReset()).toBe(false);
        jest.setSystemTime(new Date('2026-08-12T00:01:01Z'));
        expect(breaker.tryReset()).toBe(true);
        expect(breaker.state).toBe(BreakerState.HALF_OPEN);
    });
});

describe('retryWithExponentialBackoff', () => {
    it('succeeds on the first attempt', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const result = await retryWithExponentialBackoff(fn, { delaysMs: [1, 2] });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries with exponential backoff and succeeds', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('boom 1'))
            .mockRejectedValueOnce(new Error('boom 2'))
            .mockResolvedValue('recovered');
        const onRetry = jest.fn();

        const promise = retryWithExponentialBackoff(fn, {
            delaysMs: [1000, 2000, 4000],
            onRetry,
        });
        await jest.runOnlyPendingTimersAsync();
        const result = await promise;

        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(3);
        expect(onRetry).toHaveBeenNthCalledWith(1, 1, 1000, expect.any(Error));
        expect(onRetry).toHaveBeenNthCalledWith(2, 2, 2000, expect.any(Error));
    });

    it('throws the last error after exhausting attempts', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('always fails'));
        const promise = retryWithExponentialBackoff(fn, { delaysMs: [1, 2, 3] });
        await jest.runAllTimersAsync();
        await expect(promise).rejects.toThrow('always fails');
        expect(fn).toHaveBeenCalledTimes(4);
    });
});

describe('enqueueDeadLetter', () => {
    it('writes the entry with queued status and context', async () => {
        const add = jest.fn().mockResolvedValue({ id: 'dlq-1' });
        const db = {
            collection: jest.fn(() => ({ add })),
        } as unknown as FirebaseFirestore.Firestore;

        const ref = await enqueueDeadLetter(db, {
            to: 'user@example.com',
            provider: 'resend',
            subject: 'Test',
            templateId: 'universal_email_template',
            eventId: 'event-123',
            reason: 'RESEND_500',
            attempts: 3,
        });

        expect(ref).toEqual({ id: 'dlq-1' });
        expect(db.collection).toHaveBeenCalledWith('email_dead_letter_queue');
        expect(add).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'user@example.com',
                provider: 'resend',
                eventId: 'event-123',
                reason: 'RESEND_500',
                attempts: 3,
                status: 'queued',
                retryCount: 0,
            }),
        );
    });
});
