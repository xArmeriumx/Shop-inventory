'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { registerPurchaseTax } from '@/actions/tax/tax.actions';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';
import { FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RegisterPurchaseTaxButtonProps {
    purchaseId: string;
    hasTaxDoc?: boolean;
}

export function RegisterPurchaseTaxButton({ purchaseId, hasTaxDoc }: RegisterPurchaseTaxButtonProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleRegister = () => {
        startTransition(async () => {
            await runActionWithToast(registerPurchaseTax(purchaseId), {
                successMessage: 'จดทะเบียนภาษีซื้อสำเร็จ',
                onSuccess: (res) => {
                    const data = res as any;
                    if (data?.id) {
                        setTimeout(() => {
                            router.push(`/tax/purchase-tax/${data.id}`);
                            router.refresh();
                        }, 100);
                    }
                }
            });
        });
    };

    if (hasTaxDoc) {
        return (
            <Button variant="outline" size="sm" className="gap-2" disabled>
                <FileText className="h-4 w-4 text-green-500" />
                จดทะเบียนภาษีแล้ว
            </Button>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRegister}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <FileText className="h-4 w-4" />
            )}
            จดทะเบียนภาษีซื้อ
        </Button>
    );
}
