'use client';

import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Power, PowerOff, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toggleWhtCodeStatus } from '@/actions/tax/wht.actions';
import { toast } from 'sonner';
import { WhtCodeForm } from '@/components/tax/wht-code-form';

interface WhtCodeTableProps {
    data: any[];
}

export function WhtCodeTable({ data }: WhtCodeTableProps) {
    const [editingCode, setEditingCode] = useState<any | null>(null);

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await toggleWhtCodeStatus(id, !currentStatus);
            toast.success('อัปเดตสถานะรหัสภาษีเสร็จสมบูรณ์');
        } catch (error) {
            toast.error('ไม่สามารถอัปเดตสถานะได้');
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>รหัส/ประเภท</TableHead>
                            <TableHead>อัตราภาษี</TableHead>
                            <TableHead>แบบฟอร์ม</TableHead>
                            <TableHead>ผู้รับเงิน</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    ยังไม่มีรหัสภาษีหัก ณ ที่จ่าย
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.code}</span>
                                            <span className="text-xs text-muted-foreground">{item.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Percent className="w-3 h-3 text-muted-foreground" />
                                            <span className="font-semibold">{item.rate.toString()}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={item.formType === 'PND53' ? 'border-amber-500 text-amber-600' : 'border-blue-500 text-blue-600'}>
                                            {item.formType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {item.payeeType === 'INDIVIDUAL' ? 'บุคคลธรรมดา' :
                                                item.payeeType === 'CORPORATE' ? 'นิติบุคคล' : 'ทั่วไป'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.isActive ? 'default' : 'secondary'}>
                                            {item.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingCode(item)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    แก้ไข
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleToggleStatus(item.id, item.isActive)}
                                                    className={item.isActive ? 'text-destructive' : 'text-primary'}
                                                >
                                                    {item.isActive ? (
                                                        <>
                                                            <PowerOff className="mr-2 h-4 w-4" />
                                                            ปิดการใช้งาน
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Power className="mr-2 h-4 w-4" />
                                                            เปิดการใช้งาน
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {editingCode && (
                <WhtCodeForm
                    data={editingCode}
                    onClose={() => setEditingCode(null)}
                />
            )}
        </div>
    );
}
