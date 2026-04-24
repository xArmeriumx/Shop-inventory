import { Suspense } from 'react';
import { ShieldAlert, AlertTriangle, Zap, Activity, Bug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getHardeningHealth } from '@/actions/core/system.actions';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/formatters';

async function HealthContent() {
  const result = await getHardeningHealth();

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl opacity-60">
        <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-lg font-semibold">ไม่สามารถดึงข้อมูลสุขภาพระบบได้</h3>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total 24h Recoveries</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total24h}</div>
            <p className="text-xs text-muted-foreground">Successful gracefully handled events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Boundary Triggers</CardTitle>
            <Zap className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.byType?.boundary_recovery || 0}</div>
            <p className="text-xs text-muted-foreground">Component crashes caught by SafeBoundary</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contract Fallbacks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.byType?.fallback_contract || 0}</div>
            <p className="text-xs text-muted-foreground">Data contract mismatches (Defensive layer)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hotspots Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-500" />
              Component Hotspots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Component</TableHead>
                  <TableHead className="text-right">Failure Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.hotspots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                      No hotspots detected in the last 24h
                    </TableCell>
                  </TableRow>
                ) : (
                  data.hotspots.map((h: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium font-mono text-xs">{h.source}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">{h.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Latest Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              Recent Hardening Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recent.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No recent events logged
                </div>
              ) : (
                data.recent.map((event: any) => (
                  <div key={event.id} className="border-l-2 border-primary/20 pl-4 py-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {event.body.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold truncate">{event.message}</p>
                    <p className="text-[9px] text-muted-foreground font-mono truncate">
                      Path: {event.body.pathname || '/'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => <Card key={i} className="h-24 animate-pulse bg-muted" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-64 animate-pulse bg-muted" />
        <Card className="h-64 animate-pulse bg-muted" />
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Health & Hardening</h1>
        <p className="text-muted-foreground">
          Operational observability and recovery metrics (Admin Only)
        </p>
      </div>

      <Suspense fallback={<HealthSkeleton />}>
        <HealthContent />
      </Suspense>
    </div>
  );
}
