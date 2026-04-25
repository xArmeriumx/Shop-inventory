import * as z from 'zod';

/**
 * Purchase Tax Form Schema — SSOT (Single Source of Truth)
 * ตามมาตรฐาน ERP Rule 1.1: กำหนดกฎการ Validate และค่าเริ่มต้นที่เดียว
 */
export const purchaseTaxFormSchema = z.object({
  // ข้อมูลใบกำกับภาษี (จาก Vendor)
  vendorDocNo: z.string().min(1, 'ต้องระบุเลขที่ใบกำกับภาษี'),
  vendorDocDate: z.string().min(1, 'ต้องระบุวันที่ในใบกำกับภาษี'),
  
  // สถานะการขอคืน (Claim)
  claimStatus: z.enum(['CLAIMABLE', 'WAITING_DOC', 'NON_CLAIMABLE'], {
    required_error: 'ต้องระบุสิทธิการขอคืนภาษี',
  }),
  claimReason: z.string().optional(),

  // บันทึกเพิ่มเติม
  notes: z.string().optional(),
});

export type PurchaseTaxFormValues = z.infer<typeof purchaseTaxFormSchema>;

/**
 * Default Values Generator
 * เพื่อให้แน่ใจว่าหน้า Form จะมีค่าเริ่มต้นที่ถูกต้องเสมอ
 */
export function getPurchaseTaxDefaultValues(data?: any): PurchaseTaxFormValues {
  return {
    vendorDocNo: data?.vendorDocNo || '',
    vendorDocDate: data?.vendorDocDate 
      ? new Date(data.vendorDocDate).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0],
    claimStatus: data?.claimStatus || 'CLAIMABLE',
    claimReason: data?.claimReason || '',
    notes: data?.notes || '',
  };
}
