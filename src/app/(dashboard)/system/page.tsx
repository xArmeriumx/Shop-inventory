'use client';

import { Suspense, useEffect, useState, useTransition, useRef, useCallback } from 'react';
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  AlertTriangle,
  Users,
  Cpu,
  Zap,
  FileWarning,
  Bug,
  ShieldCheck,
  History,
  Lock,
  Globe,
  Terminal,
  ChevronRight,
  Wifi,
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getSystemMetrics, getHardeningHealth, type SystemMetrics } from '@/actions/core/system.actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '@/lib/utils';


function MetricIndicator({ status }: { status: 'online' | 'degraded' | 'offline' }) {
  return (
    <div className="relative flex items-center justify-center h-4 w-4">
      <span className={cn(
        "absolute h-full w-full rounded-full animate-ping opacity-75",
        status === 'online' ? "bg-emerald-400" : status === 'degraded' ? "bg-orange-400" : "bg-red-400"
      )} />
      <span className={cn(
        "relative inline-flex h-2.5 w-2.5 rounded-full",
        status === 'online' ? "bg-emerald-500" : status === 'degraded' ? "bg-orange-500" : "bg-red-500"
      )} />
    </div>
  );
}

function StatusCard({
  title,
  value,
  subValue,
  icon: Icon,
  status = 'default',
  progress,
  className
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: any;
  status?: 'default' | 'success' | 'warning' | 'error';
  progress?: number;
  className?: string;
}) {
  const statusColor = {
    default: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-orange-500',
    error: 'text-red-500',
  };

  const bgStatus = {
    default: 'bg-muted/50',
    success: 'bg-emerald-500/10',
    warning: 'bg-orange-500/10',
    error: 'bg-red-500/10',
  };

  return (
    <Card className={cn("overflow-hidden border-2 transition-all hover:border-primary/20", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">{title}</p>
        <div className={cn("p-2 rounded-xl transition-colors", bgStatus[status])}>
          <Icon className={cn("h-4 w-4", statusColor[status])} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tighter">{value}</div>
        {subValue && (
          <p className="text-[11px] font-medium text-muted-foreground/60 mt-1 flex items-center gap-1">
            {subValue}
          </p>
        )}
        {progress !== undefined && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-1.5"
                indicatorClassName={cn(
                    "transition-all duration-1000",
                    status === 'warning' ? 'bg-orange-500' :
                    status === 'error' ? 'bg-red-500' :
                    status === 'success' ? 'bg-emerald-500' : 'bg-primary'
                )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function SystemDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [hardening, setHardening] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for calculating QPS delta
  const lastQueriesRef = useRef<{ total: number; time: number } | null>(null);
  const [qps, setQps] = useState(0);

  const fetchMetrics = useCallback(() => {
    startTransition(async () => {
      try {
        const [metricsRes, hardeningRes] = await Promise.all([
          getSystemMetrics(),
          getHardeningHealth()
        ]);

        if (!metricsRes.success) {
          setError(metricsRes.message);
          setLoading(false);
          return;
        }

        const data = metricsRes.data;
        setMetrics(data);
        if (hardeningRes.success) setHardening(hardeningRes.data);
        
        setError(null);

        // Calculate QPS
        const now = Date.now();
        let currentQps = 0;
        if (lastQueriesRef.current) {
          const deltaSeconds = (now - lastQueriesRef.current.time) / 1000;
          const deltaQueries = data.totalQueries - lastQueriesRef.current.total;
          if (deltaSeconds > 0 && deltaQueries >= 0) {
            currentQps = Math.round(deltaQueries / deltaSeconds);
          }
        }
        setQps(currentQps);
        lastQueriesRef.current = { total: data.totalQueries, time: now };

        // Add to history
        setHistory(prev => {
          const date = new Date();
          const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const newPoint = {
            time: timeLabel,
            memory: (data.process.memory.rss / 1024 / 1024), // MB
            latency: data.db.latency,
            requests: currentQps
          };

          const newHistory = [...prev, newPoint];
          return newHistory.slice(-30);
        });

      } catch (err) {
        console.error(err);
        setError('ไม่สามารถดึงข้อมูลระบบได้ (Authorization Required)');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsPaused(true);
      else {
        setIsPaused(false);
        fetchMetrics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    fetchMetrics();
    
    const interval = setInterval(() => {
      if (!isPaused && !document.hidden) fetchMetrics();
    }, 2000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPaused, fetchMetrics]);

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted animate-pulse rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-3xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 rounded-3xl p-8 text-center max-w-2xl mx-auto">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-xl font-black mb-2">เข้าถึงข้อมูลถูกปฏิเสธ</h3>
        <p className="text-muted-foreground font-medium mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl border-2">
            Try Re-Authentication
        </Button>
      </Card>
    );
  }

  if (!metrics) return null;

  // Calculate Resilience Score (0-100)
  // Factors: DB Latency, CPU Load, Error Volume, Hardening Resilience
  const latencyPenalty = Math.max(0, (metrics.db.latency - 50) / 10); // 1 point per 10ms above 50ms
  const cpuPenalty = Math.max(0, (metrics.process.cpuUsage - 60) / 2); // 1 point per 2% above 60%
  const logPenalty = (metrics.logs?.length || 0) * 2;
  const healthScore = Math.max(0, 100 - latencyPenalty - cpuPenalty - logPenalty);

  const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(0) + ' MB';
  const dbStatus = metrics.db.latency < 100 ? 'success' : metrics.db.latency < 300 ? 'warning' : 'error';

  return (
    <div className="space-y-8 pb-10">
      {/* Premium Header / Status Bar */}
      <div className="relative group overflow-hidden rounded-[2.5rem] border-2 bg-foreground p-8 text-background shadow-2xl shadow-primary/10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/20 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/30">
                <Globe className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter">Command Center</h2>
            </div>
            <div className="flex items-center gap-3 font-bold text-background/60">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs">
                    <Wifi className="h-3 w-3 text-emerald-400" />
                    SYSTEM {metrics.status.toUpperCase()}
                </div>
                <span className="text-xs opacity-40">PID: {metrics.process.pid}</span>
                <span className="text-xs opacity-40">Uptime: {Math.floor(metrics.process.uptime / 3600)}h {Math.floor((metrics.process.uptime % 3600) / 60)}m</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="rounded-2xl border-2 bg-transparent hover:bg-white/10 border-white/10 text-white font-bold h-11"
            >
              {isPaused ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  RESUME LIVE
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2 text-emerald-400" />
                  PAUSE MONITOR
                </>
              )}
            </Button>
            
            <Link href="/system/audit-logs">
                <Button className="rounded-2xl bg-white text-black hover:bg-white/90 h-11 px-6 font-black shadow-none border-none">
                    Security Audit
                    <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Resilience Gauge & Summary Indicators */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 rounded-[2rem] border-2 shadow-xl shadow-primary/5 relative overflow-hidden bg-muted/20">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    System Resilience
                </CardTitle>
                <CardDescription>Composite server health index</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                <div className="relative h-40 w-40 flex items-center justify-center">
                    <svg className="h-full w-full rotate-[-90deg]">
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted/30" />
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" 
                            strokeDasharray={440} strokeDashoffset={440 - (440 * healthScore / 100)}
                            className={cn(
                                "transition-all duration-1000",
                                healthScore > 90 ? "text-emerald-500" : healthScore > 75 ? "text-primary" : "text-orange-500"
                            )}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black tracking-tighter">{healthScore}</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">SCORE</span>
                    </div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-8 w-full border-t-2 border-dashed pt-8">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Hardening Hits</p>
                        <p className="text-xl font-black">{hardening?.summary?.total24h || 0}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Threat Hotspots</p>
                        <p className="text-xl font-black">{hardening?.hotspots?.length || 0}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Real-time Dynamic Metrics */}
        <div className="lg:col-span-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
            <StatusCard
                title="Database Response"
                value={`${metrics.db.latency} ms`}
                subValue={`Throughput: ${qps} Queries/Sec`}
                icon={Database}
                status={dbStatus}
                progress={Math.min((metrics.db.latency / 500) * 100, 100)}
                className="rounded-3xl"
            />
            <StatusCard
                title="Processing Power"
                value={`${metrics.process.cpuUsage}%`}
                subValue={`System Load: ${metrics.os.loadAvg[0]?.toFixed(2)}`}
                icon={Cpu}
                status={metrics.process.cpuUsage > 75 ? 'error' : metrics.process.cpuUsage > 50 ? 'warning' : 'success'}
                progress={metrics.process.cpuUsage}
                className="rounded-3xl"
            />
            <StatusCard
                title="Memory Footprint"
                value={formatBytes(metrics.process.memory.rss)}
                subValue={`Free OS Memory: ${formatBytes(metrics.os.freeMemory)}`}
                icon={Server}
                status={metrics.process.memory.rss > 1024 * 1024 * 1024 ? 'warning' : 'success'}
                progress={(metrics.process.memory.rss / (1024 * 1024 * 1024)) * 100}
                className="rounded-3xl"
            />
            <StatusCard
                title="Active Sessions"
                value={`${metrics.onlineUsers}`}
                subValue="Real-time traffic monitor"
                icon={Users}
                status="success"
                className="rounded-3xl border-primary bg-primary/5"
            />
        </div>
      </div>

      {/* Trends & Analytics Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[2rem] border-2 shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30 pb-6">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Latency & Flow Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[280px] w-full pt-8 px-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="time" hide />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '16px', border: '2px solid var(--border)', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ padding: '0px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorLatency)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30 pb-6">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-500" />
              Security Hardening History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {hardening?.recent?.length > 0 ? (
                <div className="space-y-4">
                    {hardening.recent.slice(0, 5).map((log: any) => (
                        <div key={log.id} className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                            <div className={cn(
                                "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                                log.body?.type === 'IAM_BLOCKED' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                                {log.body?.type === 'IAM_BLOCKED' ? <Lock className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black tracking-tight group-hover:text-primary transition-colors">{log.message}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[9px] px-1.5 h-4 font-mono font-bold">{log.body?.source || 'SYSTEM'}</Badge>
                                    <span className="text-[10px] text-muted-foreground font-medium">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <Link href="/system/audit-logs" className="block text-center pt-2">
                        <Button variant="ghost" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
                            Analyze All Governance Events <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-center space-y-4">
                    <ShieldCheck className="h-12 w-12 text-muted/30" />
                    <p className="text-sm font-medium text-muted-foreground italic">No hardening events recorded in the last 24h.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Diagnostics (Admin Only feel) */}
      <Card className="rounded-[2.5rem] border-2 shadow-2xl overflow-hidden bg-muted/10 border-dashed">
        <CardHeader className="border-b-2 bg-background/50 px-8 py-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-primary" />
                        Infrastructure Diagnostics
                    </CardTitle>
                    <CardDescription>Direct server environment monitoring</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-7 px-3 rounded-full font-mono bg-background">{metrics.environment.region}</Badge>
                    <Badge className="h-7 px-3 rounded-full font-mono bg-foreground text-background uppercase tracking-tighter">{metrics.environment.nodeEnv}</Badge>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-8">
            <div className="grid gap-8 md:grid-cols-3">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase">OS Environment</div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm py-1 border-b">
                            <span className="text-muted-foreground">Release</span>
                            <span className="font-mono font-bold">{metrics.os.release}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1 border-b">
                            <span className="text-muted-foreground">Architecture</span>
                            <span className="font-mono font-bold">{metrics.os.platform} ({metrics.os.arch})</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground">CPU Cores</span>
                            <span className="font-mono font-bold">{metrics.os.cpus} vCPU</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 md:border-l-2 md:pl-8 border-dashed">
                    <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase">Runtime Process</div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm py-1 border-b">
                            <span className="text-muted-foreground">Version</span>
                            <span className="font-mono font-bold">{metrics.process.nodeVersion}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1 border-b">
                            <span className="text-muted-foreground">Environment Time</span>
                            <span className="font-mono font-bold">{new Date(metrics.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground">PID Trace</span>
                            <span className="font-mono font-bold"># {metrics.process.pid}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 md:border-l-2 md:pl-8 border-dashed">
                    <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase">Quick Tools</div>
                    <div className="grid grid-cols-1 gap-2">
                        <Link href="/system/ops">
                            <Button variant="outline" className="w-full h-12 rounded-2xl justify-start font-black gap-3 border-2">
                                <Bug className="h-5 w-5 text-orange-500" />
                                Maintenance Hub
                            </Button>
                        </Link>
                        <Button variant="outline" disabled className="w-full h-12 rounded-2xl justify-start font-black gap-3 border-2 opacity-50">
                            <Terminal className="h-5 w-5 text-muted-foreground" />
                            Debug Shell (Disabled)
                        </Button>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
      
      {/* Logs Table (Full Width) */}
      <Card className="rounded-[2rem] border-2 shadow-lg">
        <CardHeader className="px-8 py-6 border-b-2">
            <CardTitle className="text-base font-black flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-red-500" />
                Error & Warning Manifest
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="border-b-2">
                <TableHead className="px-8 h-12 font-black text-[10px] uppercase tracking-widest">Time (System)</TableHead>
                <TableHead className="h-12 font-black text-[10px] uppercase tracking-widest">Severity</TableHead>
                <TableHead className="h-12 font-black text-[10px] uppercase tracking-widest">Diagnostic Message</TableHead>
                <TableHead className="px-8 h-12 font-black text-[10px] uppercase tracking-widest text-right">Source Trace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.logs && metrics.logs.length > 0 ? (
                metrics.logs.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="px-8 whitespace-nowrap text-xs font-mono text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.level === 'ERROR' ? 'destructive' : 'outline'} className="rounded-xl font-bold px-2 py-0.5">
                        {log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-sm max-w-md truncate">{log.message}</TableCell>
                    <TableCell className="px-8 text-xs font-mono text-muted-foreground text-right italic">
                      {log.path || 'SYSTEM_CORE'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center font-bold text-muted-foreground h-32 italic">
                    <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="h-8 w-8 opacity-20" />
                        Zero system anomalies detected. Infrastructure is stable.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemStatusPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 lg:py-10">
      <SystemDashboard />
    </div>
  );
}
