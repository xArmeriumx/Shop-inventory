'use client';
/**
 * DismissSetupItemButton — Client Component
 * Renders a small "×" button to dismiss a setup checklist item.
 * Kept as a separate Client Component to preserve RSC purity of SetupProgressCard.
 */
import { useTransition } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { dismissSetupItem } from '@/actions/core/onboarding.actions';
import type { SetupItemKey } from '@/types/onboarding.types';
import { cn } from '@/lib/utils';

interface Props {
    itemKey: SetupItemKey;
}

export function DismissSetupItemButton({ itemKey }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleDismiss = () => {
        startTransition(async () => {
            const result = await dismissSetupItem(itemKey);
            if (result.success) {
                router.refresh(); // Refresh to re-derive progress from server
            } else {
                toast.error(result.message ?? 'ไม่สามารถซ่อนรายการนี้ได้');
            }
        });
    };

    return (
        <button
            onClick={handleDismiss}
            disabled={isPending}
            title="ซ่อนรายการนี้"
            className={cn(
                'text-muted-foreground/40 hover:text-muted-foreground rounded p-0.5 transition-colors',
                isPending && 'opacity-50 cursor-not-allowed',
            )}
        >
            <X className="h-3 w-3" />
        </button>
    );
}
