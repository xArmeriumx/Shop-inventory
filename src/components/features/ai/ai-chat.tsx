'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Bot, User, Loader2, Sparkles, Zap, Check, X } from 'lucide-react';

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
  '📊 ยอดขายวันนี้?',
  '📦 เช็คสต็อก Labubu',
  '💰 บันทึกค่าไฟ 2500',
  '📈 สรุปเดือนนี้',
  '➕ เพิ่มสินค้าใหม่',
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

    const cleanContent = content.replace(/^[📊🏆⚠️📈💰📦➕]\s*/, '');
    
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
                
                // Handle text content
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);
                }
                
                // Handle tool result
                if (parsed.toolResult) {
                  hasToolResult = true;
                  
                  if (parsed.toolResult.requireConfirmation) {
                    // Show confirmation dialog
                    setConfirmation(parsed.toolResult.confirmationData);
                    setStreamingContent('');
                  } else {
                    // Direct result
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

      // Add final message if not tool result
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
    <Card className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden border-0 shadow-xl bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <CardHeader className="border-b py-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-md animate-pulse" />
            <div className="relative p-2 bg-gradient-to-br from-primary to-primary/80 rounded-full">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <span className="font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              AI ผู้ช่วยร้านค้า
            </span>
            <p className="text-xs text-muted-foreground font-normal mt-0.5">
              Powered by Groq • Llama 3.3 • Function Calling
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-green-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Online
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollAreaRef}>
          {messages.length === 0 && !streamingContent && !confirmation ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in-0 zoom-in-95 duration-500">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-full blur-2xl animate-pulse" />
                <div className="relative p-6 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full">
                  <Bot className="h-16 w-16 text-primary animate-bounce" style={{ animationDuration: '2s' }} />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                สวัสดีครับ! 👋
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                ผมคือ AI ผู้ช่วยร้านค้า สามารถ<span className="text-primary font-medium">บันทึกข้อมูล</span>, 
                <span className="text-primary font-medium"> เช็คสต็อก</span>, และ
                <span className="text-primary font-medium"> สรุปรายงาน</span>ให้คุณได้
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(q)}
                    className="text-sm hover:bg-primary/10 hover:border-primary/50 hover:scale-105 transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-2"
                    style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                  >
                    {q}
                  </Button>
                ))}
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
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-br-sm'
                        : 'bg-card border border-border/50 rounded-bl-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/25">
                      <User className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Streaming Message */}
              {streamingContent && (
                <div className="flex gap-3 justify-start animate-in fade-in-0 slide-in-from-bottom-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="max-w-[80%] bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {streamingContent}
                      <span className="inline-block w-2 h-4 bg-primary/60 ml-0.5 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Dialog */}
              {confirmation && (
                <div className="flex gap-3 justify-start animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="max-w-[85%] bg-gradient-to-br from-card to-muted/30 border-2 border-primary/30 rounded-2xl rounded-bl-sm px-5 py-4 shadow-lg">
                    <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                      {confirmation.title}
                    </h4>
                    
                    <div className="space-y-2 mb-4">
                      {confirmation.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-background/50 rounded-lg px-3 py-2">
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
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-lg shadow-green-500/25"
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
                        className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
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
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">กำลังประมวลผล...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t bg-gradient-to-r from-background via-muted/30 to-background p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์คำสั่ง เช่น 'บันทึกค่าไฟ 2500' หรือ 'สรุปยอดวันนี้'..."
              disabled={isLoading || !!confirmation}
              className="flex-1 py-5 rounded-xl border-2 focus:border-primary/50 transition-all bg-background/80"
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || !!confirmation}
              size="lg"
              className="rounded-xl px-5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all hover:scale-105 disabled:hover:scale-100"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-2">
            <Zap className="h-3 w-3 inline mr-1" />
            AI สามารถบันทึกข้อมูล เช็คสต็อก และสร้างรายงานได้
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
