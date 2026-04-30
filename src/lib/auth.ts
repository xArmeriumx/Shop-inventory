import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import type { Permission } from '@prisma/client';
import { authConfig } from '@/auth.config';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/rate-limit';

const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  analytics: true,
  prefix: 'erp:ratelimit:login',
});

// All permissions for auto-created Owner role
const ALL_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_VIEW_PROFIT', 'SALE_CANCEL',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_VOID',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE',
  'REPORT_VIEW_SALES', 'REPORT_VIEW_SALES', 'REPORT_EXPORT',
  'SETTINGS_SHOP', 'SETTINGS_SHOP',
  'SETTINGS_ROLES', 'SETTINGS_ROLES', 'SETTINGS_ROLES', 'SETTINGS_ROLES',
  'POS_ACCESS',
  'SHIPMENT_VIEW', 'SHIPMENT_CREATE', 'SHIPMENT_EDIT',
];

/**
 * Get the active shop membership for a user.
 * Returns null if user has no active shop membership.
 */
async function getActiveShopMembership(userId: string) {
  try {
    // First, try to find existing membership deterministically (oldest first)
    const membership = await db.shopMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: {
        role: {
          select: {
            id: true,
            permissions: true,
          },
        },
        shop: {
          select: { id: true },
        },
      },
    });

    if (membership) {
      return {
        shopId: membership.shop.id,
        roleId: membership.role?.id,
        permissions: membership.role?.permissions ?? [],
        isOwner: membership.isOwner,
        permissionVersion: membership.permissionVersion,
      };
    }

    return null;
  } catch (error) {
    console.error('[Auth] getActiveShopMembership error:', error);
    return null;
  }
}

/**
 * Get the session version for a user (from DB)
 */
async function getSessionVersion(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true }
  });
  return user?.sessionVersion ?? 1;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user, trigger, session }) => {
      // Refresh permissions if:
      // 1. Initial sign in (user exists)
      // 2. Client requested update (trigger === 'update')
      // 3. Token is missing shopId (stale)

      const userId = (token.sub as string) || (token.id as string) || (user?.id as string);
      if (!userId) return token;

      // 1. Initial Sign-in or forced update
      const isInitialSignIn = !!user;
      const isForcedUpdate = trigger === 'update';
      const isMissingShop = !token.shopId;

      if (isInitialSignIn || isForcedUpdate || isMissingShop) {
        if (user) {
          token.id = user.id;
        }

        // Fetch fresh RBAC data
        const membership = await getActiveShopMembership(userId);

        if (membership) {
          token.shopId = membership.shopId;
          token.roleId = membership.roleId ?? undefined;
          token.permissions = membership.permissions;
          token.isOwner = membership.isOwner;
          token.permissionVersion = membership.permissionVersion; // Store version
        } else {
          // Clear if no membership
          delete token.shopId;
          delete token.roleId;
          delete token.permissions;
          delete token.isOwner;
          delete token.permissionVersion;
        }

        token.sessionVersion = await getSessionVersion(userId);
      }
      // 2. Incremental Version Check (Only if we HAVE a shopId and permissions)
      else if (token.shopId) {
        // Compare versions to detect out-of-sync permissions
        const currentMember = await db.shopMember.findFirst({
          where: { userId, shopId: token.shopId as string },
          select: { permissionVersion: true }
        });

        if (currentMember && currentMember.permissionVersion !== token.permissionVersion) {
          console.log(`[Auth] Permission version mismatch (Token: ${token.permissionVersion}, DB: ${currentMember.permissionVersion}). Refreshing...`);
          const membership = await getActiveShopMembership(userId);
          if (membership) {
            token.permissions = membership.permissions;
            token.isOwner = membership.isOwner;
            token.roleId = membership.roleId ?? undefined;
            token.permissionVersion = membership.permissionVersion;
          }
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        // Pass essential flags to session (Pruned)
        session.user.shopId = token.shopId as string | undefined;
        session.user.isOwner = token.isOwner as boolean | undefined;
        // Role ID might be useful for some UI logic
        session.user.roleId = token.roleId as string | undefined;

        // Add session version for revocation checks
        session.user.sessionVersion = token.sessionVersion as number | undefined;

        // IMPORTANT: permissions are NOT passed to the client session anymore
        // to prevent RBAC model exposure. Use Server Actions or API routes for checks.
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;

        // Rate limit by email to prevent brute-force attacks
        const { success } = await loginLimiter.limit(email.toLowerCase());
        if (!success) {
          console.warn('[Auth] Sign-in rate limited', { email });
          throw new Error('บัญชีนี้ถูกระงับการเข้าสู่ระบบชั่วคราว กรุณาลองใหม่ในอีก 5 นาที');
        }

        try {
          const user = await db.user.findUnique({
            where: { email },
          });

          if (!user) {
            console.warn('[Auth] Sign-in failed: User not found', { email: credentials.email });
            return null;
          }

          if (!user.password) {
            console.warn('[Auth] Sign-in failed: User has no password (OAuth account?)', { email: credentials.email });
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            console.warn('[Auth] Sign-in failed: Incorrect password', { email: credentials.email });
            return null;
          }

          console.log('[Auth] Sign-in successful', { userId: user.id });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error('[Auth] Authorize error:', error);
          return null;
        }
      },
    }),
  ],
});

