import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import type { Permission } from '@prisma/client';
import { db } from '@/lib/db';

// ============================================================================
// SESSION FRESHNESS CHECK
// ============================================================================

/**
 * Validates that the JWT token's sessionVersion matches the DB.
 * If the DB version is higher, the user has been revoked and must re-login.
 * 
 * Called in `withAuth` when `checkFreshness: true` is set.
 */
async function isSessionFresh(userId: string, jwtVersion: number | undefined): Promise<boolean> {
  if (jwtVersion === undefined) return true; // No version = legacy token, allow (graceful)

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });

  return user?.sessionVersion === jwtVersion;
}

// ============================================================================
// WITH AUTH WRAPPER
// ============================================================================

/**
 * Unified API Wrapper for Authentication and Authorization.
 * Simplifies session checking and standardizes error responses.
 * 
 * @example Basic auth:
 * export const POST = withAuth(async (req, session) => { ... });
 * 
 * @example With permission + freshness check:
 * export const POST = withAuth(handler, {
 *   permission: 'SALE_CREATE',
 *   checkFreshness: true,
 * });
 */
export function withAuth(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>,
  options: {
    permission?: Permission;
    /** If true, validates sessionVersion against DB (revocation check). Use for sensitive routes. */
    checkFreshness?: boolean;
  } = {}
) {
  return async (req: NextRequest) => {
    try {
      const session = await auth();

      // 1. Authentication Check
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }

      // 2. Session Freshness Check (Revocation support via sessionVersion)
      if (options.checkFreshness) {
        const jwtVersion = (session.user as any).sessionVersion as number | undefined;
        const fresh = await isSessionFresh(session.user.id, jwtVersion);
        if (!fresh) {
          return NextResponse.json(
            { success: false, error: 'Session revoked. Please sign in again.', code: 'SESSION_REVOKED' },
            { status: 401 }
          );
        }
      }

      // 3. Authorization Check (if permission required)
      if (options.permission) {
        const userPermissions = (session.user as any).permissions || [];
        const isOwner = (session.user as any).isOwner || false;

        const hasPermission = isOwner || userPermissions.includes(options.permission);

        if (!hasPermission) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Missing permission', code: 'UNAUTHORIZED' },
            { status: 403 }
          );
        }
      }

      // 4. Shop Scope Check (multi-tenant safety net)
      if (!(session.user as any).shopId && !(session.user as any).isOwner) {
        return NextResponse.json(
          { success: false, error: 'Shop membership required', code: 'ONBOARDING_REQUIRED' },
          { status: 403 }
        );
      }

      return await handler(req, session);
    } catch (error: any) {
      console.error('[API Guard Error]', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  };
}
