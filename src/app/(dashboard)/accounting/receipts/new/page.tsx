import React from 'react';
import { CustomerService } from '@/services/sales/customer.service';
import { requireShop } from '@/lib/auth-guard';
import { ReceiptVoucherForm } from '@/components/accounting/vouchers/receipt-voucher-form';
import { BackPageHeader } from '@/components/ui/back-page-header';

export default async function NewReceiptVoucherPage() {
    const ctx = await requireShop();
    const customers = await CustomerService.getForSelect(ctx);

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            <BackPageHeader
                title="บันทึกใบสำคัญรับเงิน"
                backHref="/accounting/receipts"
            />
            <ReceiptVoucherForm customers={customers} />
        </div>
    );
}
