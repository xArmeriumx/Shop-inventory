import crypto from 'crypto';
import { redis } from '@/lib/rate-limit';

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback_secret_for_dev_only_123';
const TOKEN_TTL_SECONDS = 300; // 5 minutes

// In-memory fallback for Dev/Test if Redis is disabled
const fallbackStore = new Map<string, number>();

export interface ToolConfirmationPayload {
  jti: string;
  toolName: string;
  paramsHash: string;
  userId: string;
  shopId: string;
  exp: number;
}

/**
 * Hash tool parameters predictably
 */
export function hashToolParams(params: any): string {
  const normalizedStr = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(normalizedStr).digest('hex');
}

/**
 * Sign payload to ensure integrity
 */
function signPayload(payloadBase64: string): string {
  return crypto.createHmac('sha256', AUTH_SECRET).update(payloadBase64).digest('base64url');
}

/**
 * Create a new signed one-time confirmation token
 */
export async function createConfirmationToken(
  toolName: string,
  params: any,
  context: { userId: string; shopId: string }
): Promise<string> {
  const jti = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  
  const payload: ToolConfirmationPayload = {
    jti,
    toolName,
    paramsHash: hashToolParams(params),
    userId: context.userId,
    shopId: context.shopId,
    exp,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(payloadBase64);
  const token = `${payloadBase64}.${signature}`;

  // Store JTI in Redis (or fallback)
  if (redis && typeof redis.setex === 'function') {
    await redis.setex(`erp:ai:confirm:${jti}`, TOKEN_TTL_SECONDS, '1');
  } else if (redis && typeof redis.set === 'function') {
    await redis.set(`erp:ai:confirm:${jti}`, '1', { ex: TOKEN_TTL_SECONDS });
  } else {
    // Fallback
    if (process.env.NODE_ENV === 'production') {
      console.warn('WARN: Using in-memory tool confirmation store in production!');
    }
    fallbackStore.set(jti, Date.now() + TOKEN_TTL_SECONDS * 1000);
  }

  return token;
}

/**
 * Verify a confirmation token and consume it (One-Time Use)
 */
export async function verifyAndConsumeConfirmation(
  token: string,
  toolName: string,
  params: any,
  context: { userId: string; shopId: string }
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadBase64, signature] = parts;

  // 1. Verify Signature
  const expectedSignature = signPayload(payloadBase64);
  if (signature !== expectedSignature) {
    return false;
  }

  try {
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload: ToolConfirmationPayload = JSON.parse(payloadStr);

    // 2. Verify Expiration
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return false;
    }

    // 3. Verify Context Matches
    if (
      payload.toolName !== toolName ||
      payload.userId !== context.userId ||
      payload.shopId !== context.shopId ||
      payload.paramsHash !== hashToolParams(params)
    ) {
      return false;
    }

    // 4. Consume JTI
    let jtiExists = false;
    if (redis && typeof redis.del === 'function') {
      // Check and delete atomically if we could use a lua script, but since redis might be upstash,
      // del returns the number of keys removed. If 1, it existed and was consumed.
      const deletedCount = await redis.del(`erp:ai:confirm:${payload.jti}`);
      jtiExists = deletedCount > 0;
    } else {
      // Fallback
      if (fallbackStore.has(payload.jti)) {
        if (Date.now() <= fallbackStore.get(payload.jti)!) {
          jtiExists = true;
        }
        fallbackStore.delete(payload.jti);
      }
    }

    return jtiExists;

  } catch (e) {
    return false;
  }
}
