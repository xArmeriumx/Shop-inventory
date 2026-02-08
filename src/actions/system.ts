'use server';

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import os from 'os';

export interface SystemMetrics {
  status: 'online' | 'degraded' | 'offline';
  timestamp: string;
  uptime: number;
  os: {
    platform: string;
    arch: string;
    release: string;
    cpus: number; // Number of cores
    loadAvg: number[]; // [1m, 5m, 15m]
    totalMemory: number;
    freeMemory: number;
  };
  process: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    nodeVersion: string;
    pid: number;
    cpuUsage: number;
  };
  db: {
    status: 'connected' | 'disconnected';
    latency: number;
      pool: { active: number; idle: number };
    };
    onlineUsers: number;
    logs: any[]; // Use any[] for now to avoid dragging in LogLevel type issues before generate
    totalQueries: number;
    environment: {
      region: string;
      nodeEnv: string;
    };
  }

export async function getSystemMetrics(): Promise<SystemMetrics> {
  // Security check: Only Shop Owners/Admins (who have shop settings permissions) can view system stats
  await requirePermission('SETTINGS_SHOP');

  // Calculate CPU Usage (Process level)
  const startUsage = process.cpuUsage();
  const startTime = process.hrtime();
  
  // Measure DB Latency
  const dbStart = performance.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbLatency = 0;
  
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    await logger.error('DB Health Check Failed', error as Error, { path: 'getSystemMetrics' });
    dbStatus = 'disconnected';
  }
  const dbEnd = performance.now();
  dbLatency = Math.round(dbEnd - dbStart);

  // Ensure at least 100ms has passed since startTime for CPU calculation
  // (We use the HRTime for CPU calc, but we need real time duration for the delta)
  const elapsedSinceStart = performance.now() - dbStart; // approximation
  if (elapsedSinceStart < 100) {
    await new Promise(resolve => setTimeout(resolve, 100 - elapsedSinceStart));
  }

  // Prisma Metrics (Connection Pool)
  // Note: $metrics.json() returns { counters: ..., gauges: ... }
  // We need to cast it or access it safely. 
  // Standard format involves 'pool_active_connections' and 'pool_idle_connections'
  let poolStats = { active: 0, idle: 0 };
  try {
    const metrics = await db.$metrics.json();
    // Use type assertion or safe access
    const gauges = (metrics as any).gauges;
    if (gauges) {
       poolStats.active = gauges.find((g: any) => g.key === 'prisma_client_queries_active')?.value || 0;
       // Actually 'prisma_pool_connections_busy' vs 'idle' is more standard
       // Let's rely on standard keys if available, or fallback
       const poolBusy = gauges.find((g: any) => g.key === 'prisma_pool_connections_busy')?.value ?? 0;
       const poolIdle = gauges.find((g: any) => g.key === 'prisma_pool_connections_idle')?.value ?? 0;
       poolStats = { active: poolBusy, idle: poolIdle };
    }
  } catch (e) {
    // Prisma metrics not available - non-critical
  }

  // Active Users (Last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsersCount = await db.user.count({
    where: {
      lastActiveAt: {
        gte: fiveMinutesAgo,
      },
    },
  });

  const endUsage = process.cpuUsage(startUsage);
  const elapTime = process.hrtime(startTime);

  const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
  const elapUserMS = endUsage.user / 1000;
  const elapSystemMS = endUsage.system / 1000;
  
  // CPU Percent = (User + System) / Elapsed
  const cpuPercent = Math.round(((elapUserMS + elapSystemMS) / elapTimeMS) * 100);

  // System Load
  const loadAvg = os.loadavg();

  return {
    status: dbStatus === 'connected' && dbLatency < 500 ? 'online' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: os.uptime(),
    os: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      loadAvg: loadAvg,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    },
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      pid: process.pid,
      cpuUsage: cpuPercent,
    },
    db: {
      status: dbStatus,
      latency: dbLatency,
      pool: poolStats,
    },
    onlineUsers: onlineUsersCount,
    // Logs & QPS Data
    logs: await getRecentLogs(),
    totalQueries: await getTotalQueries(),
    environment: {
      region: process.env.VERCEL_REGION || 'local',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

export async function generateTestLog() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  
  // Security: Feature is currently disabled in production
  throw new Error('Test logging feature is globally disabled.');
  
  /* 
  // Original Logic (Disabled)
  await logger.error(
    'Test Error Triggered Manually', 
    new Error('This is a simulated system error for testing purposes.'),
    { 
      path: '/system/test', 
      method: 'MANUAL',
      userId: session.user.id 
    }
  );
  */
  
  return { success: false };
}

// Helper to get logs safely (even if table doesn't exist yet/client not generated)
async function getRecentLogs() {
  try {
    // @ts-ignore - db.systemLog might not be in types yet
    if (!db.systemLog) return [];
    
    // @ts-ignore
    return await db.systemLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: {
        level: { in: ['ERROR', 'WARN'] }
      }
    });
  } catch (e) {
    return [];
  }
}

// Helper to get total query count for QPS calculation
async function getTotalQueries() {
  try {
    const metrics = await db.$metrics.json();
    return (metrics as any).counters.find((c: any) => c.key === 'prisma_client_queries_total')?.value || 0;
  } catch (e) {
    return 0;
  }
}
