import * as z from 'zod';

/**
 * Standard Payment Form Schema
 * Used for both Invoices and Sales
 */
export const paymentSchema = z.object({
    amount: z.coerce.number().positive('ยอดชำระต้องมากกว่า 0'),
    paymentMethodCode: z.string().min(1, 'กรุณาเลือกวิธีการชำระเงิน'),
    paymentDate: z.string().optional(),
    referenceId: z.string().optional(),
    note: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

/**
 * Centralized Default Values
 */
export function getDefaultPaymentValues(residualAmount: number): PaymentFormValues {
    return {
        amount: residualAmount > 0 ? residualAmount : 0,
        paymentMethodCode: 'TRANSFER', // Default to Transfer
        paymentDate: new Date().toISOString().split('T')[0],
        referenceId: '',
        note: '',
    };
}
