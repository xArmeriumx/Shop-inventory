'use client';

import { CheckCircle2, Printer, ShoppingBag, ArrowRight, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';

interface POSSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber?: string;
  saleId?: string;
  amountReceived?: number;
  change?: number;
}

/**
 * POS Success Dialog - Shown after successful transaction
 * Designed with premium aesthetics and clear call-to-actions
 */
export function POSSuccessDialog({
  isOpen,
  onClose,
  invoiceNumber,
  saleId,
  amountReceived,
  change,
}: POSSuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-emerald-500 p-8 text-white text-center relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <Sparkles className="absolute top-4 right-4 h-20 w-20 rotate-12" />
                <CheckCircle2 className="absolute -bottom-10 -left-10 h-40 w-40 -rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm shadow-xl animate-in zoom-in duration-500">
                    <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-1">PAYMENT SUCCESS</h2>
                <p className="text-emerald-100 font-medium">Transaction completed successfully</p>
            </div>
        </div>

        <div className="p-6 bg-white space-y-6">
            <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Invoice No.</span>
                    <span className="font-mono font-black text-slate-800">{invoiceNumber || '---'}</span>
                </div>
                
                {(amountReceived !== undefined && change !== undefined) && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Received</span>
                            <span className="text-lg font-black text-slate-700">{formatCurrency(amountReceived)}</span>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <span className="text-[10px] text-emerald-600 font-bold uppercase block mb-1">Change</span>
                            <span className="text-lg font-black text-emerald-700">{formatCurrency(change)}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3">
                <Button 
                    className="h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-lg group"
                    onClick={() => {
                        window.print(); // Basic print trigger
                    }}
                >
                    <Printer className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                    Print Receipt
                </Button>

                <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-12 border-slate-200 font-bold text-slate-600" asChild>
                        <Link href={`/sales/${saleId}`}>
                            <Share2 className="mr-2 h-4 w-4" />
                            View Order
                        </Link>
                    </Button>
                    <Button variant="outline" className="h-12 border-slate-200 font-bold text-slate-600" onClick={onClose}>
                        <ArrowRight className="mr-2 h-4 w-4 text-primary" />
                        Next Sale
                    </Button>
                </div>
            </div>

            <div className="flex justify-center">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                    <ShoppingBag className="h-3 w-3" />
                    Powered by Antigravity POS
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
