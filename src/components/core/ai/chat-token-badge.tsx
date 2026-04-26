'use client';

import React from 'react';
import { TokenUsage } from '@/hooks/use-ai-chat';
import { AI_CONFIG } from '@/lib/ai';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatTokenBadgeProps {
    usage: TokenUsage | null;
}

export function ChatTokenBadge({ usage }: ChatTokenBadgeProps) {
    if (!usage) return null;

    const { totalTokens, promptTokens, completionTokens } = usage;
    const { warning, danger } = AI_CONFIG.ui.tokenThresholds;

    let statusColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    let icon = <Zap className="w-3 h-3 mr-1" />;

    if (totalTokens >= danger) {
        statusColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse';
        icon = <Activity className="w-3 h-3 mr-1" />;
    } else if (totalTokens >= warning) {
        statusColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        icon = <Cpu className="w-3 h-3 mr-1" />;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className={cn("px-2 py-0.5 text-[10px] font-mono flex items-center transition-all duration-300", statusColor)}>
                        {icon}
                        {totalTokens.toLocaleString()} tokens
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] bg-background/95 backdrop-blur border border-border shadow-xl p-2 font-mono">
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Prompt:</span>
                            <span className="text-foreground">{promptTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Completion:</span>
                            <span className="text-foreground">{completionTokens.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-border my-1" />
                        <div className="flex justify-between gap-4 font-bold">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="text-foreground">{totalTokens.toLocaleString()}</span>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
