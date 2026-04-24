/**
 * Performance metrics collector using AsyncLocalStorage to track request-scoped data.
 */
let storage: any = null;

if (typeof window === 'undefined') {
    try {
        const { AsyncLocalStorage } = require('node:async_hooks');
        storage = new AsyncLocalStorage();
    } catch (e) {
        // Fallback for environments where node:async_hooks is unavailable
    }
}

interface RequestMetrics {
    startTime: number;
    queries: Array<{ sql: string; duration: number }>;
    metadata: Record<string, any>;
}

export const PerformanceCollector = {
    /**
     * Run a function within a fresh metrics context
     */
    async run<T>(fn: () => Promise<T>, key?: string): Promise<T> {
        if (process.env.NODE_ENV === 'production') {
            return fn();
        }

        const metrics: RequestMetrics = {
            startTime: performance.now(),
            queries: [],
            metadata: key ? { action: key } : {},
        };

        if (!storage) return fn();
        return storage.run(metrics, fn);
    },

    /**
     * Record a query execution
     */
    recordQuery(sql: string, duration: number) {
        const store = storage?.getStore() as RequestMetrics | undefined;
        if (store) {
            store.queries.push({ sql, duration });
        }
    },

    /**
     * Add arbitrary metadata to the current request (with truncation for safety)
     */
    setMetadata(key: string, value: any) {
        const store = storage?.getStore() as RequestMetrics | undefined;
        if (store) {
            // Safety: Stringify and truncate large payloads to keep monitoring lean
            let safeValue = value;
            if (typeof value === 'object') {
                const str = JSON.stringify(value);
                if (str.length > 1024) {
                    safeValue = str.substring(0, 1024) + '... [TRUNCATED]';
                }
            } else if (typeof value === 'string' && value.length > 1024) {
                safeValue = value.substring(0, 1024) + '... [TRUNCATED]';
            }
            store.metadata[key] = safeValue;
        }
    },

    /**
     * Summarize current request metrics
     */
    getSummary() {
        const store = storage?.getStore() as RequestMetrics | undefined;
        if (!store) return null;

        const totalDuration = performance.now() - store.startTime;
        return {
            totalDuration: totalDuration.toFixed(2),
            queryCount: store.queries.length,
            totalQueryTime: store.queries.reduce((sum: number, q: { duration: number }) => sum + q.duration, 0).toFixed(2),
            queries: store.queries,
            metadata: store.metadata,
        };
    }
};
