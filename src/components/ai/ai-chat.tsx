'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Bot, User, Loader2, Sparkles, Zap, Check, X, MessageCircle, Lightbulb } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConfirmationData {
  title: string;
  items: { label: string; value: string; icon?: string }[];
  toolName: string;
  params: Record<string, any>;
}

const SUGGESTED_QUESTIONS = [
  { text: 'ยอดขายวันนี้?', icon: '📊' },
  { text: 'เช็คสต็อก Labubu', icon: '📦' },
  { text: 'บันทึกค่าไฟ 2500', icon: '💡' },
  { text: 'สรุปเดือนนี้', icon: '📈' },
  { text: 'เพิ่มสินค้าใหม่', icon: '➕' },
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, streamingContent, confirmation]);

  const handleConfirm = async () => {
    if (!confirmation) return;
    
    setIsConfirming(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmTool: confirmation.toolName,
          confirmParams: confirmation.params,
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      setConfirmation(null);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่' }]);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setConfirmation(null);
    setMessages(prev => [...prev, { role: 'assistant', content: '❌ ยกเลิกการดำเนินการ' }]);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const cleanContent = content.replace(/^[📊🏆⚠️📈💰📦➕💡]\\s*/, '');
    
    const userMessage: Message = { role: 'user', content: cleanContent };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setConfirmation(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.error || 'เกิดข้อผิดพลาด'}` }]);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let hasToolResult = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);
                }
                
                if (parsed.toolResult) {
                  hasToolResult = true;
                  
                  if (parsed.toolResult.requireConfirmation) {
                    setConfirmation(parsed.toolResult.confirmationData);
                    setStreamingContent('');
                  } else {
                    setStreamingContent('');
                    setMessages(prev => [...prev, { role: 'assistant', content: parsed.toolResult.message }]);
                  }
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      if (fullContent && !hasToolResult) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      }
      setStreamingContent('');
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่' }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden border shadow-sm">
      {/* Header */}
      <CardHeader className="border-b py-4 bg-muted/30">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="relative">
            <div className="p-2.5 bg-primary rounded-xl shadow-sm">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">AI ผู้ช่วยอัจฉริยะ</span>
              <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">BETA</span>
            </div>
            <p className="text-xs text-muted-foreground font-normal mt-0.5">
              พร้อมช่วยเหลือคุณตลอด 24 ชั่วโมง
            </p>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-600 dark:text-green-400">Online</span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10" ref={scrollAreaRef}>
          {messages.length === 0 && !streamingContent && !confirmation ? (
            // Welcome Screen
            <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in-0 zoom-in-95 duration-500">
              {/* Bot Icon */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shadow-lg">
                  <Bot className="h-10 w-10 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md">
                  <MessageCircle className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">สวัสดีครับ! 👋</h2>
              <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                ผมคือ AI ผู้ช่วยร้านค้า พร้อมช่วย
                <span className="text-primary font-medium"> บันทึกข้อมูล</span>,
                <span className="text-primary font-medium"> เช็คสต็อก</span> และ
                <span className="text-primary font-medium"> สรุปรายงาน</span> ให้คุณ
              </p>
              
              {/* Suggested Actions */}
              <div className="w-full max-w-lg">
                <div className="flex items-center gap-2 mb-3 justify-center">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">ลองถามคำถามเหล่านี้</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <Button
                      key={q.text}
                      variant="outline"
                      size="sm"
                      onClick={() => sendMessage(q.text)}
                      className="text-sm hover:bg-primary/5 hover:border-primary/30 transition-all animate-in fade-in-0 slide-in-from-bottom-2"
                      style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                    >
                      <span className="mr-1.5">{q.icon}</span>
                      {q.text}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center flex-shrink-0">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border shadow-sm rounded-bl-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Streaming Message */}
              {streamingContent && (
                <div className="flex gap-3 justify-start animate-in fade-in-0 slide-in-from-bottom-2">
                  <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="max-w-[80%] bg-card border shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {streamingContent}
                      <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse rounded-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Dialog */}
              {confirmation && (
                <div className="flex gap-3 justify-start animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300">
                  <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="max-w-[85%] bg-card border-2 border-primary/30 rounded-2xl rounded-bl-md px-5 py-4 shadow-md">
                    <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                      {confirmation.title}
                    </h4>
                    
                    <div className="space-y-2 mb-4">
                      {confirmation.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5">
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-muted-foreground text-sm">{item.label}:</span>
                          <span className="font-medium text-sm">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white"
                      >
                        {isConfirming ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        ยืนยัน
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        disabled={isConfirming}
                        className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4 mr-2" />
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Loading */}
              {isLoading && !streamingContent && !confirmation && (
                <div className="flex gap-3 justify-start animate-in fade-in-0 slide-in-from-bottom-2">
                  <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="bg-card border shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">กำลังคิด...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t bg-card p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์คำสั่ง เช่น 'บันทึกค่าไฟ 2500' หรือ 'สรุปยอดวันนี้'..."
              disabled={isLoading || !!confirmation}
              className="flex-1 py-5 rounded-xl border-2 focus:border-primary/50 transition-all"
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || !!confirmation}
              size="lg"
              className="rounded-xl px-5 transition-all hover:scale-105 disabled:hover:scale-100"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-2.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">
              Powered by Llama 3 • สามารถบันทึกข้อมูล เช็คสต็อก สร้างรายงานได้
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
