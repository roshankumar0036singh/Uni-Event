import { logger } from '../logger';

/**
 * Email resilience helpers (#326): exponential-backoff retries, a circuit
 * breaker that trips after consecutive failures, contextual failure logging
 * and a Firestore dead-letter queue for manual re-delivery.
 */

export const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

export enum BreakerState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export class EmailCircuitBreaker {
    failureThreshold: number;
    cooldownMs: number;
    consecutiveFailures = 0;
    state: BreakerState = BreakerState.CLOSED;
    openedAt: number | null = null;

    constructor(opts: { failureThreshold?: number; cooldownMs?: number } = {}) {
        this.failureThreshold = opts.failureThreshold ?? 5;
        this.cooldownMs = opts.cooldownMs ?? 60_000;
    }

    recordSuccess() {
        this.consecutiveFailures = 0;
        this.state = BreakerState.CLOSED;
        this.openedAt = null;
    }

    recordFailure() {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.failureThreshold) {
            this.state = BreakerState.OPEN;
            this.openedAt = Date.now();
        }
    }

    /** Allows a single trial request after the cooldown has elapsed. */
    tryReset(): boolean {
        if (this.state !== BreakerState.OPEN || this.openedAt === null) return false;
        if (Date.now() - this.openedAt >= this.cooldownMs) {
            this.state = BreakerState.HALF_OPEN;
            return true;
        }
        return false;
    }

    isOpen(): boolean {
        return this.state === BreakerState.OPEN;
    }
}

export interface RetryOptions {
    maxAttempts?: number;
    delaysMs?: number[];
    label?: string;
    onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

/**
 * Runs `fn` with exponential backoff (1s, 2s, 4s, 8s, 16s by default).
 * Only errors are retried; successful results are returned immediately.
 */
export async function retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const delaysMs = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    const maxAttempts = options.maxAttempts ?? delaysMs.length + 1;
    const label = options.label ?? 'email send';

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt >= maxAttempts) break;
            const delayMs = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1];
            logger.warn({
                message: `retry scheduled for ${label}`,
                attempt,
                nextDelayMs: delayMs,
                error: error instanceof Error ? error.message : String(error),
            });
            options.onRetry?.(attempt, delayMs, error);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}

export interface DeadLetterEntry {
    to: string;
    provider: 'resend' | 'emailjs';
    subject?: string;
    templateId?: string;
    eventId?: string;
    reason: string;
    attempts: number;
}

/**
 * Persists a failed email to the dead-letter queue for manual retry.
 * Returns the created document reference (or null on failure).
 */
export async function enqueueDeadLetter(
    db: FirebaseFirestore.Firestore,
    entry: DeadLetterEntry,
): Promise<FirebaseFirestore.DocumentReference | null> {
    try {
        const ref = await db.collection('email_dead_letter_queue').add({
            ...entry,
            status: 'queued',
            retryCount: 0,
            createdAt: new Date().toISOString(),
        });
        logger.error({
            message: 'email queued to dead-letter queue',
            to: entry.to,
            provider: entry.provider,
            eventId: entry.eventId ?? null,
            reason: entry.reason,
        });
        return ref;
    } catch (error) {
        logger.error({
            message: 'failed to enqueue dead-letter entry',
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export interface AdminAlert {
    title: string;
    message: string;
    context?: Record<string, unknown>;
}

/**
 * Records an admin alert (circuit breaker trips, systemic failures) and
 * logs it loudly for debugging.
 */
export async function alertAdmins(
    db: FirebaseFirestore.Firestore,
    alert: AdminAlert,
): Promise<void> {
    logger.error({
        message: `ADMIN ALERT: ${alert.title}`,
        detail: alert.message,
        context: alert.context,
    });
    try {
        await db.collection('admin_alerts').add({
            ...alert,
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({
            message: 'failed to persist admin alert',
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export const emailCircuitBreaker = new EmailCircuitBreaker();
