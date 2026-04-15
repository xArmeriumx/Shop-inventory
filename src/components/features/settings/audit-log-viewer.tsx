'use client';

import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { getAuditLogs, type GetAuditLogsResult } from '@/actions/audit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Filter, Download, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [targetType, setTargetType] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [actionQuery, setActionQuery] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        page,
        limit: 20,
        targetType: targetType !== 'ALL' ? targetType : undefined,
        status: status !== 'ALL' ? (status as any) : undefined,
        action: actionQuery ? actionQuery : undefined,
      });

      if (result.success) {
        setLogs(result.data);
        setTotalPages(result.totalPages);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('ไม่สามารถโหลดข้อมูล Audit Log ได้');
    } finally {
      setLoading(false);
    }
  }, [page, targetType, status, actionQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return toast.info('ไม่มีข้อมูลให้ Export');
    
    const headers = ['Date', 'Actor ID', 'Action', 'Target Type', 'Target ID', 'Status', 'Note'];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      headers.join(',') + '\n' +
      logs.map(log => {
        const date = format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss');
        const actor = log.actorName || log.actorUserId || 'System';
        const note = log.note ? `"${log.note.replace(/"/g, '""')}"` : '';
        return `${date},${actor},${log.action},${log.targetType || ''},${log.targetId || ''},${log.status},${note}`;
      }).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit-logs-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>ประวัติความปลอดภัยระบบ (Audit Logs)</CardTitle>
            <CardDescription>
              บันทึกกิจกรรมสำคัญและการเข้าถึงข้อมูลทั้งหมดภายในร้านค้า
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 relative z-10">
          <div className="flex-1 min-w-[200px]">
            <Input 
              placeholder="ค้นหาตาม Action (เช่น SALE_CREATE)" 
              value={actionQuery}
              onChange={(e) => setActionQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
            />
          </div>
          <div className="w-[180px]">
            <Select value={targetType} onValueChange={(val) => { setTargetType(val); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="ทุกระบบ (Target)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกระบบ (Target)</SelectItem>
                <SelectItem value="Sale">Sale (การขาย)</SelectItem>
                <SelectItem value="Purchase">Purchase (การซื้อ)</SelectItem>
                <SelectItem value="Product">Product (สินค้า)</SelectItem>
                <SelectItem value="User">User (ผู้ใช้/ทีม)</SelectItem>
                <SelectItem value="Role">Role (สิทธิ์)</SelectItem>
                <SelectItem value="Shop">Shop (ร้านค้า)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="ทุกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                <SelectItem value="SUCCESS">สำเร็จ (Success)</SelectItem>
                <SelectItem value="DENIED">ถูกปฏิเสธ (Denied)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={() => fetchLogs()} disabled={loading}>
            <Filter className="h-4 w-4 mr-2" />
            ค้นหา
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto relative z-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>วัน-เวลา</TableHead>
                <TableHead>ผู้ดำเนินการ (Actor)</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>ข้อมูลที่อ้างอิง (Target)</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">กำลังโหลดข้อมูล...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">ไม่พบประวัติการใช้งานตามเงื่อนไขที่เลือก</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow className={expandedRows.has(log.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => toggleRow(log.id)}>
                          {expandedRows.has(log.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm', { locale: th })}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="flex flex-col">
                          <span className="font-medium truncate" title={log.actorName || 'System'}>
                            {log.actorName || (log.actorUserId ? 'Unknown User' : 'System')}
                          </span>
                          {log.actorEmail && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {log.actorEmail}
                            </span>
                          )}
                          {log.actorUserId && (
                            <span className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
                              ID: {log.actorUserId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-background">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.targetType} {log.targetId ? <span className="text-xs text-muted-foreground ml-1">({log.targetId.slice(-6)})</span> : ''}
                      </TableCell>
                      <TableCell>
                        {log.status === 'SUCCESS' ? (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1"/> Success</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> Denied</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {/* Expanded Content */}
                    {expandedRows.has(log.id) && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-4">
                              {log.note && (
                                <div>
                                  <span className="font-semibold text-muted-foreground">หมายเหตุ:</span>
                                  <p className="mt-1">{log.note}</p>
                                </div>
                              )}
                              {log.reason && (
                                <div>
                                  <span className="font-semibold text-destructive">เหตุผลถูกปฏิเสธ/ยกเลิก (Reason):</span>
                                  <p className="mt-1 text-destructive">{log.reason}</p>
                                </div>
                              )}
                            </div>
                            <div className="space-y-4">
                              {log.beforeSnapshot && (
                                <div>
                                  <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Before Snapshot</span>
                                  <pre className="mt-1 bg-background border p-2 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(log.beforeSnapshot, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.afterSnapshot && (
                                <div>
                                  <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">After Snapshot</span>
                                  <pre className="mt-1 bg-background border p-2 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(log.afterSnapshot, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Info */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            หน้า {page} จาก {totalPages || 1}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ก่อนหน้า
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              หน้าถัดไป
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
