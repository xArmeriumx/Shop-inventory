export * from './tax-code.schema';
export * from './company-tax-profile.schema';

// Keep purchase tax post schema as it is specific to document posting, not settings
import { z } from 'zod';
export const purchaseTaxPostSchema = z.object({
    vendorDocNo: z.string().min(1, 'กรุณาระบุเลขที่ใบกำกับภาษี'),
    vendorDocDate: z.coerce.date({
        errorMap: () => ({ message: 'กรุณาระบุวันที่ใบกำกับภาษีที่ถูกต้อง' }),
    }),
    claimStatus: z.enum(['CLAIMABLE', 'NON_CLAIMABLE', 'DEFERRED'], {
        errorMap: () => ({ message: 'กรุณาเลือกสถานะการเคลมภาษี' }),
    }),
});
