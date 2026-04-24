'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import type { Permission } from '@prisma/client';
import { getMyPermissions, getPermissionVersion, type PermissionData } from '@/actions/core/auth.actions';
import { logger, SystemEventType } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** 
 * Polling interval for permission version checks (in milliseconds)
 * Using 30 seconds as a balance between real-time updates and server load
 */
const POLLING_INTERVAL = 30_000;

/**
 * Delay before starting the first poll after initial load
 * This prevents immediate duplicate fetches after page load
 */
const INITIAL_POLL_DELAY = 5_000;

/**
 * Public routes that do NOT trigger the logout guardian redirect.
 * This prevents redirect loops and allows users to re-login.
 */
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/onboarding'];

// ============================================================================
// TYPES
// ============================================================================

export type PermissionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface PermissionContextValue {
  // State
  permissions: Permission[];
  roles: string[];
  isOwner: boolean;
  shopId: string | undefined;
  roleId: string | undefined;
  status: PermissionStatus;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Permission check helpers
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;

  // Manual refresh trigger
  refreshPermissions: () => Promise<void>;
}

interface PermissionProviderProps {
  children: ReactNode;
}

// ============================================================================
// CONTEXT
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

/**
 * PermissionProvider - Centralized RBAC State Management
 * 
 * This provider handles ALL permission-related state and polling in ONE place.
 * All components that need permission data should use the `usePermissions` hook,
 * which reads from this context.
 * 
 * Key features:
 * - Single polling instance for the entire application
 * - Version-based smart polling (only fetches full data when permissions change)
 * - Tab visibility awareness (pauses polling when tab is hidden)
 * - Immediate initial data from JWT session (no initial fetch needed)
 * - Clean cleanup on unmount
 * 
 * Mount this provider ONCE at the dashboard layout level.
 */
const EMPTY_DATA = {
  shopId: undefined,
  roleId: undefined,
  permissions: [],
  roles: [],
  isOwner: false,
  version: 0,
};

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { data: session, status } = useSession();

  // -------------------------------------------------------------------------
  // Refs for tracking state without causing re-renders
  // -------------------------------------------------------------------------
  const cachedVersionRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef(false);

  // Transition memory for Logout Guardian (Phase 1)
  const prevStatusRef = useRef<PermissionStatus>('loading');
  const isRedirectingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const hasBeenAuthenticatedRef = useRef(false);

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>(() => {
    // Phase 2 Baseline: If we have a session, trust it as authenticated immediately
    return session?.user ? 'authenticated' : 'loading';
  });

  const [permissionData, setPermissionData] = useState<{
    shopId: string | undefined;
    roleId: string | undefined;
    permissions: Permission[];
    roles: string[];
    isOwner: boolean;
    version: number;
  }>(() => {
    // Initial normalization from session
    if (!session?.user) return EMPTY_DATA;

    const permissions = Array.isArray(session?.user?.permissions)
      ? (session.user.permissions as Permission[])
      : [];

    return {
      shopId: session?.user?.shopId as string | undefined,
      roleId: session?.user?.roleId,
      permissions,
      roles: session?.user?.roleId ? [session.user.roleId] : [],
      isOwner: session?.user?.isOwner ?? false,
      version: 0,
    };
  });

  // -------------------------------------------------------------------------
  // Data Fetching Functions
  // -------------------------------------------------------------------------

  /**
   * Fetch full permissions data from the server
   * This is the "expensive" operation - only called when version changes
   */
  const fetchFullPermissions = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current || isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
      const response = await getMyPermissions();

      if (!isMountedRef.current) return;

      if (!response.ok) {
        if (response.error?.kind === 'AUTH_FAILURE') {
          setPermissionStatus('unauthenticated');
        }
        // TRANSIENT_ERROR: keep current status, will retry on next poll
        return;
      }

      const { data } = response;
      if (!data) return;

      cachedVersionRef.current = data.version;
      setPermissionStatus('authenticated');

      const normalizedData = {
        shopId: data.shopId,
        roleId: data.roles[0],
        permissions: Array.isArray(data.permissions) ? (data.permissions as Permission[]) : [],
        roles: Array.isArray(data.roles) ? data.roles : [],
        isOwner: data.isOwner,
        version: data.version,
      };

      setPermissionData((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(normalizedData)) return prev;
        return normalizedData;
      });
    } catch (error) {
      console.error('[PermissionContext] Failed to fetch permissions:', error);
      // We don't set 'error' status here to avoid UI flickering 
      // as long as it's not a confirmed auth failure
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const checkVersionAndRefresh = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current || isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
      const response = await getPermissionVersion();

      if (!isMountedRef.current) return;

      if (response && !response.ok) {
        if (response.kind === 'AUTH_FAILURE') {
          setPermissionStatus('unauthenticated');
        }
        return;
      }

      if (response && response.ok && response.version !== cachedVersionRef.current) {
        console.log('[PermissionContext] Version changed, refreshing permissions...');
        // Release lock before calling fetch which has its own lock
        isRefreshingRef.current = false;
        await fetchFullPermissions();
      }
    } catch (error) {
      console.error('[PermissionContext] Failed to check version:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [fetchFullPermissions]);

  // -------------------------------------------------------------------------
  // Polling Logic (Single Instance)
  // -------------------------------------------------------------------------

  /**
   * Schedule the next poll
   * Uses recursive setTimeout pattern to prevent request pile-up
   */
  const scheduleNextPoll = useCallback(() => {
    if (!isMountedRef.current || !isPollingActiveRef.current) return;

    // Clear any existing timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    pollingTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current || !isPollingActiveRef.current) return;

      // Check version (lightweight)
      await checkVersionAndRefresh();

      // Schedule next poll AFTER current one completes
      scheduleNextPoll();
    }, POLLING_INTERVAL);
  }, [checkVersionAndRefresh]);

  /**
   * Start polling
   * Called when tab becomes visible or on initial mount
   */
  const startPolling = useCallback(() => {
    if (isPollingActiveRef.current) return; // Already polling

    isPollingActiveRef.current = true;
    console.log('[PermissionContext] Polling started');
    scheduleNextPoll();
  }, [scheduleNextPoll]);

  /**
   * Stop polling
   * Called when tab becomes hidden or on unmount
   */
  const stopPolling = useCallback(() => {
    isPollingActiveRef.current = false;

    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    console.log('[PermissionContext] Polling stopped');
  }, []);

  // -------------------------------------------------------------------------
  // Visibility Change Handler
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Tab visible again - check immediately then resume polling
        checkVersionAndRefresh();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startPolling, stopPolling, checkVersionAndRefresh]);

  // Sync internal status with NextAuth session status (The Truth)
  useEffect(() => {
    if (status === 'unauthenticated') {
      setPermissionStatus('unauthenticated');
    } else if (status === 'authenticated' && permissionStatus === 'loading') {
      // Recovery for cases where session becomes valid after mount
      setPermissionStatus('authenticated');
    }
  }, [status, permissionStatus]);

  // PHASE 3: LOGOUT GUARDIAN
  useEffect(() => {
    const currentStatus = permissionStatus;
    const prevStatus = prevStatusRef.current;

    // Update "History of Auth" to prevent hydration false-positives
    if (currentStatus === 'authenticated' && status === 'authenticated') {
      hasBeenAuthenticatedRef.current = true;
    }

    // Trigger if (Previously Authenticated) AND (Now Unauthenticated)
    // This looks at both truth sources: NextAuth status or permissionStatus (revocation)
    const isRevoked = hasBeenAuthenticatedRef.current && (currentStatus === 'unauthenticated' || status === 'unauthenticated');

    if (isRevoked && !isRedirectingRef.current && status !== 'loading') {
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route) || pathname === route);

      if (!isPublicRoute) {
        isRedirectingRef.current = true;

        // One-shot telemetry before redirect
        logger.trackEvent(SystemEventType.AUTH_TRANSITION_RECOVERY, {
          source: 'PermissionProvider',
          message: 'Session revoked; Redirecting to /login.',
          pathname,
          metadata: { permissionStatus: currentStatus, sessionStatus: status }
        }).finally(() => {
          window.location.replace('/login');
        });
      }
    }

    prevStatusRef.current = currentStatus;
  }, [permissionStatus, status]);

  // -------------------------------------------------------------------------
  // Main Effect: Initialize and Start Polling
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (status !== 'authenticated') {
      // Not authenticated - clear data and stop polling
      if (status !== 'loading') {
        setPermissionData(EMPTY_DATA);
      }
      stopPolling();
      return;
    }

    isMountedRef.current = true;

    // =========================================================================
    // PHASE 2 OPTIMIZATION: Trust JWT Session Data
    // =========================================================================
    // The JWT token already contains permissions from the server (auth.ts callback).
    // We trust this data initially and DON'T fetch from DB immediately.
    // This reduces initial page load from 2 requests to 0 requests.
    // Polling will sync any changes within 30 seconds.
    // =========================================================================

    // Initialize from session if we don't have data yet
    if (permissionData === EMPTY_DATA && session?.user) {
      const sessionPermissions = (session.user.permissions ?? []) as Permission[];

      setPermissionData({
        shopId: session.user.shopId as string,
        roleId: session.user.roleId,
        permissions: sessionPermissions,
        roles: session.user.roleId ? [session.user.roleId] : [],
        isOwner: session.user.isOwner ?? false,
        version: 0, // Unknown version, will be synced on first poll
      });

      // If session has permissions, we trust them and skip initial fetch
      // The version will be updated on the first poll cycle
      console.log('[PermissionContext] Initialized from JWT session (trusted)');
    }

    // Start polling after initial delay
    // First poll will sync version and refresh if needed
    const initialPollTimer = setTimeout(() => {
      if (isMountedRef.current && !document.hidden) {
        startPolling();
      }
    }, INITIAL_POLL_DELAY);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearTimeout(initialPollTimer);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, startPolling, stopPolling]);

  // -------------------------------------------------------------------------
  // Memoized Permission Helpers
  // -------------------------------------------------------------------------

  const permissions = useMemo(
    () => Array.isArray(permissionData.permissions) ? permissionData.permissions : [],
    [permissionData.permissions]
  );

  const roles = useMemo(
    () => Array.isArray(permissionData.roles) ? permissionData.roles : [],
    [permissionData.roles]
  );

  const isOwner = permissionData.isOwner;
  const shopId = permissionData.shopId;
  const roleId = permissionData.roleId;

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (isOwner) return true;
      return permissions.includes(permission);
    },
    [permissions, isOwner]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]): boolean => {
      if (isOwner) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, isOwner]
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]): boolean => {
      if (isOwner) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions, isOwner]
  );

  const refreshPermissions = useCallback(async () => {
    await fetchFullPermissions();
  }, [fetchFullPermissions]);

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------

  const contextValue = useMemo<PermissionContextValue>(
    () => ({
      permissions,
      roles,
      isOwner,
      shopId,
      roleId,
      status: permissionStatus === 'loading' && status === 'authenticated' ? 'loading' : permissionStatus,
      isLoading: (status === 'loading' || permissionStatus === 'loading') && status !== 'unauthenticated',
      isAuthenticated: status === 'authenticated' && permissionStatus === 'authenticated',
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions,
    }),
    [
      permissions,
      roles,
      isOwner,
      shopId,
      roleId,
      status,
      permissionStatus,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions,
    ]
  );

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * usePermissionContext - Internal hook to access the permission context
 * 
 * Note: This is for internal use by the usePermissions hook.
 * Components should use `usePermissions` instead.
 */
export function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error(
      'usePermissionContext must be used within a PermissionProvider. ' +
      'Make sure PermissionProvider is mounted at the layout level.'
    );
  }

  return context;
}

/**
 * Check if PermissionProvider is available
 * Used by usePermissions to gracefully handle cases where provider is not mounted
 */
export function useIsPermissionProviderMounted(): boolean {
  const context = useContext(PermissionContext);
  return context !== null;
}
