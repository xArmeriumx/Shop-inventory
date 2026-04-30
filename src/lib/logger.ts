import { db } from '@/lib/db';
import { LogLevel } from '@prisma/client';
import { redact, redactString } from '@/lib/redact';

/**
 * Event Taxonomy for ERP Hardening (Phase 2.5)
 */
export enum SystemEventType {
  BOUNDARY_RECOVERY = 'boundary_recovery',
  FALLBACK_CONTRACT = 'fallback_contract',
  AUTH_TRANSITION_RECOVERY = 'auth_transition_recovery',
  VALIDATION_FAILURE = 'validation_failure',
  MUTATION_FAILURE = 'mutation_failure'
}

/**
 * In-memory cache for throttling repeated logs (60s window)
 */
const throttleMap = new Map<string, number>();
const THROTTLE_MS = 60000;

/**
 * In-memory fallback buffer for when DB logging fails.
 * Prevents cascading failures (e.g. pool timeout → logger also timeouts).
 * Buffer is flushed automatically on next successful write.
 */
const LOG_BUFFER_MAX = 50;
const logBuffer: Array<{
  level: string;
  message: string;
  context: any;
  timestamp: Date;
}> = [];

export const logger = {
  info: async (message: string, context?: any) => log(LogLevel.INFO, message, context),
  warn: async (message: string, context?: any) => log(LogLevel.WARN, message, context),
  error: async (message: string, error?: any, context?: any) => {
    const stack = error instanceof Error ? error.stack : undefined;
    return log(LogLevel.ERROR, message, { ...context, stack, error: error?.toString() });
  },

  /**
   * Universal Event Tracker for hardening observability
   */
  trackEvent: async (type: SystemEventType, params: {
    source: string;
    message: string;
    pathname?: string;
    metadata?: Record<string, any>;
  }) => {
    const throttleKey = `${type}:${params.source}:${params.message}`;
    const now = Date.now();
    const lastLog = throttleMap.get(throttleKey);

    if (lastLog && now - lastLog < THROTTLE_MS) {
      return;
    }

    throttleMap.set(throttleKey, now);

    return log(LogLevel.WARN, `[${type.toUpperCase()}] ${params.message}`, {
      ...params.metadata,
      type,
      source: params.source,
      pathname: params.pathname,
      is_hardening_event: true,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Compatibility wrapper for contract fallbacks
   */
  trackFallback: async (params: {
    source: string;
    message: string;
    expected?: string;
    actual?: string;
    context?: any;
  }) => {
    return logger.trackEvent(SystemEventType.FALLBACK_CONTRACT, {
      source: params.source,
      message: params.message,
      metadata: {
        ...params.context,
        expected_shape: params.expected,
        actual_type: params.actual,
        is_fallback: true,
      }
    });
  },
};

/**
 * Attempt to flush buffered logs that failed to write previously.
 * Non-blocking, best-effort.
 */
async function flushBuffer(client: typeof db) {
  if (logBuffer.length === 0) return;

  const toFlush = logBuffer.splice(0, 10); // Flush 10 at a time

  try {
    await client.systemLog.createMany({
      data: toFlush.map(entry => ({
        level: entry.level as LogLevel,
        message: `[BUFFERED] ${entry.message}`,
        body: JSON.stringify({ ...entry.context, bufferedAt: entry.timestamp.toISOString() }),
      })),
    });
  } catch {
    // Re-buffer if flush also fails — don't cascade
    logBuffer.unshift(...toFlush);
  }
}

async function log(level: LogLevel, message: string, context?: any) {
  try {
    const { path, method, userId, shopId, pathname, ...otherContext } = context || {};
    
    // Normalize path from context or specific pathname field
    const finalPath = (path || pathname) as string;

    const redactedContext = redact(otherContext);

    const redactedStack = typeof redactedContext.stack === 'string'
      ? redactString(redactedContext.stack).slice(0, 5000)
      : undefined;

    await db.systemLog.create({
      data: {
        level,
        message: redactString(message),
        path: finalPath,
        method: method as string,
        userId: userId as string,
        shopId: shopId as string,
        stack: redactedStack,
        body: JSON.stringify(redactedContext),
      },
    });

    // If write succeeds, try to flush any buffered logs
    flushBuffer(db).catch(() => {/* silent */});
  } catch (e) {
    // ── Fallback: Buffer + Console (ป้องกัน cascading failure) ──
    const redactedContext = redact(context);
    console.error(`[${level}] ${message}`, redactedContext);
    
    if (logBuffer.length < LOG_BUFFER_MAX) {
      logBuffer.push({ level, message, context: redactedContext, timestamp: new Date() });
    }
    // ห้าม throw — logger ต้องไม่ทำให้ business logic พัง
  }
}
