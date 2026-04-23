'use client';

import {
    CheckCircle2,
    HelpCircle,
    Info,
    ChevronDown,
    ChevronUp,
    ArrowRightLeft,
    ArrowDownIcon,
    ArrowUpIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { money } from '@/lib/money';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface PostingPreviewProps {
    preview: {
        journalDate: Date;
        description: string;
        totalAmount: number;
        lines: any[];
    };
    title?: string;
}

export function PostingPreview({ preview, title = 'ตัวอย่างการลงบัญชี' }: PostingPreviewProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Sanitize values to Number to avoid Decimal warnings
    const totalAmount = Number(preview.totalAmount);
    const sanitizedLines = preview.lines.map(line => ({
        ...line,
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
    }));

    return (
        <div className="bg-muted/30 rounded-2xl border border-dashed border-primary/20 overflow-hidden shadow-sm">
            <div className="p-4 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dashed border-primary/10">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-primary/10 p-1.5 rounded-lg text-primary shrink-0">
                        <Info className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-primary truncate">{title}</h4>
                </div>
                <Badge variant="outline" className="text-[10px] bg-white/50 border-primary/20 text-primary w-fit shrink-0">
                    PREVIEW (ยังไม่บันทึก)
                </Badge>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-full mt-0.5 shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium leading-relaxed">
                            เมื่อคุณกดบันทึก ระบบจะสร้าง <span className="font-bold">รายการสมุดรายวัน</span> ให้อัตโนมัติ:
                        </p>
                        <div className="mt-3 space-y-2">
                            {sanitizedLines.map((line, idx) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2 text-xs">
                                    {line.debitAmount > 0 ? (
                                        <div className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md max-w-full">
                                            <ArrowUpIcon className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{line.accountName}</span>
                                            <span className="shrink-0">+{money.format(line.debitAmount)}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md max-w-full">
                                            <ArrowDownIcon className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{line.accountName}</span>
                                            <span className="shrink-0">-{money.format(line.creditAmount)}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-3 italic flex items-start gap-1">
                            <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>นี่คือภาษาธุรกิจเบื้องต้น ฝ่ายบัญชีสามารถเปิดดูรายละเอียดทางบัญชีจริงได้ด้านล่าง</span>
                        </p>
                    </div>
                </div>

                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t pt-4">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[11px] hover:bg-primary/5 text-muted-foreground px-2">
                            <span>แสดงรายละเอียดทางบัญชี (Debit/Credit Lines)</span>
                            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 animate-in slide-in-from-top-2">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden text-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[300px]">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-2 text-left font-bold">บัญชี (Account)</th>
                                            <th className="p-2 text-right font-bold w-[90px]">Debit</th>
                                            <th className="p-2 text-right font-bold w-[90px]">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sanitizedLines.map((line, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                                                <td className="p-2">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-medium truncate">{line.accountName}</span>
                                                        <span className="text-[10px] font-mono text-muted-foreground">{line.accountCode}</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-right font-mono text-blue-600 whitespace-nowrap">
                                                    {line.debitAmount > 0 ? money.format(line.debitAmount) : '-'}
                                                </td>
                                                <td className="p-2 text-right font-mono text-red-600 whitespace-nowrap">
                                                    {line.creditAmount > 0 ? money.format(line.creditAmount) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-muted/10 font-bold border-t-2">
                                            <td className="p-2">รวม (Total Balanced)</td>
                                            <td className="p-2 text-right font-mono text-blue-800 whitespace-nowrap">{money.format(totalAmount)}</td>
                                            <td className="p-2 text-right font-mono text-red-800 whitespace-nowrap">{money.format(totalAmount)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
}

import { Button } from '@/components/ui/button';
