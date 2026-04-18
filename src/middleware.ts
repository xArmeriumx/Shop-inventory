'use server';

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ==================== MIDDLEWARE RATE LIMITER ====================
//
// Architecture Decision: TWO-LAYER rate limiting with DIFFERENT algorithms
// -----------------------------------------------------------------------
// Layer 1 (this file) -- Perimeter Guard:
//   Algorithm : FIXED WINDOW (INCR + EXPIRE, set on first request only)
//   Scope     : Per source IP, shared across all serverless instances
//   Storage   : Upstash Redis (prod/preview), in-memory (local dev only)
//   Purpose   : Block raw HTTP flood / DDoS before business logic runs
//   Audit     : None -- Edge Runtime cannot import Prisma/AuditService
//
// Layer 2 (src/lib/rate-limit.ts) -- Business Guard:
//   Algorithm : SLIDING WINDOW via @upstash/ratelimit
//   Scope     : Per shop/user, per action type (ocr, ai, export, invite...)
//   Storage   : Upstash Redis (fail-loud in prod if not configured)
//   Purpose   : Fair rate limiting on business operations
//   Audit     : Logs hits to AuditService (RATE_LIMIT_EXCEEDED)
//
// These two layers are INTENTIONALLY using different algorithms.
// Fixed window is appropriate at the perimeter: simpler, cheaper, Edge-safe.
// Sliding window is appropriate per-action: fairer, more precise.
//
// -- X-RateLimit-Reset note --------------------------------------------------
// Reset value is Unix epoch in MILLISECONDS (not an HTTP-date string).
// Clients must parse it as: new Date(Number(header)).
// This is intentionally epoch-ms (not RFC-7231 date format).
//
// -- Upstash env vars --------------------------------------------------------
// UPSTASH_REDIS_REST_URL   (or KV_REST_API_URL)
// UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)
// Same env vars used by src/lib/rate-limit.ts -- no extra config needed.
// -----------------------------------------------------------------------------

const RATE_LIMIT = {
  MAX_REQUESTS: 150, // Relaxed for prefetches and active UI
  WINDOW_SECONDS: 10,
};

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const isUpstashConfigured = !!upstashUrl && !!upstashToken;

/**
 * Fixed-window rate limit check via Upstash Redis REST API.
 */
async function checkUpstashRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number } | null> {
  if (!isUpstashConfigured) return null;
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
    return { allowed: true, remaining: RATE_LIMIT.MAX_REQUESTS, resetIn: 0 };
  }

  const key = `erp:ratelimit:middleware:ip:${ip}`;
  const windowMs = RATE_LIMIT.WINDOW_SECONDS * 1000;

  try {
    const incrRes = await fetch(`${upstashUrl}/INCR/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${upstashToken}` },
      cache: 'no-store',
    });
    const { result: count } = await incrRes.json() as { result: number };

    if (count === 1) {
      await fetch(`${upstashUrl}/EXPIRE/${key}/${RATE_LIMIT.WINDOW_SECONDS}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: 'no-store',
      });
    }

    return {
      allowed: count <= RATE_LIMIT.MAX_REQUESTS,
      remaining: Math.max(0, RATE_LIMIT.MAX_REQUESTS - count),
      resetIn: windowMs,
    };
  } catch (error) {
    console.error('[Middleware RateLimit] Upstash error, failing open');
    return { allowed: true, remaining: RATE_LIMIT.MAX_REQUESTS, resetIn: windowMs };
  }
}

// In-memory fallback
interface RateLimitEntry { count: number; resetTime: number }
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkInMemoryRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
    return { allowed: true, remaining: RATE_LIMIT.MAX_REQUESTS, resetIn: 0 };
  }

  const now = Date.now();
  const windowMs = RATE_LIMIT.WINDOW_SECONDS * 1000;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: RATE_LIMIT.MAX_REQUESTS - 1, resetIn: windowMs };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= RATE_LIMIT.MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT.MAX_REQUESTS - entry.count),
    resetIn: Math.max(0, entry.resetTime - now)
  };
}

function getClientIP(request: NextRequest): string {
  const ip = (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip')
  );

  if (!ip || ip === '::1' || ip === '127.0.0.1') return 'localhost';
  return ip;
}

// ==================== MAIN MIDDLEWARE ====================

export default NextAuth(authConfig).auth(async (req) => {
  const request = req as unknown as NextRequest;
  const clientIP = getClientIP(request);

  const rl = (await checkUpstashRateLimit(clientIP)) ?? checkInMemoryRateLimit(clientIP);
  const { allowed, remaining, resetIn } = rl;
  const resetInSeconds = Math.ceil(resetIn / 1000);

  // X-RateLimit-Policy: lets monitoring distinguish which storage backend is active
  const policy = isUpstashConfigured ? 'upstash-fixed-window' : 'in-memory-dev-fixed-window';

  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT.MAX_REQUESTS),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Date.now() + resetIn), // epoch-ms (not HTTP-date)
    'X-RateLimit-Policy': policy,
  };

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Please wait ${resetInSeconds} seconds before trying again.`,
        retryAfter: resetInSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(resetInSeconds),
          ...rateLimitHeaders,
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const response = NextResponse.next();
  Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
});

// ==================== MATCHER CONFIG ====================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};