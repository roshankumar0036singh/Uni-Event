import * as winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

export const logger = winston.createLogger({
  level: 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'uni-event' },
  transports: [
    new winston.transports.Console(),
  ],
});

export function logEntry(
  service: string,
  message: string,
  context?: {
    userId?: string;
    eventId?: string;
    requestId?: string;
    input?: unknown;
    output?: unknown;
    stack?: string;
  }
) {
  logger.info({
    message,
    service,
    timestamp: new Date().toISOString(),
    userId:    context?.userId    ?? null,
    eventId:   context?.eventId   ?? null,
    requestId: context?.requestId ?? null,
    context:   context?.input     ?? null,
    output:    context?.output    ?? null,
    stack:     context?.stack     ?? null,
  });
}

export function logError(
  service: string,
  message: string,
  error: unknown,
  context?: {
    userId?: string;
    eventId?: string;
    requestId?: string;
    context?: unknown;
  }
) {
  let errorMessage = 'unknown error';
  let stack: string | null = null;

  if (error instanceof Error) {
    errorMessage = error.message;
    stack = error.stack ?? null;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorMessage = JSON.stringify(error);
  }

  logger.error({
    message,
    errorMessage,
    service,
    timestamp: new Date().toISOString(),
    userId:    context?.userId    ?? null,
    eventId:   context?.eventId   ?? null,
    requestId: context?.requestId ?? null,
    context:   context?.context   ?? null,
    stack,
  });
}