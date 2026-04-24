'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { registerPurchaseTax } from '@/actions/tax/tax.actions';
import { toast } from 'sonner';
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
            const res = await registerPurchaseTax(purchaseId);
            if (res.success) {
                toast.success(res.message);
                const data = res.data as any;
                if (data?.id) {
                    router.push(`/tax/purchase-tax/${data.id}`);
                }
            } else {
                toast.error(res.message);
            }
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
