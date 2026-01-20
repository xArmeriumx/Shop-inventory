'use server';

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
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
  };
  db: {
    status: 'connected' | 'disconnected';
    latency: number;
  };
  environment: {
    region: string;
    nodeEnv: string;
  };
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  // Security check: Only Shop Owners/Admins (who have shop settings permissions) can view system stats
  await requirePermission('SETTINGS_SHOP');

  const start = performance.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  
  // Measure DB Latency
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    console.error('DB Health Check Failed:', error);
    dbStatus = 'disconnected';
  }
  const end = performance.now();
  const dbLatency = Math.round(end - start);

  // System Load (Note: os.loadavg() works on Linux/macOS, might be 0 on Windows)
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
    },
    db: {
      status: dbStatus,
      latency: dbLatency,
    },
    environment: {
      region: process.env.VERCEL_REGION || 'local',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}
