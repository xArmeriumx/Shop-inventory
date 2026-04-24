import React from 'react';
import { SupplierService } from '@/services/purchases/supplier.service';
import { requireShop } from '@/lib/auth-guard';
import { PaymentVoucherForm } from '@/components/accounting/vouchers/payment-voucher-form';
import { BackPageHeader } from '@/components/ui/back-page-header';

export default async function NewPaymentVoucherPage() {
    const ctx = await requireShop();
    const suppliers = await SupplierService.getForSelect(ctx);

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            <BackPageHeader
                title="บันทึกใบสำคัญจ่ายเงิน"
                backHref="/accounting/payments"
            />
            <PaymentVoucherForm suppliers={suppliers} />
        </div>
    );
}
