'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />

            <div className="relative z-10 px-6 text-center max-w-2xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="relative inline-block mb-8">
                        <h1 className="text-[12rem] md:text-[16rem] font-bold leading-none tracking-tighter text-foreground/5 select-none Thai-Space">
                            404
                        </h1>
                        <div className="absolute inset-0 flex items-center justify-center translate-y-4 md:translate-y-8">
                            <span className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
                                ไม่พบหน้าที่คุณต้องการ
                            </span>
                        </div>
                    </div>

                    <p className="text-muted-foreground text-lg md:text-xl mb-12 max-w-md mx-auto leading-relaxed">
                        ขออภัย หน้าที่คุณพยายามเข้าถึงอาจถูกย้าย ลบออก
                        หรือไม่มีอยู่จริงในระบบ Shop Inventory ERP
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                        <Link href="/" passHref>
                            <Button
                                variant="default"
                                size="lg"
                                className="w-full h-14 text-md font-medium group transition-all duration-300 shadow-xl shadow-primary/20 hover:scale-[1.02]"
                            >
                                <Home className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                                กลับหน้าหลัก
                            </Button>
                        </Link>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => window.history.back()}
                            className="w-full h-14 text-md font-medium border-border/50 hover:bg-accent/50 glass transition-all"
                        >
                            <ArrowLeft className="mr-2 h-5 w-5" />
                            กลับไปก่อนหน้า
                        </Button>
                    </div>

                    <div className="mt-16 pt-8 border-t border-border/10">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-muted-foreground/60">
                            <Link href="/dashboard" className="flex items-center hover:text-foreground transition-colors group">
                                <CornerDownRight className="h-4 w-4 mr-2 opacity-40 group-hover:opacity-100" />
                                <span>ไปที่ Dashboard</span>
                            </Link>
                            <Link href="/pos" className="flex items-center hover:text-foreground transition-colors group">
                                <CornerDownRight className="h-4 w-4 mr-2 opacity-40 group-hover:opacity-100" />
                                <span>เปิด POS</span>
                            </Link>
                            <Link href="/help" className="flex items-center hover:text-foreground transition-colors group">
                                <CornerDownRight className="h-4 w-4 mr-2 opacity-40 group-hover:opacity-100" />
                                <span>ศูนย์ช่วยเหลือ</span>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Grid Pattern Background - Matches ERP style */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                    backgroundSize: '32px 32px'
                }}
            />
        </div>
    );
}
