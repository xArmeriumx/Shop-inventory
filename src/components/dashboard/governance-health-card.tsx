'use client';

import { ShieldCheck, ShieldAlert, AlertTriangle, Activity, Database, Key, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface GovernanceHealthCardProps {
  data: {
    auditWriteFailures: number;
    permissionDeniedCount: number;
    rateLimitExceededCount: number;
    lastIncidentAt: Date | string | null;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  };
}

export function GovernanceHealthCard({ data }: GovernanceHealthCardProps) {
  const isHealthy = data.status === 'HEALTHY';
  const isWarning = data.status === 'WARNING';
  const isCritical = data.status === 'CRITICAL';

  const lastIncident = data.lastIncidentAt ? new Date(data.lastIncidentAt) : null;

  return (
    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm shadow-lg overflow-hidden relative group">
      {/* Decorative background pulse */}
      <div className={`absolute top-0 right-0 h-32 w-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-10 transition-colors ${
        isHealthy ? 'bg-green-500' : isWarning ? 'bg-yellow-500' : 'bg-red-500'
      }`} />

      <CardHeader className="pb-2 border-b border-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold tracking-tight">Governance Health</CardTitle>
          </div>
          <Badge 
            variant={isHealthy ? 'success' as any : isWarning ? 'warning' as any : 'destructive'}
            className="text-[10px] uppercase font-bold px-2 py-0 h-5"
          >
            {isHealthy ? 'System Secure' : isWarning ? 'Attention Required' : 'Critical Issue'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Audit Failures</span>
            </div>
            <p className={`text-xl font-bold ${data.auditWriteFailures > 0 ? 'text-red-600' : 'text-foreground'}`}>
              {data.auditWriteFailures}
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Access Denials</span>
            </div>
            <p className="text-xl font-bold">{data.permissionDeniedCount}</p>
          </div>
        </div>

        {/* Detailed Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" /> Rate Limit hits
            </span>
            <span className="font-semibold">{data.rateLimitExceededCount}</span>
          </div>
          
          <div className="pt-2 border-t border-primary/5">
            <p className="text-[10px] text-muted-foreground italic">
              {lastIncident 
                ? `Last governance event: ${formatDistanceToNow(lastIncident, { addSuffix: true, locale: th })}`
                : 'No governance incidents recorded in this session.'
              }
            </p>
          </div>
        </div>

        {/* Status Message (Guardrail 7) */}
        <div className={`mt-2 p-2 rounded text-[11px] leading-tight flex gap-2 ${
          isHealthy ? 'bg-green-500/5 text-green-700' : 'bg-orange-500/5 text-orange-700'
        }`}>
          {isHealthy ? (
            <ShieldCheck className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>
            {isHealthy 
              ? "All mutations are currently flowing through the audited service layer without errors."
              : "Some audit log writes failed or access was denied. Check system logs for deep forensics."
            }
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
