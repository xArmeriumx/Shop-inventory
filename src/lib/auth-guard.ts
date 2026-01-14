import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * Get current user session, redirect to login if not authenticated
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return session.user;
}

/**
 * Get current user ID, throw if not authenticated
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user.id;
}

/**
 * Check if user is authenticated without redirecting
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.id;
}
