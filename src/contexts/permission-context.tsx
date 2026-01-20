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
import { getMyPermissions, getPermissionVersion, type PermissionData } from '@/actions/auth';

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

// ============================================================================
// TYPES
// ============================================================================

interface PermissionContextValue {
  // State
  permissions: Permission[];
  isOwner: boolean;
  shopId: string | undefined;
  roleId: string | undefined;
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
export function PermissionProvider({ children }: PermissionProviderProps) {
  const { data: session, status } = useSession();

  // -------------------------------------------------------------------------
  // Refs for tracking state without causing re-renders
  // -------------------------------------------------------------------------
  const cachedVersionRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef(false);

  // -------------------------------------------------------------------------
  // Permission State
  // -------------------------------------------------------------------------
  
  /**
   * Initialize state from session JWT if available
   * This prevents an unnecessary initial fetch since JWT already contains permissions
   */
  const [permissionData, setPermissionData] = useState<PermissionData>(() => {
    if (!session?.user) return null;
    return {
      shopId: session.user.shopId as string,
      roleId: session.user.roleId,
      permissions: (session.user.permissions ?? []) as Permission[],
      isOwner: session.user.isOwner ?? false,
      version: 0, // Will be updated on first poll
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
    if (!isMountedRef.current) return;

    try {
      const freshData = await getMyPermissions();

      if (!isMountedRef.current) return;

      if (freshData) {
        cachedVersionRef.current = freshData.version;
        setPermissionData((prev) => {
          // Only update if data actually changed (prevent unnecessary re-renders)
          if (JSON.stringify(prev) === JSON.stringify(freshData)) {
            return prev;
          }
          return freshData;
        });
      }
    } catch (error) {
      console.error('[PermissionContext] Failed to fetch permissions:', error);
    }
  }, []);

  /**
   * Lightweight version check
   * Only fetches the version number, not full permissions
   * If version changed, triggers full fetch
   */
  const checkVersionAndRefresh = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      const versionData = await getPermissionVersion();

      if (!isMountedRef.current) return;

      if (versionData && versionData.version !== cachedVersionRef.current) {
        console.log('[PermissionContext] Version changed, refreshing permissions...');
        await fetchFullPermissions();
      }
      // else: Version same, skip expensive fetch ✓
    } catch (error) {
      console.error('[PermissionContext] Failed to check version:', error);
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

  // -------------------------------------------------------------------------
  // Main Effect: Initialize and Start Polling
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (status !== 'authenticated') {
      // Not authenticated - clear data and stop polling
      if (status !== 'loading') {
        setPermissionData(null);
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
    if (!permissionData && session?.user) {
      const sessionPermissions = (session.user.permissions ?? []) as Permission[];
      
      setPermissionData({
        shopId: session.user.shopId as string,
        roleId: session.user.roleId,
        permissions: sessionPermissions,
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
  }, [status, session, startPolling, stopPolling, permissionData]);

  // -------------------------------------------------------------------------
  // Memoized Permission Helpers
  // -------------------------------------------------------------------------

  const permissions = useMemo(
    () => permissionData?.permissions ?? [],
    [permissionData?.permissions]
  );

  const isOwner = permissionData?.isOwner ?? false;
  const shopId = permissionData?.shopId;
  const roleId = permissionData?.roleId;

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
      isOwner,
      shopId,
      roleId,
      isLoading: status === 'loading' && !permissionData,
      isAuthenticated: status === 'authenticated',
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions,
    }),
    [
      permissions,
      isOwner,
      shopId,
      roleId,
      status,
      permissionData,
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
