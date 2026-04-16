'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  ShieldCheck,
  Calendar,
  User as UserIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { getAuditLogs, GetAuditLogsResult } from '@/actions/audit';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { toast } from 'sonner';
import { AuditDetailModal } from '@/components/audit/audit-detail-modal';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({
    action: 'ALL',
    targetType: 'ALL',
    search: '',
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchLogs = useCallback((page = 1) => {
    startTransition(async () => {
      const result = await getAuditLogs({
        page,
        limit: 20,
        action: filters.action === 'ALL' ? undefined : filters.action,
        targetType: filters.targetType === 'ALL' ? undefined : filters.targetType,
        // Add more filter logic if backend supports it
      });

      if (result.success) {
        setLogs(result.data);
        setPagination({
          page: result.page,
          totalPages: result.totalPages,
          total: result.total
        });
      } else {
        toast.error(result.message || 'ไม่สามารถโหลด Audit Log ได้');
      }
    });
  }, [filters.action, filters.targetType]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchLogs(newPage);
    }
  };

  const openDetail = (log: any) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-8 w-8 text-primary" />
            Audit Log Explorer
          </h1>
          <p className="text-muted-foreground">
            ตรวจสอบประวัติการใช้งานและการเปลี่ยนแปลงข้อมูลในระบบ (System Governance)
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchLogs(pagination.page)}
          disabled={isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-primary/10 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Advanced Filters
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[180px]">
                <Select 
                  value={filters.action} 
                  onValueChange={(val) => setFilters(prev => ({ ...prev, action: val }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Actions</SelectItem>
                    <SelectItem value="SALE_CREATE">Sale Create</SelectItem>
                    <SelectItem value="PURCHASE_CREATE">Purchase Create</SelectItem>
                    <SelectItem value="STOCK_ADJUST">Stock Adjust</SelectItem>
                    <SelectItem value="IAM_USER_CREATE">User Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[180px]">
                <Select 
                  value={filters.targetType} 
                  onValueChange={(val) => setFilters(prev => ({ ...prev, targetType: val }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Domains</SelectItem>
                    <SelectItem value="Sale">Sales</SelectItem>
                    <SelectItem value="Purchase">Purchases</SelectItem>
                    <SelectItem value="Product">Inventory</SelectItem>
                    <SelectItem value="User">Internal Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-[240px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes or users..."
                  className="pl-9 h-9"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">Loading activity logs...</p>
                  </TableCell>
                </TableRow>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1">
                           <Calendar className="h-3 w-3" />
                           {format(new Date(log.createdAt), 'dd MMM yy')}
                        </span>
                        <span className="ml-4 opacity-70">
                           {format(new Date(log.createdAt), 'HH:mm:ss')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-foreground">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {log.note || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase bg-background">
                        {log.targetType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                             <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs font-semibold">{log.actorName || 'System'}</span>
                             <span className="text-[10px] text-muted-foreground">ID: {log.actorUserId?.slice(-6) || '-'}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={log.status === 'SUCCESS' ? 'success' as any : 'destructive'} 
                        className="text-[10px] py-0 h-5"
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm"
                        onClick={() => openDetail(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-medium">
                    No activity logs found for the selected criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground font-medium">
                Showing entries {(pagination.page - 1) * 20 + 1}-{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isPending}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs font-bold px-4">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isPending}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Best Practices Warning (Governance ERP Rule 18) */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse">
           <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
           <h3 className="text-lg font-bold text-primary mb-1 tracking-tight">System Integrity & Audit Trail</h3>
           <p className="text-sm text-muted-foreground leading-relaxed">
             This audit trail is tamper-evident and captures deep state snapshots of all critical operations. 
             It is used for troubleshooting, compliance auditing, and security forensics. 
             All read and write operations on this log are themselves audited for maximum governance.
           </p>
        </div>
      </div>

      <AuditDetailModal 
        log={selectedLog}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}
