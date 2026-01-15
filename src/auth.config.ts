import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe auth configuration.
 * This file is imported by middleware and must NOT contain Prisma or heavy dependencies.
 * 
 * The jwt and session callbacks with RBAC logic are defined in auth.ts instead.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    // Session callback is needed here for Middleware to access custom fields (shopId, roleId, etc.)
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.shopId = token.shopId as string | undefined;
        session.user.roleId = token.roleId as string | undefined;
        // Note: permissions might be large, be careful if header size limits hit. 
        // For middleware checks, we mainly need simple flags, but let's map it all for consistency.
        session.user.permissions = token.permissions as any; 
        session.user.isOwner = token.isOwner as boolean | undefined;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const hasShop = !!auth?.user?.shopId;
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
      const isOnOnboarding = nextUrl.pathname.startsWith('/onboarding');

      if (isOnDashboard) {
        if (!isLoggedIn) return false;
        // If logged in but no shop (and not auto-provisioned), redirect to onboarding
        if (!hasShop) {
          return Response.redirect(new URL('/onboarding', nextUrl));
        }
        return true;
      } else if (isOnOnboarding) {
        if (!isLoggedIn) return false;
        // If already has shop, redirect to dashboard
        if (hasShop) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      } else if (isLoggedIn) {
        // Redirect authed users away from login/register
        if (nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register')) {
           return Response.redirect(new URL(hasShop ? '/dashboard' : '/onboarding', nextUrl));
        }
      }
      return true;
    },
  },
  providers: [], // Providers defined in auth.ts
} satisfies NextAuthConfig;
