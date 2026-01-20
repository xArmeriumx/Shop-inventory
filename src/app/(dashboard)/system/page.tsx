'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getSystemMetrics, type SystemMetrics } from '@/actions/system';
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

function StatusCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  status = 'default',
  progress 
}: { 
  title: string; 
  value: string; 
  subValue?: string; 
  icon: any; 
  status?: 'default' | 'success' | 'warning' | 'error';
  progress?: number;
}) {
  const statusColor = {
    default: 'text-muted-foreground',
    success: 'text-green-600',
    warning: 'text-orange-600',
    error: 'text-red-600',
  };

  const bgStatus = {
    default: 'bg-muted/50',
    success: 'bg-green-500/10',
    warning: 'bg-orange-500/10',
    error: 'bg-red-500/10',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${bgStatus[status]}`}>
          <Icon className={`h-4 w-4 ${statusColor[status]}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subValue && (
          <p className="text-xs text-muted-foreground mt-1">
            {subValue}
          </p>
        )}
        {progress !== undefined && (
          <Progress value={progress} className="h-2 mt-3" 
            indicatorClassName={
              status === 'warning' ? 'bg-orange-500' : 
              status === 'error' ? 'bg-red-500' : 
              status === 'success' ? 'bg-green-500' : ''
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function SystemDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const fetchMetrics = () => {
    startTransition(async () => {
      try {
        const data = await getSystemMetrics();
        setMetrics(data);
        setError(null);

        // Add to history (keep last 30 points)
        setHistory(prev => {
          const now = new Date();
          const timeLabel = now.getHours().toString().padStart(2, '0') + ':' +
                           now.getMinutes().toString().padStart(2, '0') + ':' +
                           now.getSeconds().toString().padStart(2, '0');

          const newPoint = {
            time: timeLabel,
            memory: (data.process.memory.rss / 1024 / 1024).toFixed(1), // MB
            latency: data.db.latency,
            requests: Math.floor(Math.random() * 50) + 10 // Simulated requests/sec
          };

          const newHistory = [...prev, newPoint];
          if (newHistory.length > 30) return newHistory.slice(newHistory.length - 30);
          return newHistory;
        });

      } catch (err) {
        console.error(err);
        setError('ไม่สามารถดึงข้อมูลระบบได้ (ต้องการสิทธิ์ Shop Owner/Admin)');
      } finally {
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchMetrics();
    // Auto refresh every 2 seconds (Real-time)
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!metrics) return null;

  // Helpers
  const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(0) + ' MB';
  const formatUptime = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor(sec % 60)}s`;
  };

  const memUsagePercent = (metrics.process.memory.rss / metrics.os.totalMemory) * 100 * 10; // Scale up for visibility if serverless has huge host memory
  const dbStatus = metrics.db.latency < 200 ? 'success' : metrics.db.latency < 1000 ? 'warning' : 'error';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">System Health</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${metrics.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xl font-bold capitalize">{metrics.status}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                Resume
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setIsPaused(false); fetchMetrics(); }} 
            disabled={isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Primary Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* DB Latency */}
        <StatusCard
          title="Database Latency"
          value={`${metrics.db.latency} ms`}
          subValue={metrics.db.status === 'connected' ? 'Connected' : 'Disconnected'}
          icon={Database}
          status={dbStatus}
          progress={Math.min((metrics.db.latency / 500) * 100, 100)}
        />

        {/* Process Memory */}
        <StatusCard
          title="Memory Usage (RSS)"
          value={formatBytes(metrics.process.memory.rss)}
          subValue={`Heap: ${formatBytes(metrics.process.memory.heapUsed)}`}
          icon={Activity}
          status={metrics.process.memory.rss > 512 * 1024 * 1024 ? 'warning' : 'default'} // Warn if > 512MB
          progress={Math.min((metrics.process.memory.rss / (512 * 1024 * 1024)) * 100, 100)} // relative to 512MB standard limit
        />

        {/* Server Info */}
        <StatusCard
          title="Server Environment"
          value={metrics.environment.region}
          subValue={`Node ${metrics.process.nodeVersion}`}
          icon={Server}
          status="default"
        />

        {/* Uptime */}
        <StatusCard
          title="Process Uptime"
          value={formatUptime(metrics.process.uptime)}
          subValue={`System Uptime: ${formatUptime(metrics.uptime)}`}
          icon={Cpu}
          status="success"
        />
      </div>

      {/* Real-time Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Memory Usage History (MB)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-orange-500" />
              Database Latency (ms)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" hide />
                  <YAxis fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#f97316"
                    fillOpacity={1}
                    fill="url(#colorLatency)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">{metrics.os.platform} ({metrics.os.arch})</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">CPUs (Cores)</span>
              <span className="font-medium">{metrics.os.cpus} Cores</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Load Average</span>
              <span className="font-medium">{metrics.os.loadAvg.map(n => n.toFixed(2)).join(', ')}</span>
            </div>
             <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Free Memory (Host)</span>
              <span className="font-medium">{formatBytes(metrics.os.freeMemory)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Environment</span>
              <Badge variant="outline">{metrics.environment.nodeEnv}</Badge>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Region</span>
              <Badge variant="secondary">{metrics.environment.region}</Badge>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Process ID (PID)</span>
              <span className="font-mono">{metrics.process.pid}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Next.js Time</span>
              <span className="font-medium">{new Date(metrics.timestamp).toLocaleTimeString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SystemStatusPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-muted-foreground">
            Monitor server performance and database health
          </p>
        </div>
      </div>
      <SystemDashboard />
    </div>
  );
}
