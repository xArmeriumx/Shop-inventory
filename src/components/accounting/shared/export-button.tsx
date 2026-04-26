'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { runActionWithToast } from '@/lib/mutation-utils';
import { ActionResponse } from '@/types/domain';

interface ExportButtonProps {
    filename: string;
    action: () => Promise<ActionResponse>;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    label?: string;
    className?: string;
}

export function ExportButton({
    filename,
    action,
    variant = 'outline',
    label = 'Export CSV',
    className
}: ExportButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleExport = () => {
        startTransition(async () => {
            await runActionWithToast(action(), {
                loadingMessage: 'กำลังเตรียมข้อมูล Export...',
                successMessage: 'เริ่มการดาวน์โหลดข้อมูลเรียบร้อยแล้ว',
                onSuccess: (data) => {
                    if (!data) return;

                    // Create blob and trigger download
                    const blob = new Blob([data as string], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            });
        });
    };

    return (
        <Button
            variant={variant}
            className={className}
            onClick={handleExport}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Download className="mr-2 h-4 w-4" />
            )}
            {label}
        </Button>
    );
}
