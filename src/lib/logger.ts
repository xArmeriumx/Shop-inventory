import { db } from '@/lib/db';
import { LogLevel } from '@prisma/client';

export const logger = {
  info: async (message: string, context?: any) => log(LogLevel.INFO, message, context),
  warn: async (message: string, context?: any) => log(LogLevel.WARN, message, context),
  error: async (message: string, error?: any, context?: any) => {
    const stack = error instanceof Error ? error.stack : undefined;
    return log(LogLevel.ERROR, message, { ...context, stack, error: error?.toString() });
  },
};

async function log(level: LogLevel, message: string, context?: any) {
  try {
    // Sanitize context
    const { path, method, userId, shopId, ...otherContext } = context || {};
    
    // In production, you might want to use a fire-and-forget approach 
    // or a dedicated logging service. For this dashboard, DB is fine.
    await db.systemLog.create({
      data: {
        level,
        message,
        path: path as string,
        method: method as string,
        userId: userId as string,
        shopId: shopId as string,
        stack: otherContext.stack,
        body: JSON.stringify(otherContext),
      },
    });
  } catch (e) {
    // Fallback to console if DB logging fails
    console.error('Failed to write to system log:', e);
    console.log(`[${level}] ${message}`, context);
  }
}
