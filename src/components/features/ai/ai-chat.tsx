'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  { text: 'ยอดขายวันนี้?', icon: '📊', color: 'from-blue-500 to-cyan-500' },
  { text: 'เช็คสต็อก Labubu', icon: '📦', color: 'from-orange-500 to-amber-500' },
  { text: 'บันทึกค่าไฟ 2500', icon: '💡', color: 'from-yellow-500 to-orange-500' },
  { text: 'สรุปเดือนนี้', icon: '📈', color: 'from-green-500 to-emerald-500' },
  { text: 'เพิ่มสินค้าใหม่', icon: '➕', color: 'from-purple-500 to-pink-500' },
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
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-t-2xl border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdi0ySDEweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50" />
        
        <div className="relative px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur-lg opacity-60 animate-pulse" />
              <div className="relative p-3 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-xl">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                AI ผู้ช่วยอัจฉริยะ
                <span className="px-2 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded-full">BETA</span>
              </h1>
              <p className="text-sm text-white/60">พร้อมช่วยเหลือคุณตลอด 24 ชั่วโมง</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Online</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-x border-white/5">
        <div className="h-full overflow-y-auto p-6 space-y-6" ref={scrollAreaRef}>
          {messages.length === 0 && !streamingContent && !confirmation ? (
            // Welcome Screen
            <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in-0 zoom-in-95 duration-700">
              {/* Animated Bot Icon */}
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/40 via-purple-500/40 to-fuchsia-500/40 rounded-full blur-3xl animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-t from-violet-500/20 to-transparent rounded-full blur-2xl" />
                <div className="relative">
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 p-1 shadow-2xl shadow-purple-500/30 rotate-3 hover:rotate-0 transition-transform duration-500">
                    <div className="w-full h-full rounded-[20px] bg-slate-900/90 backdrop-blur flex items-center justify-center">
                      <Bot className="h-14 w-14 text-white" />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                สวัสดีครับ! 👋
              </h2>
              <p className="text-white/50 mb-10 max-w-md leading-relaxed text-lg">
                ผมคือ AI ผู้ช่วยร้านค้า พร้อมช่วย
                <span className="text-violet-400 font-medium"> บันทึกข้อมูล</span>,
                <span className="text-cyan-400 font-medium"> เช็คสต็อก</span> และ
                <span className="text-emerald-400 font-medium"> สรุปรายงาน</span> ให้คุณ
              </p>
              
              {/* Suggested Actions */}
              <div className="w-full max-w-2xl">
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-white/40">ลองถามคำถามเหล่านี้</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={q.text}
                      onClick={() => sendMessage(q.text)}
                      className="group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 hover:scale-[1.02] animate-in fade-in-0 slide-in-from-bottom-4"
                      style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${q.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                      <div className="absolute inset-0 border border-white/10 rounded-xl group-hover:border-white/20 transition-colors" />
                      <div className="relative flex items-center gap-3">
                        <span className="text-2xl">{q.icon}</span>
                        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{q.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-white/5 border border-white/10 text-white/90 backdrop-blur-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Streaming Message */}
              {streamingContent && (
                <div className="flex gap-4 justify-start animate-in fade-in-0 slide-in-from-bottom-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="max-w-[75%] bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 backdrop-blur-sm">
                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">
                      {streamingContent}
                      <span className="inline-block w-2 h-5 bg-violet-500 ml-1 animate-pulse rounded-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Dialog */}
              {confirmation && (
                <div className="flex gap-4 justify-start animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="max-w-[85%] bg-gradient-to-br from-white/10 to-white/5 border-2 border-violet-500/40 rounded-2xl px-6 py-5 backdrop-blur-sm shadow-xl shadow-purple-500/10">
                    <h4 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                      {confirmation.title}
                    </h4>
                    
                    <div className="space-y-2 mb-5">
                      {confirmation.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                          <span className="text-xl">{item.icon}</span>
                          <span className="text-white/50 text-sm">{item.label}:</span>
                          <span className="font-semibold text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-emerald-500/25 h-11"
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
                        className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-11"
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
                <div className="flex gap-4 justify-start animate-in fade-in-0 slide-in-from-bottom-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20 animate-pulse">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-white/40">กำลังคิด...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="relative overflow-hidden rounded-b-2xl border border-white/10 border-t-0">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        <div className="relative px-6 py-5">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์คำสั่ง เช่น 'บันทึกค่าไฟ 2500' หรือ 'สรุปยอดวันนี้'..."
                disabled={isLoading || !!confirmation}
                className="w-full py-6 px-5 rounded-xl bg-white/5 border-2 border-white/10 focus:border-violet-500/50 text-white placeholder:text-white/30 text-[15px] transition-all focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || !!confirmation}
              size="lg"
              className="h-[52px] px-6 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30 disabled:hover:scale-100 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-white/30">
              Powered by Llama 3 • สามารถบันทึกข้อมูล เช็คสต็อก สร้างรายงานได้
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
