import type { NextAuthConfig } from 'next-auth';
import { db } from '@/lib/db';
import type { Permission } from '@prisma/client';

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
 * Auto-provisions shop, role, and membership for new users.
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

  // No membership found - check if user owns a shop (legacy or new)
  let shop = await db.shop.findUnique({
    where: { userId },
  });

  // Auto-create shop for new users
  if (!shop) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const shopName = user?.name ? `${user.name}'s Shop` : `Shop ${user?.email?.split('@')[0] || 'New'}`;
    
    shop = await db.shop.create({
      data: {
        name: shopName,
        userId: userId,
      },
    });
    console.log(`[RBAC] Auto-created shop for user ${userId}`);
  }

  // Find or create Owner role for this shop
  let ownerRole = await db.role.findFirst({
    where: {
      shopId: shop.id,
      isSystem: true,
      name: 'Owner',
    },
  });

  if (!ownerRole) {
    ownerRole = await db.role.create({
      data: {
        name: 'Owner',
        description: 'เจ้าของร้าน - มีสิทธิ์ทั้งหมด',
        permissions: ALL_PERMISSIONS,
        isSystem: true,
        isDefault: false,
        shopId: shop.id,
      },
    });
    console.log(`[RBAC] Auto-created Owner role for shop ${shop.id}`);
  }

  // Create ShopMember record
  await db.shopMember.create({
    data: {
      userId: userId,
      shopId: shop.id,
      roleId: ownerRole.id,
      isOwner: true,
    },
  });
  console.log(`[RBAC] Auto-created ShopMember for user ${userId}`);

  return {
    shopId: shop.id,
    roleId: ownerRole.id,
    permissions: ownerRole.permissions,
    isOwner: true,
  };
}

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') || 
                            nextUrl.pathname.startsWith('/products') ||
                            nextUrl.pathname.startsWith('/purchases') || 
                            nextUrl.pathname.startsWith('/sales') ||
                            nextUrl.pathname.startsWith('/expenses') ||
                            nextUrl.pathname.startsWith('/customers') ||
                            nextUrl.pathname.startsWith('/suppliers') ||
                            nextUrl.pathname.startsWith('/reports') ||
                            nextUrl.pathname.startsWith('/settings') ||
                            nextUrl.pathname.startsWith('/pos');

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // Redirect authed users away from login/register
        if (nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register')) {
           return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        
        // Fetch RBAC data on login
        const membership = await getActiveShopMembership(user.id);
        if (membership) {
          token.shopId = membership.shopId;
          token.roleId = membership.roleId ?? undefined;
          token.permissions = membership.permissions;
          token.isOwner = membership.isOwner;
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
  providers: [], // Providers defined in auth.ts
} satisfies NextAuthConfig;
