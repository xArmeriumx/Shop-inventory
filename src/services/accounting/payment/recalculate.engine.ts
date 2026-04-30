import { db } from '@/lib/db';
import { toNumber, money } from '@/lib/money';

export const PaymentRecalculateEngine = {
    async recalculateDocumentBalance(
        target: { documentType: string; documentId: string },
        tx: any = db
    ) {
        const { documentType, documentId } = target;

        const allocations = await (tx as any).paymentAllocation.findMany({
            where: {
                documentType,
                documentId,
                payment: { status: 'POSTED' },
            },
        });

        const totalPaid = allocations.reduce(
            (sum: number, a: any) => money.add(sum, toNumber(a.amount)),
            0
        );

        const modelMap: Record<string, any> = {
            INVOICE:  (tx as any).invoice,
            SALE:     (tx as any).sale,
            PURCHASE: (tx as any).purchase,
            EXPENSE:  (tx as any).expense,
        };
        const updateModel = modelMap[documentType];
        if (!updateModel) throw new Error(`Unknown documentType: ${documentType}`);

        const parent = await updateModel.findUnique({ where: { id: documentId } });
        if (!parent) return; 

        const totalAmount = toNumber(parent.netAmount ?? parent.totalAmount);
        const residualAmount = Math.max(0, totalAmount - totalPaid);

        let status: any = 'UNPAID';
        if (totalPaid >= totalAmount)  status = 'PAID';
        else if (totalPaid > 0)        status = 'PARTIAL';

        await updateModel.update({
            where: { id: documentId },
            data: {
                paidAmount:     totalPaid,
                residualAmount,
                paymentStatus:  status,
                ...(documentType === 'SALE' && {
                    billingStatus: status === 'PAID' ? 'PAID' : status === 'PARTIAL' ? 'BILLED' : 'UNBILLED',
                }),
            },
        });
    }
};
