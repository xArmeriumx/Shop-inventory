'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpotlightPopoverProps {
    targetId: string;
    title: string;
    content: string;
    step: number;
    totalSteps: number;
    onNext: () => void;
    onClose: () => void;
}

export function SpotlightPopover({
    targetId,
    title,
    content,
    step,
    totalSteps,
    onNext,
    onClose,
}: SpotlightPopoverProps) {
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

    useEffect(() => {
        const updateCoords = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                setCoords({
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        updateCoords();
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords);
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords);
        };
    }, [targetId]);

    if (!coords) return null;

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Overlay Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
                onClick={onClose}
                style={{
                    clipPath: `polygon(
            0% 0%, 0% 100%, 
            ${coords.left}px 100%, 
            ${coords.left}px ${coords.top}px, 
            ${coords.left + coords.width}px ${coords.top}px, 
            ${coords.left + coords.width}px ${coords.top + coords.height}px, 
            ${coords.left}px ${coords.top + coords.height}px, 
            ${coords.left}px 100%, 
            100% 100%, 100% 0%
          )`,
                }}
            />

            {/* Target Highlight Ring */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute rounded-lg border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]"
                style={{
                    top: coords.top - 4,
                    left: coords.left - 4,
                    width: coords.width + 8,
                    height: coords.height + 8,
                }}
            />

            {/* Popover Content */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute z-[101] w-[320px] bg-card border rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
                style={{
                    top: coords.top + coords.height + 16,
                    left: Math.max(16, Math.min(window.innerWidth - 336, coords.left + (coords.width / 2) - 160)),
                }}
            >
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Step {step} of {totalSteps}
                        </span>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg">{title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {content}
                        </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex gap-1">
                            {[...Array(totalSteps)].map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "h-1 rounded-full transition-all",
                                        i + 1 === step ? "w-4 bg-primary" : "w-1 bg-muted"
                                    )}
                                />
                            ))}
                        </div>
                        <Button size="sm" onClick={onNext} className="gap-2">
                            {step === totalSteps ? (
                                <>สำเร็จ <Check className="h-4 w-4" /></>
                            ) : (
                                <>ขั้นตอนถัดไป <ChevronRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
