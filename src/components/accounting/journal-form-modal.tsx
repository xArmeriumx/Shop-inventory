'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { money } from '@/lib/money';
import { createJournalAction } from '@/actions/journal';
import { cn } from '@/lib/utils';

interface JournalFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: any[];
}

export function JournalFormModal({ isOpen, onClose, accounts }: JournalFormModalProps) {
    const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState<any[]>([
        { accountId: '', description: '', debitAmount: 0, creditAmount: 0 },
        { accountId: '', description: '', debitAmount: 0, creditAmount: 0 },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter only postable accounts
    const postableAccounts = accounts.filter(a => a.isPostable);

    const addLine = () => {
        setLines([...lines, { accountId: '', description: '', debitAmount: 0, creditAmount: 0 }]);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) {
            toast.error('รายการบัญชีต้องมีอย่างน้อย 2 แถว');
            return;
        }
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index][field] = value;

        // Rule: One of debit/credit only
        if (field === 'debitAmount' && value > 0) newLines[index].creditAmount = 0;
        if (field === 'creditAmount' && value > 0) newLines[index].debitAmount = 0;

        setLines(newLines);
    };

    const totalDebit = lines.reduce((sum, line) => money.add(sum, Number(line.debitAmount) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => money.add(sum, Number(line.creditAmount) || 0), 0);
    const isBalanced = money.isEqual(totalDebit, totalCredit) && totalDebit > 0;

    const handleSubmit = async () => {
        if (!isBalanced) {
            toast.error('รายการไม่สมดุล หรือยังไม่ได้ระบุจำนวนเงิน');
            return;
        }

        if (lines.some(l => !l.accountId)) {
            toast.error('กรุณาระบุบัญชีให้ครบทุกบรรทัด');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createJournalAction({
                journalDate,
                description,
                lines: lines.map(l => ({
                    ...l,
                    debitAmount: Number(l.debitAmount),
                    creditAmount: Number(l.creditAmount)
                })),
                status: 'POSTED' // Post immediately for now
            });

            if (res.success) {
                toast.success('บันทึกรายการสำเร็จ');
                onClose();
                // Reset form
                setLines([
                    { accountId: '', description: '', debitAmount: 0, creditAmount: 0 },
                    { accountId: '', description: '', debitAmount: 0, creditAmount: 0 },
                ]);
                setDescription('');
            } else {
                toast.error(res.message || 'เกิดข้อผิดพลาดในการบันทึก');
            }
        } catch (err) {
            toast.error('Error submitting journal');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>ลงรายการสมุดรายวันใหม่ (Journal Voucher)</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4 border-b">
                    <div className="space-y-2">
                        <Label>วันที่ลงบัญชี</Label>
                        <Input
                            type="date"
                            value={journalDate}
                            onChange={(e) => setJournalDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>คำอธิบายรายการ (Header)</Label>
                        <Input
                            placeholder="เช่น ยอดยกมา, จ่ายค่าเช่า..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="py-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">บัญชี</TableHead>
                                <TableHead>คำอธิบาย (Line)</TableHead>
                                <TableHead className="w-[120px] text-right">Debit</TableHead>
                                <TableHead className="w-[120px] text-right">Credit</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lines.map((line, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <Select
                                            value={line.accountId}
                                            onValueChange={(val) => updateLine(index, 'accountId', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="เลือกผังบัญชี..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {postableAccounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        <span className="font-mono text-xs mr-2 text-muted-foreground">{acc.code}</span>
                                                        {acc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            placeholder="..."
                                            value={line.description}
                                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="text-right font-mono"
                                            placeholder="0.00"
                                            value={line.debitAmount || ''}
                                            onChange={(e) => updateLine(index, 'debitAmount', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="text-right font-mono"
                                            placeholder="0.00"
                                            value={line.creditAmount || ''}
                                            onChange={(e) => updateLine(index, 'creditAmount', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500"
                                            onClick={() => removeLine(index)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-2"
                        onClick={addLine}
                    >
                        <Plus className="w-4 h-4" /> เพิ่มบรรทัด
                    </Button>
                </div>

                <div className={cn(
                    "p-6 rounded-2xl space-y-4 border shadow-inner transition-all duration-300",
                    isBalanced ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"
                )}>
                    <div className="flex justify-between items-center px-2">
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                ยอดรวมเดบิต (Debit Total)
                            </span>
                            <p className="font-mono text-2xl font-bold text-blue-700">{money.format(totalDebit)}</p>
                        </div>

                        <div className="h-10 w-[1px] bg-muted-foreground/20 mx-4 hidden md:block"></div>

                        <div className="space-y-1 text-right">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center justify-end gap-1.5">
                                ยอดรวมเครดิต (Credit Total)
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                            </span>
                            <p className="font-mono text-2xl font-bold text-rose-700">{money.format(totalCredit)}</p>
                        </div>
                    </div>

                    <div className={cn(
                        "flex items-center justify-center p-3 rounded-xl border-2 border-dashed transition-all",
                        isBalanced ? "bg-emerald-100/50 border-emerald-300 text-emerald-800" : "bg-rose-100/50 border-rose-300 text-rose-800"
                    )}>
                        {isBalanced ? (
                            <div className="flex items-center gap-3 font-bold animate-in zoom-in-95 duration-500">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                <div className="flex flex-col">
                                    <span className="text-sm">รายการสมดุลแล้ว (Balanced)</span>
                                    <span className="text-[10px] font-normal opacity-70">ยอดเดบิตและเครดิตเท่ากัน พร้อมสำหรับการบันทึก</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 font-bold animate-in slide-in-from-bottom-1 overflow-hidden">
                                <AlertTriangle className="w-6 h-6 text-rose-600" />
                                <div className="flex flex-col">
                                    <span className="text-sm">
                                        {totalDebit === 0 && totalCredit === 0
                                            ? 'กรุณาระบุจำนวนเงินทั้งสองฝั่ง'
                                            : `รายการไม่สมดุล (ยังขาดอีก ${money.format(Math.abs(money.subtract(totalDebit, totalCredit)))})`}
                                    </span>
                                    <span className="text-[10px] font-normal opacity-70">
                                        {totalDebit === 0 && totalCredit === 0
                                            ? 'ยอดรวมบัญชีต้องไม่เป็นศูนย์'
                                            : 'ยอดเดบิตและเครดิตต้องเท่ากันเป๊ะตามหลักการบัญชีคู่'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-6 border-t pt-4">
                    <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isBalanced || isSubmitting}
                        className="min-w-[120px]"
                    >
                        {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
