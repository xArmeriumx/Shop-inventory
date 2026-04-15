import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import os from 'os';

export interface SystemMetrics {
  status: 'online' | 'degraded' | 'offline';
  timestamp: string;
  uptime: number;
  os: {
    platform: string;
    arch: string;
    release: string;
    cpus: number;
    loadAvg: number[];
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
  logs: any[];
  totalQueries: number;
  environment: {
    region: string;
    nodeEnv: string;
  };
}

export const SystemService = {
  async getMetrics(): Promise<SystemMetrics> {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime();
    
    const dbStart = performance.now();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await db.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }
    const dbEnd = performance.now();
    const dbLatency = Math.round(dbEnd - dbStart);

    const metrics = await db.$metrics.json().catch(() => ({ gauges: [], counters: [] }));
    const gauges = (metrics as any).gauges || [];
    const poolStats = {
      active: gauges.find((g: any) => g.key === 'prisma_pool_connections_busy')?.value ?? 0,
      idle: gauges.find((g: any) => g.key === 'prisma_pool_connections_idle')?.value ?? 0,
    };

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsersCount = await db.user.count({
      where: { lastActiveAt: { gte: fiveMinutesAgo } },
    });

    const endUsage = process.cpuUsage(startUsage);
    const elapTime = process.hrtime(startTime);
    const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
    const cpuPercent = Math.round(((endUsage.user / 1000 + endUsage.system / 1000) / elapTimeMS) * 100);

    const logs = await (db as any).systemLog?.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { level: { in: ['ERROR', 'WARN'] } }
    }).catch(() => []) || [];

    const totalQueries = (metrics as any).counters?.find((c: any) => c.key === 'prisma_client_queries_total')?.value || 0;

    return {
      status: dbStatus === 'connected' && dbLatency < 500 ? 'online' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: os.uptime(),
      os: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        cpus: os.cpus().length,
        loadAvg: os.loadavg(),
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
      db: { status: dbStatus, latency: dbLatency, pool: poolStats },
      onlineUsers: onlineUsersCount,
      logs,
      totalQueries,
      environment: {
        region: process.env.VERCEL_REGION || 'local',
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    };
  }
};
