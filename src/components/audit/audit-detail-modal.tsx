'use client';

import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  User,
  Target,
  ArrowRight,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface AuditDetailModalProps {
  log: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailModal({ log, isOpen, onClose }: AuditDetailModalProps) {
  if (!log) return null;

  const isSuccess = log.status === 'SUCCESS';

  const renderSnapshot = (snapshot: any, title: string) => {
    if (!snapshot) return null;

    // Clean up internal fields for cleaner view
    const cleanSnapshot = { ...snapshot };
    delete cleanSnapshot.shopId;
    delete cleanSnapshot.updatedAt;

    return (
      <div className="flex flex-col space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
        <div className="rounded-md bg-muted p-4 overflow-hidden">
          <pre className="text-xs font-mono overflow-auto max-h-[300px]">
            {JSON.stringify(cleanSnapshot, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <ShadcnDialog open={isOpen} onOpenChange={onClose}>
      <ShadcnDialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <ShadcnDialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <ShadcnDialogTitle className="text-xl flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Audit Log Detail
              </ShadcnDialogTitle>
              <p className="text-sm text-muted-foreground">
                Transaction ID: <span className="font-mono">{log.id}</span>
              </p>
            </div>
            <Badge variant={isSuccess ? 'success' as any : 'destructive'} className="h-6">
              {isSuccess ? 'Success' : 'Denied / Error'}
            </Badge>
          </div>
        </ShadcnDialogHeader>

        <div className="flex-1 overflow-auto p-6 space-y-8">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Timestamp</p>
                <p className="text-sm font-medium">
                  {format(new Date(log.createdAt), 'PPpp', { locale: th })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Actor</p>
                <p className="text-sm font-medium">{log.actorName || 'System'}</p>
                <p className="text-[10px] text-muted-foreground">ID: {log.actorUserId || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Action</p>
                <Badge variant="outline" className="text-[10px] font-mono mt-1">
                  {log.action}
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Target</p>
                <p className="text-sm font-medium">{log.targetType} {log.targetId ? `(#${log.targetId.slice(-6)})` : ''}</p>
              </div>
            </div>
          </div>

          {/* Action Note/Description */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm font-semibold text-primary mb-1">Activity Note</p>
            <p className="text-base text-card-foreground italic">&quot;{log.note || 'No description provided'}&quot;</p>
          </div>

          {/* Snapshot Comparison */}
          {(log.beforeSnapshot || log.afterSnapshot) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Data Snapshots</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-2">
                  {renderSnapshot(log.beforeSnapshot, 'Before Action')}
                  {!log.beforeSnapshot && (
                    <div className="h-[200px] flex flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground">
                      <p className="text-xs italic">No initial state captured</p>
                      <p className="text-[10px]">(Common for CREATION actions)</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 -ml-8 hidden md:flex">
                    <div className="p-1 rounded-full bg-primary/10 text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                  {renderSnapshot(log.afterSnapshot, 'After Action')}
                </div>
              </div>
            </div>
          )}

          {/* Error Information */}
          {!isSuccess && log.errorMessage && (
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-bold">Error Details</span>
              </div>
              <pre className="text-xs font-mono text-destructive-foreground whitespace-pre-wrap px-6">
                {log.errorMessage}
              </pre>
            </div>
          )}
        </div>
      </ShadcnDialogContent>
    </ShadcnDialog>
  );
}

// Internal Activity Icon adjustment for the header
function Activity({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
