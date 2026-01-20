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
  Bug
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { getSystemMetrics, generateTestLog, type SystemMetrics } from '@/actions/system'; // Import generateTestLog
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
  const [isTesting, setIsTesting] = useState(false); // State for test button

  // Refs for calculating QPS delta
  const lastQueriesRef = useRef<{ total: number; time: number } | null>(null);
  const [qps, setQps] = useState(0);

  const fetchMetrics = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getSystemMetrics();
        setMetrics(data);
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

        // Add to history (keep last 30 points)
        setHistory(prev => {
          const date = new Date();
          const timeLabel = date.getHours().toString().padStart(2, '0') + ':' +
                           date.getMinutes().toString().padStart(2, '0') + ':' +
                           date.getSeconds().toString().padStart(2, '0');

          const newPoint = {
            time: timeLabel,
            memory: (data.process.memory.rss / 1024 / 1024).toFixed(1), // MB
            latency: data.db.latency,
            requests: currentQps // Real QPS
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
  }, []);

  const handleTestError = async () => {
    setIsTesting(true);
    try {
      await generateTestLog();
      // Wait a bit for DB propagation then refresh
      setTimeout(() => {
        fetchMetrics();
        setIsTesting(false);
      }, 500);
    } catch (e) {
      console.error(e);
      setIsTesting(false);
    }
  };

  useEffect(() => {
    // Handle visibility change for Auto-Pause
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
        fetchMetrics(); // Fetch immediately when visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    fetchMetrics();
    // Auto refresh every 2 seconds (Real-time)
    const interval = setInterval(() => {
      if (!isPaused && !document.hidden) fetchMetrics();
    }, 2000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPaused, fetchMetrics]);

  if (loading && !metrics) {
    // ... (Skeleton remains unchanged) ...
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  // ... (Error handling remains unchanged) ...

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

  // ... (Helpers remain unchanged) ...
  const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(0) + ' MB';
  const formatUptime = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor(sec % 60)}s`;
  };

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
            variant="ghost"
            size="sm"
            disabled={true} // Permanently disabled as per request
            className="gap-2 text-muted-foreground opacity-50 cursor-not-allowed"
          >
            <Bug className="h-4 w-4" />
            Test Error (Disabled)
          </Button>
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
      
      {/* ... (Rest of dashboard remains unchanged) ... */}

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

        {/* Request Rate (NEW) - Replaces DB Pool if space needed, or typically Pool is better. 
            User asked for Request Rate. Let's add it. 
            Actually let's keep Pool and replace User Online? No, Online is requested.
            Let's Add a 5th card? The grid layout is lg:grid-cols-4. 
            Let's replace "Process Uptime" (less useful) or just add it to the grid. 
            The grid is dynamic. */}
        <StatusCard
          title="Request Rate (DB)"
          value={`${qps} QPS`}
          subValue="Queries per second"
          icon={Zap}
          status={qps > 100 ? 'warning' : 'success'}
          progress={Math.min((qps / 100) * 100, 100)} 
        />

        {/* Process CPU */}
        <StatusCard
          title="Process CPU Usage"
          value={`${metrics.process.cpuUsage}%`}
          subValue={`System Load: ${metrics.os.loadAvg[0]?.toFixed(2) || '0.00'}`}
          icon={Cpu}
          status={metrics.process.cpuUsage > 70 ? 'warning' : 'success'}
          progress={metrics.process.cpuUsage} 
        />

        {/* Online Users */}
        <StatusCard
          title="Users Online"
          value={`${metrics.onlineUsers}`}
          subValue="Active in last 5m"
          icon={Users} 
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

      {/* System Logs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-red-500" />
            Recent Error Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Context (Path)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.logs && metrics.logs.length > 0 ? (
                metrics.logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.level === 'ERROR' ? 'destructive' : 'secondary'}>
                        {log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.message}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.path || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                    No recent errors found. System is running smoothly.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
