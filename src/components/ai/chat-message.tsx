'use client';

import { Bot, User } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/hooks/use-ai-chat';

interface ChatMessageProps {
    message: ChatMessageType;
    isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
    const isAssistant = message.role === 'assistant';

    return (
        <div className={`flex gap-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
            {isAssistant && (
                <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-muted/80 to-muted border border-border/40 flex items-center justify-center shadow-sm">
                        <Bot className="h-5 w-5 text-primary/80" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                </div>
            )}

            <div
                className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 shadow-sm transition-all duration-300 ${isAssistant
                        ? 'bg-card/80 backdrop-blur-md border border-border/40 rounded-2xl rounded-tl-sm text-foreground'
                        : 'bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground rounded-2xl rounded-tr-sm shadow-lg shadow-primary/10'
                    }`}
            >
                <div className="whitespace-pre-wrap text-[14px] leading-relaxed font-medium tracking-tight">
                    {message.content}
                    {isStreaming && (
                        <span className="inline-flex ml-1.5 align-baseline">
                            <span className="w-1.5 h-3.5 bg-primary/40 rounded-full animate-pulse" />
                        </span>
                    )}
                </div>
            </div>

            {!isAssistant && (
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <User className="h-5 w-5 text-primary-foreground" />
                    </div>
                </div>
            )}
        </div>
    );
}
