import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { AuditService } from '@/services/audit.service';
import type { RequestContext } from '@/types/domain';

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const isUpstashConfigured = !!upstashUrl && !!upstashToken;
const isProd = process.env.NODE_ENV === 'production';

const redis = isUpstashConfigured 
  ? new Redis({
      url: upstashUrl!,
      token: upstashToken!,
    })
  : ({
      sadd: async () => 1,
      eval: async () => [1, 1],
    } as any);

/**
 * Universal Rate Limiter for ERP application.
 * Uses `@upstash/ratelimit` on Vercel Edge / Serverless.
 */
export const rateLimiters = {
  /**
   * For heavy API operations like OCR. 
   * Default: 5 requests per minute (per shop).
   */
  ocr: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:ocr',
  }),

  /**
   * For AI / Chat completions.
   * Default: 10 requests per minute (per shop).
   */
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:ai',
  }),

  /**
   * For critical user actions like Invites, Deletions, Role changes.
   * Default: 5 requests per minute (per user).
   */
  invite: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:invite',
  }),

  /**
   * For database-heavy export reports.
   * Default: 2 requests per minute (per shop).
   */
  export: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:export',
  }),
};

/**
 * Helper to check rate limit and return standardized HTTP 429 logic.
 * Also logs abuse attempts to AuditService.
 */
export async function checkRateLimit(
  limiter: Ratelimit, 
  identifier: string,
  ctx?: RequestContext,
  actionContextName?: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  if (isProd && !isUpstashConfigured) {
    throw new Error('FATAL: KV_REST_API_URL or UPSTASH_REDIS_REST_URL must be set in production for rate limiting.');
  }

  // Graceful fallback ONLY in development
  if (!isProd && !isUpstashConfigured) {
    return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
  }

  const result = await limiter.limit(identifier);
  
  if (!result.success && ctx) {
    // Log hit to Audit API asynchronously (best-effort)
    AuditService.log(ctx, {
      action: 'RATE_LIMIT_EXCEEDED',
      status: 'DENIED',
      targetType: 'RateLimit',
      targetId: identifier,
      reason: `Hit limit for ${actionContextName || 'unknown_action'}`,
      note: `Remaining: ${result.remaining}, Reset in: ${Math.ceil((result.reset - Date.now()) / 1000)}s`
    }).catch(e => console.error('[RateLimit Audit Error]', e));
  }

  return result;
}
