'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Wallet, Calculator, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface FinancialSummarySectionProps {
  data: any;
}

export function FinancialSummarySection({ data }: FinancialSummarySectionProps) {
  return (
    <Card className="rounded-[2rem] border-primary/10 shadow-2xl overflow-hidden bg-foreground text-background">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Financial Conclusion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs opacity-70">
            <span className="flex items-center gap-2">
              <Wallet className="h-3 w-3" />
              มูลค่าฐานภาษี (Taxable Base)
            </span>
            <span className="font-mono">{formatCurrency(Number(data.taxableBaseAmount))}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm font-bold text-primary">
            <span className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              ภาษีมูลค่าเพิ่ม ({data.taxRateSnapshot}%)
            </span>
            <span className="text-lg font-black font-mono">
              {formatCurrency(Number(data.taxAmount))}
            </span>
          </div>
        </div>

        <Separator className="opacity-20" />

        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase text-primary/70 mb-1 text-right">Net Value</p>
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-[10px] opacity-50 font-medium">ยอดรวมสุทธิทั้งสิ้น</span>
            <span className="text-4xl font-black tracking-tighter text-white font-mono leading-none">
              {formatCurrency(Number(data.netAmount))}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
            Real-time Fiscal Tally
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
