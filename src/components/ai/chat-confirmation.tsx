'use client';

import { Bot, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationData } from '@/hooks/use-ai-chat';

interface ChatConfirmationProps {
    confirmation: ConfirmationData;
    isConfirming: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ChatConfirmation({ confirmation, isConfirming, onConfirm, onCancel }: ChatConfirmationProps) {
    return (
        <div className="flex gap-3 justify-start animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300">
            <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="max-w-[85%] bg-card border-2 border-primary/30 rounded-2xl rounded-bl-md px-5 py-4 shadow-md">
                <h4 className="font-bold text-base mb-3 flex items-center gap-2">
                    {confirmation.title}
                </h4>

                <div className="space-y-2 mb-4">
                    {confirmation.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2.5 border border-border/20">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{item.label}:</span>
                            <span className="font-bold text-sm text-foreground">{item.value}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={onConfirm}
                        disabled={isConfirming}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 transition-all font-bold"
                    >
                        {isConfirming ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Check className="h-4 w-4 mr-2" />
                        )}
                        ยืนยัน
                    </Button>
                    <Button
                        onClick={onCancel}
                        variant="outline"
                        disabled={isConfirming}
                        className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl font-bold"
                    >
                        <X className="h-4 w-4 mr-2" />
                        ยกเลิก
                    </Button>
                </div>
            </div>
        </div>
    );
}
