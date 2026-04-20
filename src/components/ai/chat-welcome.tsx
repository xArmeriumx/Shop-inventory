'use client';

import { Bot, Sparkles, MessageCircle, Lightbulb, TrendingUp, Package, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUGGESTED_QUESTIONS = [
    { text: 'สรุปยอดขายวันนี้', icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-blue-500' },
    { text: 'เช็คสต็อกสินค้า Labubu', icon: <Package className="h-3.5 w-3.5" />, color: 'text-orange-500' },
    { text: 'บันทึกค่าไฟ 2500 บาท', icon: <CreditCard className="h-3.5 w-3.5" />, color: 'text-emerald-500' },
    { text: 'สินค้าอะไรขายดีเดือนนี้', icon: <Sparkles className="h-3.5 w-3.5" />, color: 'text-amber-500' },
];

interface ChatWelcomeProps {
    onSendMessage: (content: string) => void;
}

export function ChatWelcome({ onSendMessage }: ChatWelcomeProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in-0 duration-1000 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 animate-pulse" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -z-10" />

            {/* Bot Icon with Pulse Aura */}
            <div className="relative mb-8 group cursor-default">
                <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl group-hover:bg-primary/30 transition-all duration-700 animate-pulse" />
                <div className="relative w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-primary via-primary to-primary/80 border border-white/20 flex items-center justify-center shadow-2xl shadow-primary/20 transition-transform duration-700 group-hover:scale-105 group-hover:rotate-3">
                    <Bot className="h-14 w-14 text-primary-foreground" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-11 h-11 rounded-2xl bg-background flex items-center justify-center shadow-xl border border-border/40 animate-bounce transition-all duration-300">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
            </div>

            <div className="max-w-md space-y-4">
                <h2 className="text-4xl font-black tracking-tighter text-foreground leading-[1.1]">
                    มีอะไรให้ผม <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">ช่วยคุณ</span> ในวันนี้?
                </h2>
                <p className="text-muted-foreground font-medium leading-relaxed">
                    ผมคือผู้ช่วยอัจฉริยะประจำร้านของคุณ พร้อมช่วยวิเคราะห์ยอดขาย ตรวจสอบสต็อกสินค้า และบันทึกรายการบัญชีให้คุณแบบเรียลไทม์
                </p>
            </div>

            {/* Suggested Actions Grid */}
            <div className="w-full max-w-2xl mt-12">
                <div className="flex items-center gap-3 mb-6 justify-center">
                    <div className="h-px w-10 bg-gradient-to-r from-transparent to-border" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">คำสั่งที่แนะนำ</span>
                    <div className="h-px w-10 bg-gradient-to-l from-transparent to-border" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                        <Button
                            key={q.text}
                            variant="outline"
                            onClick={() => onSendMessage(q.text)}
                            className="group flex items-center justify-between h-14 px-5 rounded-2xl border-border/40 bg-background/40 hover:bg-white hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 animate-in fade-in-0 slide-in-from-bottom-4"
                            style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-muted/50 group-hover:scale-110 transition-transform duration-500 ${q.color}`}>
                                    {q.icon}
                                </div>
                                <span className="text-sm font-bold tracking-tight text-foreground/80 group-hover:text-primary transition-colors">
                                    {q.text}
                                </span>
                            </div>
                            <MessageCircle className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/40 group-hover:translate-x-1 transition-all" />
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
