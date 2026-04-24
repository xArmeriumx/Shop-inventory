'use client';

import { useState, useTransition } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Edit2,
    Plus,
    RefreshCcw,
    Power,
    PowerOff,
    MoreVertical
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { toggleTaxCode } from '@/actions/tax/tax.actions';
import { TaxCodeForm } from './tax-code-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';

interface TaxCodeTableProps {
    initialData: any[];
}

export function TaxCodeTable({ initialData }: TaxCodeTableProps) {
    const [data, setData] = useState(initialData);
    const [isPending, startTransition] = useTransition();
    const [editingCode, setEditingCode] = useState<any>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const handleToggle = (code: string, currentStatus: boolean) => {
        startTransition(async () => {
            const res = await toggleTaxCode(code, !currentStatus);
            if (res.success) {
                toast.success(res.message);
                // Refresh local state if needed or rely on revalidatePath
            } else {
                toast.error(res.message);
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">รหัสภาษี (Tax Codes)</h2>
                    <p className="text-sm text-muted-foreground">จัดการผังภาษีสำหรับเอกสารซื้อและขาย</p>
                </div>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingCode(null)}>
                            <Plus className="w-4 h-4 mr-2" />
                            เพิ่มรหัสภาษี
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingCode ? 'แก้ไขรหัสภาษี' : 'เพิ่มรหัสภาษีใหม่'}</DialogTitle>
                        </DialogHeader>
                        <TaxCodeForm
                            initialData={editingCode}
                            onSuccess={() => setIsFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[100px]">รหัส</TableHead>
                            <TableHead>ชื่อรหัสภาษี</TableHead>
                            <TableHead>ประเภท</TableHead>
                            <TableHead>ชนิด</TableHead>
                            <TableHead className="text-right">อัตรา (%)</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead className="w-[70px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    ยังไม่มีรหัสภาษีในระบบ
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.code} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-mono font-medium text-primary">
                                        {item.code}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{item.name}</div>
                                        {item.description && (
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {item.description}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.direction === 'OUTPUT' ? 'default' : 'secondary'}>
                                            {item.direction === 'OUTPUT' ? 'ภาษีขาย' : 'ภาษีซื้อ'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.kind}</div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {item.rate}%
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.isActive ? 'outline' : 'destructive'} className={item.isActive ? 'border-green-500 text-green-600 bg-green-50' : ''}>
                                            {item.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setEditingCode(item);
                                                    setIsFormOpen(true);
                                                }}>
                                                    <Edit2 className="w-4 h-4 mr-2" />
                                                    แก้ไข
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className={item.isActive ? 'text-destructive' : 'text-green-600'}
                                                    onClick={() => handleToggle(item.code, item.isActive)}
                                                    disabled={isPending}
                                                >
                                                    {item.isActive ? (
                                                        <>
                                                            <PowerOff className="w-4 h-4 mr-2" />
                                                            ปิดใช้งาน
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Power className="w-4 h-4 mr-2" />
                                                            เปิดใช้งาน
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
        </div>
    );
}
