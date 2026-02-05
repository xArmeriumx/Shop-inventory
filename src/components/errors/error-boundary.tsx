'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * 
 * จับ errors ใน component tree และแสดง fallback UI
 * 
 * @example
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <ErrorFallback 
          error={this.state.error} 
          reset={this.reset} 
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error Fallback UI
 */
interface ErrorFallbackProps {
  error?: Error | null;
  reset?: () => void;
  variant?: 'full-page' | 'inline' | 'card';
}

export function ErrorFallback({ 
  error, 
  reset, 
  variant = 'card' 
}: ErrorFallbackProps) {
  if (variant === 'full-page') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">😵</div>
          <h1 className="text-2xl font-bold mb-2">เกิดข้อผิดพลาด</h1>
          <p className="text-muted-foreground mb-4">
            ขออภัย เกิดข้อผิดพลาดที่ไม่คาดคิด
          </p>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg mb-4 font-mono break-all">
              {error.message}
            </p>
          )}
          <div className="flex gap-2 justify-center">
            {reset && (
              <button
                onClick={reset}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                ลองใหม่
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80"
            >
              รีเฟรชหน้า
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
        <span>⚠️</span>
        <span>เกิดข้อผิดพลาด</span>
        {reset && (
          <button 
            onClick={reset}
            className="ml-auto text-sm underline hover:no-underline"
          >
            ลองใหม่
          </button>
        )}
      </div>
    );
  }

  // Default: card variant
  return (
    <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-6 text-center">
      <div className="text-4xl mb-2">⚠️</div>
      <h3 className="font-semibold mb-1">เกิดข้อผิดพลาด</h3>
      <p className="text-sm text-muted-foreground mb-3">
        ไม่สามารถโหลดข้อมูลได้
      </p>
      {error && (
        <p className="text-xs text-destructive bg-background p-2 rounded mb-3 font-mono">
          {error.message}
        </p>
      )}
      <div className="flex gap-2 justify-center">
        {reset && (
          <button
            onClick={reset}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            ลองใหม่
          </button>
        )}
      </div>
    </div>
  );
}
