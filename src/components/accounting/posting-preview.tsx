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

    return (
        <div className="bg-muted/30 rounded-2xl border border-dashed border-primary/20 overflow-hidden">
            <div className="p-4 bg-primary/5 flex items-center justify-between border-b border-dashed border-primary/10">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                        <Info className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-primary">{title}</h4>
                </div>
                <Badge variant="outline" className="text-[10px] bg-white/50 border-primary/20 text-primary">
                    PREVIEW (ยังไม่บันทึก)
                </Badge>
            </div>

            <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-full mt-0.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium leading-relaxed">
                            เมื่อคุณกดบันทึก ระบบจะสร้าง <span className="font-bold">รายการสมุดรายวัน</span> ให้อัตโนมัติ:
                        </p>
                        <div className="mt-3 space-y-2">
                            {preview.lines.map((line, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                    {line.debitAmount > 0 ? (
                                        <div className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">
                                            <ArrowUpIcon className="w-3 h-3" />
                                            เพิ่มยอด {line.accountName}
                                            <span className="ml-1">+{money.format(line.debitAmount)}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md">
                                            <ArrowDownIcon className="w-3 h-3" />
                                            ลดยอด/รับรู้ {line.accountName}
                                            <span className="ml-1">-{money.format(line.creditAmount)}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-3 italic flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" />
                            นี่คือภาษาธุรกิจเบื้องต้น ฝ่ายบัญชีสามารถเปิดดูรายละเอียดทางบัญชีจริงได้ด้านล่าง
                        </p>
                    </div>
                </div>

                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t pt-4">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[11px] hover:bg-primary/5 text-muted-foreground">
                            <span>แสดงรายละเอียดทางบัญชี (Debit/Credit Lines)</span>
                            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 animate-in slide-in-from-top-2">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden text-xs">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-2 text-left font-bold">บัญชี (Account)</th>
                                        <th className="p-2 text-right font-bold w-[100px]">Debit</th>
                                        <th className="p-2 text-right font-bold w-[100px]">Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.lines.map((line, idx) => (
                                        <tr key={idx} className="border-b last:border-0">
                                            <td className="p-2">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{line.accountName}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground">{line.accountCode}</span>
                                                </div>
                                            </td>
                                            <td className="p-2 text-right font-mono text-blue-600">
                                                {line.debitAmount > 0 ? money.format(line.debitAmount) : '-'}
                                            </td>
                                            <td className="p-2 text-right font-mono text-red-600">
                                                {line.creditAmount > 0 ? money.format(line.creditAmount) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-muted/10 font-bold border-t-2">
                                        <td className="p-2">รวม (Total Balanced)</td>
                                        <td className="p-2 text-right font-mono text-blue-800">{money.format(preview.totalAmount)}</td>
                                        <td className="p-2 text-right font-mono text-red-800">{money.format(preview.totalAmount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
}

import { Button } from '@/components/ui/button';
