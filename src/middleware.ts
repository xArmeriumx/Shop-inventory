import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Public routes
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isPublicRoute = pathname === '/' || pathname.startsWith('/api/auth');

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Protect dashboard routes
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                           pathname.startsWith('/products') ||
                           pathname.startsWith('/purchases') ||
                           pathname.startsWith('/sales') ||
                           pathname.startsWith('/expenses') ||
                           pathname.startsWith('/reports') ||
                           pathname.startsWith('/settings') ||
                           pathname.startsWith('/customers') ||
                           pathname.startsWith('/suppliers');

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
