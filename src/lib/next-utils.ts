/**
 * Detects if an error is a specific Next.js "Dynamic Server Usage" error.
 * This error is triggered during static generation (build-time) when dynamic 
 * functions like headers() or cookies() are called. 
 * 
 * We identify it by its specific 'digest' or message content according to 
 * Next.js 14+ internal behavior.
 */
export function isDynamicServerError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Next.js 14+ standard digest for dynamic usage during SSG
  const digest = (error as any).digest;
  if (digest === 'DYNAMIC_SERVER_USAGE') return true;

  // Fallback check for explicit message content
  if (error.message.includes('Dynamic server usage')) return true;
  
  // NOTE: We do NOT include NEXT_REDIRECT or NEXT_NOT_FOUND here 
  // as they are already handled by Next.js's internal router if they leak.
  // This utility specifically targets build-time noise.

  return false;
}
