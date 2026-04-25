'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '@/actions/core/audit.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { History, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AuditDiffViewer } from '@/components/ui/audit-diff-viewer';
import { LocalPagination } from '@/components/ui/local-pagination';

interface ProductAuditTabProps {
  productId: string;
}

export function ProductAuditTab({ productId }: ProductAuditTabProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        page,
        limit: 10,
        targetType: 'Product',
        targetId: productId,
      });

      if (result.success) {
        setLogs(result.data.data);
        setTotalPages(result.data.totalPages);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('ไม่สามารถโหลดประวัติการแก้ไขได้');
    } finally {
      setLoading(false);
    }
  }, [productId, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  if (loading && logs.length === 0) {
    return <div className="space-y-4 animate-pulse">
      <div className="h-40 bg-muted rounded-md" />
      <div className="h-40 bg-muted rounded-md" />
    </div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">ประวัติการแก้ไขข้อมูล (Audit Trail)</CardTitle>
          </div>
          <CardDescription>
            บันทึกความเปลี่ยนแปลงของคุณสมบัติผลิตภัณฑ์ ราคา และการตั้งค่าต่างๆ
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="rounded-xl border bg-background overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="w-[180px]">วัน-เวลา</TableHead>
                  <TableHead className="w-[200px]">ผู้ดำเนินการ</TableHead>
                  <TableHead>การกระทำ (Action)</TableHead>
                  <TableHead className="text-right">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                        <p>ยังไม่มีบันทึกการแก้ไขข้อมูลสำหรับสินค้านี้</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow 
                        className={`group transition-colors ${expandedRows.has(log.id) ? 'bg-indigo-50/30' : 'hover:bg-muted/50'}`}
                      >
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-indigo-600"
                            onClick={() => toggleRow(log.id)}
                          >
                            {expandedRows.has(log.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {format(new Date(log.createdAt), 'dd MMM yy • HH:mm', { locale: th })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate max-w-[180px]">
                              {log.actorName || 'ระบบอัตโนมัติ'}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                              {log.actorEmail || ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] bg-white">
                              {log.action}
                            </Badge>
                            {log.note && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={log.note}>
                                {log.note}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {log.status === 'SUCCESS' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1"/> สำเร็จ
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                              <XCircle className="w-3 h-3 mr-1"/> ล้มเหลว
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      
                      {expandedRows.has(log.id) && (
                        <TableRow className="bg-indigo-50/10 border-indigo-100">
                          <TableCell colSpan={5} className="p-0 border-b">
                            <div className="p-6 bg-white/50 backdrop-blur-sm">
                              <div className="mb-6">
                                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                                  <div className="w-1 h-3 bg-indigo-600 rounded-full" />
                                  รายละเอียดการเปลี่ยนแปลง
                                </h4>
                                <AuditDiffViewer 
                                  beforeSnapshot={log.beforeSnapshot} 
                                  afterSnapshot={log.afterSnapshot} 
                                />
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

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <LocalPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
