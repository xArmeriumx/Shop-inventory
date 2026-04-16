import { db } from '@/lib/db';
import { LogLevel } from '@prisma/client';

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

async function log(level: LogLevel, message: string, context?: any) {
  try {
    const { path, method, userId, shopId, pathname, ...otherContext } = context || {};
    
    // Normalize path from context or specific pathname field
    const finalPath = (path || pathname) as string;

    await db.systemLog.create({
      data: {
        level,
        message,
        path: finalPath,
        method: method as string,
        userId: userId as string,
        shopId: shopId as string,
        stack: otherContext.stack,
        body: JSON.stringify(otherContext),
      },
    });
  } catch (e) {
    console.error('Failed to write to system log:', e);
    console.log(`[${level}] ${message}`, context);
  }
}
