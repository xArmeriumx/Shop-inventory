import { z } from 'zod';

/**
 * Receipt Allocation Schema
 */
export const receiptAllocationSchema = z.object({
    invoiceId: z.string().min(1, 'ต้องระบุใบแจ้งหนี้'),
    amount: z.coerce.number().positive('ต้องระบุยอดเงินที่ต้องการตัดชำระ'),
});

/**
 * Payment Allocation Schema
 */
export const paymentAllocationSchema = z.object({
    purchaseId: z.string().min(1, 'ต้องระบุใบสั่งซื้อ'),
    amount: z.coerce.number().positive('ต้องระบุยอดเงินที่ต้องการตัดจ่าย'),
});

/**
 * Receipt Voucher Schema (Customer Collections)
 */
export const receiptVoucherSchema = z.object({
    customerId: z.string().min(1, 'กรุณาเลือกลูกค้า'),
    paymentDate: z.date({ required_error: 'กรุณาระบุวันที่รับชำระ' }),
    paymentMethodCode: z.string().min(1, 'กรุณาเลือกช่องทางการรับเงิน'),
    referenceId: z.string().optional(),
    note: z.string().optional(),
    totalAmount: z.coerce.number().positive('ยอดรับชำระต้องมากกว่า 0'),
    allocations: z.array(receiptAllocationSchema).min(1, 'ต้องมียอดตัดชำระอย่างน้อย 1 รายการ'),
});

/**
 * Payment Voucher Schema (Supplier Payments)
 */
export const paymentVoucherSchema = z.object({
    supplierId: z.string().min(1, 'กรุณาเลือกผู้จำหน่าย'),
    paymentDate: z.date({ required_error: 'กรุณาระบุวันที่จ่ายเงิน' }),
    paymentMethodCode: z.string().min(1, 'กรุณาเลือกช่องทางการจ่ายเงิน'),
    referenceId: z.string().optional(),
    note: z.string().optional(),
    totalAmount: z.coerce.number().positive('ยอดจ่ายเงินต้องมากกว่า 0'),
    allocations: z.array(paymentAllocationSchema).min(1, 'ต้องมียอดตัดจ่ายอย่างน้อย 1 รายการ'),
});

export type ReceiptVoucherInput = z.infer<typeof receiptVoucherSchema>;
export type PaymentVoucherInput = z.infer<typeof paymentVoucherSchema>;

export const getReceiptVoucherDefaultValues = (data?: Partial<ReceiptVoucherInput>): ReceiptVoucherInput => ({
    customerId: '',
    paymentDate: new Date(),
    paymentMethodCode: 'TRANSFER',
    totalAmount: 0,
    allocations: [],
    ...data,
});

export const getPaymentVoucherDefaultValues = (data?: Partial<PaymentVoucherInput>): PaymentVoucherInput => ({
    supplierId: '',
    paymentDate: new Date(),
    paymentMethodCode: 'TRANSFER',
    totalAmount: 0,
    allocations: [],
    ...data,
});
