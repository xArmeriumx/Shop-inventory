'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { logger, SystemEventType } from '@/lib/logger';

interface Props {
  children: ReactNode;
  /**
   * silent: Render nothing on error (Best for Shell/Layout)
   * compact: Render a small box with icon (Best for Actionable Widgets)
   * inline: Render a small text/icon (Best for Data Labels)
   */
  variant?: 'silent' | 'compact' | 'inline';
  /**
   * Optional name of the component for logging
   */
  componentName?: string;
}

interface State {
  hasError: boolean;
}

export class SafeBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.componentName || 'UnknownComponent';
    
    // SSR-safe pathname detection
    const pathname = typeof window !== 'undefined' ? window.location.pathname : 'ssr';

    console.error(`[SafeBoundary:${componentName}] Caught error:`, error, errorInfo);

    // Operational Observability (Priority 2.5)
    logger.trackEvent(SystemEventType.BOUNDARY_RECOVERY, {
      source: componentName,
      message: error.message || 'Unknown component crash',
      pathname,
      metadata: {
        variant: this.props.variant || 'silent',
        stack_preview: error.stack?.slice(0, 500), // Sanitize long stacks
        component_stack: errorInfo.componentStack?.slice(0, 500)
      }
    });
  }

  public render() {
    if (this.state.hasError) {
      const { variant = 'silent' } = this.props;

      if (variant === 'compact') {
        return (
          <div className="flex items-center gap-2 p-3 text-xs border rounded-md bg-destructive/5 text-destructive border-destructive/20 animate-in fade-in duration-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Component Unavailable</span>
          </div>
        );
      }

      if (variant === 'inline') {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-destructive italic">
            <AlertCircle className="h-3 w-3" />
            Error
          </span>
        );
      }

      // Default: silent (returns null)
      return null;
    }

    return this.props.children;
  }
}
