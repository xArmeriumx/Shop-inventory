'use client';

import { BarChart3, Sparkles, ShieldCheck, TrendingUp, TrendingDown, Clock, User, FileText, Send, Receipt, Bell } from 'lucide-react';

export function ReportsView() {
    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold tracking-tight">รายงานและสถิติ</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border bg-background shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="font-bold text-sm">แนวโน้มยอดขาย (7 วันล่าสุด)</div>
                        <div className="flex items-center gap-1 text-green-600 text-[10px] font-bold bg-green-50 px-2 py-0.5 rounded-full">+12.5%</div>
                    </div>
                    <div className="h-40 flex items-end justify-between gap-2 px-2">
                        {[40, 65, 45, 90, 55, 75, 95].map((h, i) => (
                            <div key={i} className="flex-1 bg-muted/30 rounded-t-lg relative group">
                                <div className="absolute bottom-0 inset-x-0 bg-foreground/10 rounded-t-lg transition-all" style={{ height: `${h}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-5 rounded-2xl border bg-background shadow-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase">ยอดออเดอร์เฉลี่ย</div>
                            <div className="text-2xl font-bold">฿1,850</div>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
                    </div>
                    <div className="p-5 rounded-2xl border bg-background shadow-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase">อัตรากำไรขั้นต้น</div>
                            <div className="text-2xl font-bold">24.8%</div>
                        </div>
                        <BarChart3 className="h-8 w-8 text-blue-500 opacity-20" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AIView() {
    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center text-background">
                    <Sparkles className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight leading-none">AI ผู้ช่วยอัจฉริยะ</h1>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Powered by ShopMind Engine</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <div className="space-y-4">
                    <div className="flex gap-3 max-w-[80%]">
                        <div className="h-8 w-8 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-bold">AI</div>
                        <div className="p-4 rounded-2xl bg-muted/50 text-sm leading-relaxed">
                            สวัสดีค่ะ! ฉันวิเคราะห์ข้อมูลร้านของคุณแล้ว พบว่า **Smart Watch S7** ขายดีมากในสัปดาห์นี้ แต่สต็อกเหลือเพียง 2 ชิ้น แนะนำให้สั่งเพิ่มอย่างน้อย 10 ชิ้นเพื่อให้ทันต่อความต้องการค่ะ
                        </div>
                    </div>
                    <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
                        <div className="h-8 w-8 rounded-full bg-foreground shrink-0 flex items-center justify-center text-background text-[10px] font-bold">Admin</div>
                        <div className="p-4 rounded-2xl bg-foreground text-background text-sm leading-relaxed">
                            ช่วยเช็กกำไรสุทธิเดือนนี้ให้หน่อย
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-6">
                    <div className="p-4 rounded-2xl border bg-background flex items-center gap-3 shadow-sm">
                        <div className="flex-1 text-sm text-muted-foreground">พิมพ์คำถามของคุณที่นี่...</div>
                        <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center">
                            <Send className="h-4 w-4" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AuditView() {
    const logs = [
        { user: 'Admin', action: 'แก้ไขราคาทุนสินค้า', target: 'Smart Watch S7', time: '10 นาทีที่แล้ว' },
        { user: 'พนักงาน A', action: 'สร้างบิลขาย', target: 'INV-2024001', time: '1 ชม. ที่แล้ว' },
        { user: 'Admin', action: 'อนุมัติใบสั่งซื้อ', target: 'PO-2024001', time: '2 ชม. ที่แล้ว' },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">ประวัติการใช้งาน (Audit Log)</h1>
            <div className="space-y-2">
                {logs.map((log, i) => (
                    <div key={i} className="p-4 rounded-xl border bg-background flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <span className="font-bold">{log.user}</span>
                                <span className="mx-2 text-muted-foreground">{log.action}</span>
                                <span className="font-medium text-foreground underline decoration-muted-foreground/30 underline-offset-4">{log.target}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                            <Clock className="h-3 w-3" /> {log.time}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SettingsView() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">ตั้งค่า</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { label: 'ข้อมูลร้านค้า', desc: 'ชื่อร้าน, ที่อยู่, เลขภาษี', icon: FileText },
                    { label: 'พนักงานและการสิทธิ์', desc: 'จัดการผู้ใช้งานในระบบ', icon: User },
                    { label: 'สถานะบิลและลำดับเลข', desc: 'ตั้งค่า prefix ของเลขที่เอกสาร', icon: Receipt },
                    { label: 'การแจ้งเตือน', desc: 'ตั้งค่า LINE Notify และ Email', icon: Bell },
                ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl border bg-background flex items-center gap-4 hover:bg-muted/10 cursor-pointer">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-bold text-sm">{item.label}</div>
                            <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function HelpView() {
    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold tracking-tight">คู่มือการใช้งาน</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                        <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                            Video Tutorial {i}
                        </div>
                        <div className="font-bold text-sm">เริ่มต้นใช้งานตอนที่ {i}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function HealthView() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">สถานะระบบ</h1>
            <div className="p-6 rounded-2xl border bg-background shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                    <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse" />
                    <div className="font-bold">ระบบทำงานปกติ (All Systems Operational)</div>
                </div>
                <div className="space-y-4">
                    {['Database', 'Cloud Storage', 'AI Engine', 'API Gateway'].map((sys) => (
                        <div key={sys} className="flex items-center justify-between text-sm">
                            <div className="text-muted-foreground">{sys}</div>
                            <div className="font-medium text-green-600">99.99%</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
