'use client';

import React from 'react';
import { Sparkles, Send, Loader2, Zap, Command, ShieldCheck, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAIChat } from '@/hooks/use-ai-chat';
import { ChatMessage } from './chat-message';
import { ChatConfirmation } from './chat-confirmation';
import { ChatWelcome } from './chat-welcome';
import { ChatTokenBadge } from './chat-token-badge';

export function AIChat() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    streamingContent,
    confirmation,
    isConfirming,
    tokenUsage,
    scrollAreaRef,
    sendMessage,
    handleConfirm,
    handleCancel,
  } = useAIChat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100vh-8rem)] overflow-hidden border-border/40 shadow-2xl shadow-muted/20 rounded-none md:rounded-[2.5rem] bg-background/60 backdrop-blur-xl relative">
      {/* Immersive background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15] -z-10" />

      {/* Header */}
      <CardHeader className="border-b border-border/40 py-4 md:py-6 bg-background/40 backdrop-blur-sm z-10 shrink-0">
        <CardTitle className="flex items-center gap-3 md:gap-5 text-xl">
          <div className="relative group/bot cursor-pointer shrink-0">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:bg-primary/30 transition-all duration-500 opacity-0 group-hover:opacity-100" />
            <div className="relative p-2.5 md:p-3.5 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg shadow-primary/20 transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-green-500 border-4 border-background rounded-full shadow-sm" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-2.5">
              <span className="font-black tracking-tighter text-lg md:text-2xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 truncate">ผู้ช่วยอัจฉริยะ</span>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black bg-primary/10 text-primary rounded-xl border border-primary/20 uppercase tracking-widest shadow-sm shrink-0">
                <Cpu className="h-3 w-3" />
                AI SYSTEM
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <ShieldCheck className="h-3 w-3 md:h-3.5 md:w-3.5 text-blue-500/80 shrink-0" />
              <p className="text-[10px] md:text-xs text-muted-foreground font-bold tracking-tight opacity-80 truncate">
                เชื่อมต่อข้อมูลร้านค้าอย่างปลอดภัย
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-5 md:py-2.5 bg-muted/40 border border-border/40 rounded-2xl shadow-inner group/status cursor-help shrink-0">
              <div className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-green-500" />
              </div>
              <span className="text-[9px] md:text-[11px] font-black text-foreground/70 uppercase tracking-[0.1em] md:tracking-[0.15em] group-hover:text-green-600 transition-colors">READY</span>
            </div>
            <ChatTokenBadge usage={tokenUsage} />
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden relative">
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 md:py-8 space-y-8 md:space-y-10 scrollbar-none" ref={scrollAreaRef}>
          {messages.length === 0 && !streamingContent && !confirmation ? (
            <ChatWelcome onSendMessage={sendMessage} />
          ) : (
            <div className="max-w-4xl mx-auto w-full space-y-8">
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}

              {streamingContent && (
                <ChatMessage message={{ role: 'assistant', content: streamingContent }} isStreaming={true} />
              )}

              {confirmation && (
                <ChatConfirmation
                  confirmation={confirmation}
                  isConfirming={isConfirming}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                />
              )}

              {isLoading && !streamingContent && !confirmation && (
                <div className="flex gap-4 justify-start animate-in fade-in-0 duration-700">
                  <div className="w-10 h-10 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center shadow-inner">
                    <Loader2 className="h-5 w-5 text-primary/60 animate-spin" />
                  </div>
                  <div className="bg-card/60 backdrop-blur-sm border border-border/20 shadow-sm rounded-2xl px-6 py-3.5 flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                    </div>
                    <span className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">กำลังคิด</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area - Command Center Style */}
        <div className="p-4 md:p-8 pt-0 z-10 bg-gradient-to-t from-background via-background/80 to-transparent">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group/form">
              <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-2xl opacity-0 group-focus-within/form:opacity-100 transition-opacity duration-700" />

              <div className="relative flex items-center gap-2 p-1.5 md:p-2 bg-background/80 backdrop-blur-md border-2 border-border/40 rounded-2xl md:rounded-[2rem] shadow-2xl transition-all duration-500 group-focus-within/form:border-primary/40 group-focus-within/form:shadow-primary/5">
                <div className="hidden md:block pl-4 text-muted-foreground/40 group-focus-within/form:text-primary/40 transition-colors">
                  <Command className="h-5 w-5" />
                </div>

                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="พิมพ์คำถามที่นี่..."
                  disabled={isLoading || !!confirmation}
                  className="flex-1 h-12 md:h-14 bg-transparent border-none focus-visible:ring-0 text-sm md:text-[15px] font-medium placeholder:text-muted-foreground/40 placeholder:font-bold px-4"
                />

                <Button
                  type="submit"
                  disabled={isLoading || !input.trim() || !!confirmation}
                  size="icon"
                  className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl transition-all duration-500 hover:scale-105 active:scale-95 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:grayscale"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between px-4 md:px-6 mt-3 md:mt-4">
                <div className="flex items-center gap-2 text-muted-foreground/40">
                  <Zap className="h-3 w-3" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] transition-colors group-focus-within/form:text-primary/40">
                    SMART COMMAND READY
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted/40 border border-border/40 rounded-lg text-[9px] font-black text-muted-foreground/60">ENTER</kbd>
                  <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">เพื่อส่งข้อความ</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
