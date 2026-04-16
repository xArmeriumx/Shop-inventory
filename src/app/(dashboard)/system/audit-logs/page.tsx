'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  User as UserIcon,
  Download,
  ShieldAlert,
  Archive,
  AlertOctagon,
  ChevronDown,
  LayoutGrid,
  Calendar,
  Eye,
  ShieldCheck
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
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAuditLogs, GetAuditLogsResult, exportAuditLogsAction } from '@/actions/audit';
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
    status: 'ALL',
    search: '',
  });
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const fetchLogs = useCallback(async (page = 1) => {
    const result = await getAuditLogs({
      page,
      limit: 20,
      action: filters.action === 'ALL' ? undefined : filters.action,
      status: (filters as any).status === 'ALL' ? undefined : (filters as any).status,
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
  }, [filters.action, (filters as any).status]);

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

  const applyPreset = (presetName: string, config: any) => {
    setActivePreset(presetName);
    setFilters(prev => ({
      ...prev,
      ...config,
      search: '', // Reset search for presets
    }));
  };

  const handleExport = async (format: 'CSV' | 'JSON') => {
    setIsExporting(true);
    try {
      // Use current month range for safety on first implement
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const end = new Date();
      
      const result = await exportAuditLogsAction(start.toISOString(), end.toISOString(), format);
      
      if (result.success && result.data) {
        const content = format === 'JSON' 
          ? JSON.stringify(result.data, null, 2)
          : convertToCSV(result.data);
          
        const blob = new Blob([content], { type: format === 'JSON' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_logs_${format.toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Export ${format} สำเร็จ (${result.data.length} รายการ)`);
      } else {
        toast.error(result.message || 'Export ล้มเหลว');
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    } finally {
      setIsExporting(false);
    }
  };

  function convertToCSV(data: any[]) {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row)
        .map(val => {
          const s = String(val).replace(/"/g, '""');
          return s.includes(',') ? `"${s}"` : s;
        })
        .join(',')
    );
    return [headers, ...rows].join('\n');
  }

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
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
                Export logs
                <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('CSV')}>Export as CSV (Flattened)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('JSON')}>Export as JSON (Full Snapshots)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      </div>

      {/* Smart Filter Presets (Governance Ops Enhancement) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Button 
          variant={activePreset === 'security' ? 'default' : 'outline'} 
          className="h-auto py-3 justify-start gap-4 border-2"
          onClick={() => applyPreset('security', { action: 'ALL', status: 'DENIED' })}
        >
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activePreset === 'security' ? 'bg-primary-foreground/20' : 'bg-red-500/10'}`}>
            <ShieldAlert className={activePreset === 'security' ? 'text-primary-foreground' : 'text-red-600'} />
          </div>
          <div className="text-left flex flex-col">
            <span className="text-sm font-bold">Security Incidents</span>
            <span className="text-[10px] opacity-70 font-medium">Status: Denied / Failed</span>
          </div>
        </Button>

        <Button 
          variant={activePreset === 'iam' ? 'default' : 'outline'} 
          className="h-auto py-3 justify-start gap-4 border-2"
          onClick={() => applyPreset('iam', { action: 'TEAM_ROLE_UPDATE', targetType: 'Role' })}
        >
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activePreset === 'iam' ? 'bg-primary-foreground/20' : 'bg-blue-500/10'}`}>
            <LayoutGrid className={activePreset === 'iam' ? 'text-primary-foreground' : 'text-blue-600'} />
          </div>
          <div className="text-left flex flex-col">
            <span className="text-sm font-bold">Sensitive IAM</span>
            <span className="text-[10px] opacity-70 font-medium">Role & Member changes</span>
          </div>
        </Button>

        <Button 
          variant={activePreset === 'stock' ? 'default' : 'outline'} 
          className="h-auto py-3 justify-start gap-4 border-2"
          onClick={() => applyPreset('stock', { action: 'STOCK_ADJUST', targetType: 'Product' })}
        >
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activePreset === 'stock' ? 'bg-primary-foreground/20' : 'bg-orange-500/10'}`}>
            <Archive className={activePreset === 'stock' ? 'text-primary-foreground' : 'text-orange-600'} />
          </div>
          <div className="text-left flex flex-col">
            <span className="text-sm font-bold">Manual Stock</span>
            <span className="text-[10px] opacity-70 font-medium">Manual Adjustments</span>
          </div>
        </Button>

        <Button 
          variant={activePreset === 'finance' ? 'default' : 'outline'} 
          className="h-auto py-3 justify-start gap-4 border-2"
          onClick={() => applyPreset('finance', { action: 'SALE_CANCEL', targetType: 'Sale' })}
        >
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activePreset === 'finance' ? 'bg-primary-foreground/20' : 'bg-purple-500/10'}`}>
            <AlertOctagon className={activePreset === 'finance' ? 'text-primary-foreground' : 'text-purple-600'} />
          </div>
          <div className="text-left flex flex-col">
            <span className="text-sm font-bold">Critical Finance</span>
            <span className="text-[10px] opacity-70 font-medium">Cancelled/Voided Docs</span>
          </div>
        </Button>
      </div>

      <Card className="border-primary/10 shadow-lg bg-card/50 backdrop-blur-sm relative overflow-hidden">
        {activePreset && (
          <div className="absolute top-0 right-0 p-1">
             <Button 
              variant="ghost" 
              size="sm" 
              className="text-[10px] h-6 px-2 hover:bg-transparent" 
              onClick={() => { setActivePreset(null); setFilters({ action: 'ALL', targetType: 'ALL', status: 'ALL', search: '' }); }}
            >
               Clear Preset ✕
             </Button>
          </div>
        )}
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
