
/**
 * QueryMetrics - Lightweight performance tracker for ERP operations
 */
export class QueryMetrics {
    private static startTimes: Map<string, number> = new Map();

    /**
     * Start timing an operation
     */
    static start(key: string) {
        this.startTimes.set(key, performance.now());
    }

    /**
     * End timing and log results
     */
    static end(key: string, metadata: Record<string, any> = {}) {
        const start = this.startTimes.get(key);
        if (!start) return;

        const duration = (performance.now() - start).toFixed(2);

        // Log to console in development
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[PERF] ${key}: ${duration}ms`, metadata);
        }

        this.startTimes.delete(key);
        return duration;
    }

    /**
     * Measure a function execution
     */
    static async measure<T>(name: string, fn: () => Promise<T>, metadata: Record<string, any> = {}): Promise<T> {
        this.start(name);
        try {
            const result = await fn();
            this.end(name, metadata);
            return result;
        } catch (error) {
            this.end(name, { ...metadata, error: true });
            throw error;
        }
    }
}
