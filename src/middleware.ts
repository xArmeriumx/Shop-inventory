'use server';

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ==================== RATE LIMITER ====================
// Protects the app from bots and spam attacks.
// Allows normal users (1-2 clicks/sec) but blocks rapid automated requests.

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage for tracking IP requests
const rateLimitMap = new Map<string, RateLimitEntry>();

// SETTINGS (adjust as needed)
const RATE_LIMIT = {
  MAX_REQUESTS: 30,         // Max requests allowed per window
  WINDOW_MS: 15 * 1000,     // Time window: 15 seconds
  CLEANUP_INTERVAL: 60000,  // Clean old entries every 60 seconds
};

// Cleanup expired entries to prevent memory leak
let lastCleanup = Date.now();
function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT.CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  rateLimitMap.forEach((entry, ip) => {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  });
}

// Extract client IP from request headers (supports Vercel, Cloudflare, etc.)
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

// Check if request is within rate limit
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  // Case 1: New IP or window expired - reset counter
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT.WINDOW_MS,
    });
    return { allowed: true, remaining: RATE_LIMIT.MAX_REQUESTS - 1, resetIn: RATE_LIMIT.WINDOW_MS };
  }
  
  // Case 2: Existing IP within window - increment counter
  entry.count += 1;
  
  if (entry.count > RATE_LIMIT.MAX_REQUESTS) {
    // BLOCKED: Over limit
    const resetIn = Math.max(0, entry.resetTime - now);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  // ALLOWED: Still within limit
  return { 
    allowed: true, 
    remaining: RATE_LIMIT.MAX_REQUESTS - entry.count,
    resetIn: entry.resetTime - now 
  };
}

// ==================== MAIN MIDDLEWARE ====================

export default NextAuth(authConfig).auth((req) => {
  const request = req as unknown as NextRequest;
  
  // Step 1: Cleanup old entries periodically
  cleanupExpiredEntries();
  
  // Step 2: Get client IP
  const clientIP = getClientIP(request);
  
  // Step 3: Check rate limit
  const { allowed, remaining, resetIn } = checkRateLimit(clientIP);
  
  if (!allowed) {
    // BLOCKED: Return 429 Too Many Requests
    const resetInSeconds = Math.ceil(resetIn / 1000);
    
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
          'X-RateLimit-Limit': String(RATE_LIMIT.MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetIn / 1000)),
        },
      }
    );
  }
  
  // ALLOWED: Continue with rate limit headers
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT.MAX_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  
  return response;
});

// ==================== MATCHER CONFIG ====================
// Apply rate limiting to all routes except static files

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
