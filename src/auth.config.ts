import type { NextAuthConfig } from 'next-auth';

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
                            nextUrl.pathname.startsWith('/settings');

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
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Providers defined in auth.ts
} satisfies NextAuthConfig;
