'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/core/errors/error-boundary';

/**
 * Global Error Page
 * 
 * Next.js convention: catches unhandled errors at root level
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (can be replaced with error reporting service)
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <ErrorFallback 
          error={error} 
          reset={reset} 
          variant="full-page" 
        />
      </body>
    </html>
  );
}
