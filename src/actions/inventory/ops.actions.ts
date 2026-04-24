'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { 
  PurchaseService, 
  ShipmentService, 
  DashboardService,
  ServiceError 
} from '@/services';
import { ActionResponse } from '@/types/domain';

/**
 * ดึงรายการลูกค้าที่มีปัญหาเรื่องพิกัด (Logistics Gaps)
 */
export async function getLogisticsGaps() {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getLogisticsGaps(ctx);
}

/**
 * ดึงรายการใบขอซื้อ (PR) ที่ไม่มีผู้ขาย
 */
export async function getIncompleteRequests(page = 1) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  return PurchaseService.getIncompleteRequests({ page, limit: 20 }, ctx);
}

/**
 * มอบหมายผู้ขายให้กับ PR แบบด่วน (Bulk)
 */
export async function quickAssignSupplier(ids: string[], supplierId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('PURCHASE_CREATE');
  try {
    await PurchaseService.quickAssignSupplier(ids, supplierId, ctx);
    revalidatePath('/system/ops');
    return { success: true, message: `มอบหมายผู้ขายสำเร็จ (${ids.length} รายการ)` };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    return { success: false, message: 'เกิดข้อผิดพลาดในการมอบหมายผู้ขาย' };
  }
}

/**
 * ดึงรายการเอกสารค้าง (Stale Documents)
 */
export async function getStaleDocuments() {
  const ctx = await requirePermission('SALE_VIEW'); // ต้องการสิทธิ์ดูกระบวนการทำงาน
  return DashboardService.getStaleDocuments(ctx);
}
