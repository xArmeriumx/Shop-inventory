'use client';

import { Command } from 'lucide-react';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function ShortcutHelp() {
    return (
        <div className="fixed bottom-4 right-4 z-50">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="h-10 w-10 flex items-center justify-center bg-white border rounded-full shadow-lg cursor-help hover:bg-slate-50 transition-colors">
                            <Command className="h-4 w-4 text-slate-500" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-slate-900 text-white border-slate-700 p-4 w-64 shadow-2xl">
                        <div className="space-y-3">
                            <h4 className="font-black text-[10px] uppercase tracking-widest text-primary border-b border-slate-700 pb-1">POS Hotkeys</h4>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Search / Scan</span>
                                <kbd className="px-2 py-1 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">F2</kbd>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Checkout</span>
                                <kbd className="px-2 py-1 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">F9</kbd>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Clear Cart</span>
                                <kbd className="px-2 py-1 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">ESC</kbd>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
