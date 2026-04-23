'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
    const [isLoading, setIsLoading] = useState(false);

    const handleExport = async () => {
        setIsLoading(true);
        try {
            const res = await action();

            if (!res.success) {
                toast.error(res.message || 'Export failed');
                return;
            }

            if (!res.data) {
                toast.error('No data available for export');
                return;
            }

            // Create blob and trigger download
            const blob = new Blob([res.data as string], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Download started');
        } catch (error: any) {
            toast.error(error.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant={variant}
            className={className}
            onClick={handleExport}
            disabled={isLoading}
        >
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Download className="mr-2 h-4 w-4" />
            )}
            {label}
        </Button>
    );
}
