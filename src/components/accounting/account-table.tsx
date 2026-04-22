'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Wallet, PieChart, TrendingUp, TrendingDown, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccountTableProps {
    data: any[];
    mode?: 'simple' | 'advanced';
}

const CATEGORY_NAMES: Record<string, string> = {
    '1': 'สินทรัพย์ (Assets)',
    '2': 'หนี้สิน (Liabilities)',
    '3': 'ส่วนของเจ้าของ (Equity)',
    '4': 'รายได้ (Revenue)',
    '5': 'ค่าใช้จ่าย (Expenses)',
};

const CATEGORY_ICONS: Record<string, any> = {
    '1': Wallet,
    '2': Landmark,
    '3': PieChart,
    '4': TrendingUp,
    '5': TrendingDown,
};

export function AccountTable({ data, mode = 'simple' }: AccountTableProps) {
    // Group accounts by category (first digit of code)
    const grouped = data.reduce((acc: any, account: any) => {
        const cat = account.code[0];
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(account);
        return acc;
    }, {});

    const categories = Object.keys(grouped).sort();

    return (
        <div className="space-y-8">
            {categories.map((cat) => {
                const accounts = grouped[cat];
                const Icon = CATEGORY_ICONS[cat] || Wallet;

                return (
                    <div key={cat} className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className="bg-primary/10 p-1.5 rounded-lg">
                                <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                                {CATEGORY_NAMES[cat] || `Category ${cat}`}
                            </h3>
                            <div className="h-[px] flex-1 bg-muted/50"></div>
                        </div>

                        <div className="border rounded-xl shadow-sm overflow-hidden bg-background">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[120px]">รหัสบัญชี</TableHead>
                                        <TableHead>รายละเอียดบัญชี</TableHead>
                                        {mode === 'advanced' && (
                                            <>
                                                <TableHead className="w-[150px]">พฤติกรรม (Normal Balance)</TableHead>
                                                <TableHead className="w-[120px] text-center">ลงรายการได้ (Postable)?</TableHead>
                                            </>
                                        )}
                                        <TableHead className="w-[100px] text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.map((acc: any) => (
                                        <TableRow key={acc.id} className={cn("hover:bg-muted/5", !acc.isPostable && "bg-muted/10")}>
                                            <TableCell className="font-mono text-xs font-bold text-primary">
                                                {acc.code}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className={cn(
                                                        "font-medium",
                                                        !acc.isPostable && "font-bold text-muted-foreground"
                                                    )}>
                                                        {acc.name}
                                                    </span>
                                                    {mode === 'simple' && !acc.isPostable && (
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">หมวดหมู่หลัก (Abstract Group)</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            {mode === 'advanced' && (
                                                <>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] font-bold",
                                                            acc.normalBalance === 'DEBIT' ? "text-blue-600 border-blue-100 bg-blue-50/30" : "text-red-500 border-red-100 bg-red-50/30"
                                                        )}>
                                                            {acc.normalBalance === 'DEBIT' ? 'เดบิต (Debit)' : 'เครดิต (Credit)'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {acc.isPostable ? (
                                                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">YES</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground text-[10px]">HEADER</Badge>
                                                        )}
                                                    </TableCell>
                                                </>
                                            )}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
