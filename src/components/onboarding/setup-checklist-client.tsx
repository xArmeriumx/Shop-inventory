'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SetupChecklistClientProps {
    blockerItems: React.ReactNode;
    transactionItems: React.ReactNode;
    financialItems: React.ReactNode;
    totalIncomplete: number;
}

export function SetupChecklistClient({
    blockerItems,
    transactionItems,
    financialItems,
    totalIncomplete,
}: SetupChecklistClientProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="flex flex-col">
            {/* Blocker Level is always visible */}
            <div className="p-2">
                {blockerItems}
            </div>

            {/* Expandable Section */}
            {(transactionItems || financialItems) && (
                <div className="border-t">
                    {isExpanded && (
                        <div className="p-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {transactionItems}
                            {financialItems}
                        </div>
                    )}

                    <div className="p-2 flex items-center justify-between gap-2 border-t bg-muted/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="h-3 w-3 mr-1" />
                                    ย่อรายการ
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                    ดูอีก {totalIncomplete} รายการที่เหลือ
                                </>
                            )}
                        </Button>

                        <Link
                            href="/settings/onboarding"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline px-2"
                        >
                            <ScrollText className="h-3 w-3" />
                            ไปที่ Onboarding Hub
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
