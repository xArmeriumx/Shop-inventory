import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { db } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { ServiceError } from '@/types/domain';

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const isUpstashConfigured = !!upstashUrl && !!upstashToken;
const isProd = process.env.NODE_ENV === 'production';

export const redis = isUpstashConfigured
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
   * Enterprise Scale: 20 requests per minute (per shop).
   */
  ocr: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:ocr',
  }),

  /**
   * For AI / Chat completions.
   * Enterprise Scale: 200 requests per minute (per shop).
   */
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:ai',
  }),

  /**
   * For critical user actions like Invites, Deletions, Role changes.
   * Enterprise Scale: 100 requests per minute (per user).
   */
  invite: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:invite',
  }),

  /**
   * For database-heavy export reports.
   * Enterprise Scale: 30 requests per minute (per shop).
   */
  export: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:export',
  }),

  /**
   * For intensive file uploads (Receipts, Product Images).
   * Enterprise Scale: 500 requests per minute (per user).
   */
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, '1 m'),
    analytics: true,
    prefix: 'erp:ratelimit:upload',
  }),
};

/**
 * Available policies for rate limiting in api-guard and auth-guard
 */
export type RateLimitPolicy = keyof typeof rateLimiters | 'none';

/**
 * Helper to check rate limit and return standardized HTTP 429 logic.
 * Also logs abuse attempts to AuditService.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
  ctx?: { userId: string; shopId?: string; userName?: string; userEmail?: string },
  actionContextName?: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  if (isProd && !isUpstashConfigured) {
    console.error('[RateLimit Error] FATAL: Missing KV_REST_API_URL or UPSTASH_REDIS_REST_URL in production env.');
    throw new Error('FATAL: KV_REST_API_URL or UPSTASH_REDIS_REST_URL must be set in production for rate limiting.');
  }

  // Graceful fallback ONLY in development
  if (!isProd && !isUpstashConfigured) {
    console.log(`[RateLimit Dev] Bypassing ${identifier} because Upstash ENV is missing in local development.`);
    return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
  }

  console.log(`[RateLimit Executing] ENV Found: true, Checking identifier: ${identifier}`);
  const result = await limiter.limit(identifier);
  console.log(`[RateLimit Result] success: ${result.success}, remaining: ${result.remaining}`);

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
