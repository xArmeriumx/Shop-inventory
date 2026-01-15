import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import type { Permission } from '@prisma/client';

import { authConfig } from '@/auth.config';

// All permissions for auto-created Owner role
const ALL_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_VIEW_PROFIT', 'SALE_CANCEL',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_CANCEL',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_EDIT', 'EXPENSE_DELETE',
  'REPORT_VIEW_SALES', 'REPORT_VIEW_PROFIT', 'REPORT_EXPORT',
  'SETTINGS_SHOP', 'SETTINGS_LOOKUPS',
  'TEAM_VIEW', 'TEAM_INVITE', 'TEAM_EDIT', 'TEAM_REMOVE',
  'POS_ACCESS',
];

/**
 * Get the active shop membership for a user.
 * Returns null if user has no active shop membership.
 */
async function getActiveShopMembership(userId: string) {
  // First, try to find existing membership
  const membership = await db.shopMember.findFirst({
    where: { userId },
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
      roleId: membership.role.id,
      permissions: membership.role.permissions,
      isOwner: membership.isOwner,
    };
  }

  return null;
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
      
      const shouldFetchMembership = 
        !!user || 
        trigger === 'update' || 
        !token.shopId ||
        !token.permissions;

      console.log('JWT Callback:', { 
        hasUser: !!user, 
        trigger, 
        hasShopId: !!token.shopId, 
        sub: token.sub,
        shouldFetch: shouldFetchMembership 
      });

      if (shouldFetchMembership && token.sub) {
        if (user) {
          token.id = user.id;
        }

        const userId = (token.sub as string) || (token.id as string) || user?.id;
        
        // Fetch fresh RBAC data
        const membership = await getActiveShopMembership(userId);

        if (membership) {
          token.shopId = membership.shopId;
          token.roleId = membership.roleId ?? undefined;
          token.permissions = membership.permissions;
          token.isOwner = membership.isOwner;
        } else {
          // Explicitly clear if no membership
          delete token.shopId;
          delete token.roleId;
          delete token.permissions;
          delete token.isOwner;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        // Pass RBAC data to session
        session.user.shopId = token.shopId as string | undefined;
        session.user.roleId = token.roleId as string | undefined;
        session.user.permissions = token.permissions as Permission[] | undefined;
        session.user.isOwner = token.isOwner as boolean | undefined;
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

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});

