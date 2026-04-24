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

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

/**
 * ดึงรายการลูกค้าที่มีปัญหาเรื่องพิกัด (Logistics Gaps)
 */
export async function getLogisticsGaps() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SHIPMENT_VIEW');
      return ShipmentService.getLogisticsGaps(ctx);
    }, 'ops:getLogisticsGaps');
  }, { context: { action: 'getLogisticsGaps' } });
}

/**
 * ดึงรายการใบขอซื้อ (PR) ที่ไม่มีผู้ขาย
 */
export async function getIncompleteRequests(page = 1) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return PurchaseService.getIncompleteRequests({ page, limit: 20 }, ctx);
    }, 'ops:getIncompleteRequests');
  }, { context: { action: 'getIncompleteRequests', page } });
}

/**
 * มอบหมายผู้ขายให้กับ PR แบบด่วน (Bulk)
 */
export async function quickAssignSupplier(ids: string[], supplierId: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      await PurchaseService.quickAssignSupplier(ids, supplierId, ctx);
      revalidatePath('/system/ops');
      return null;
    }, 'inventory:quickAssignSupplier');
  }, { context: { action: 'inventory:quickAssignSupplier' } });
}

/**
 * ดึงรายการเอกสารค้าง (Stale Documents)
 */
export async function getStaleDocuments() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_VIEW');
      return DashboardService.getStaleDocuments(ctx);
    }, 'ops:getStaleDocuments');
  }, { context: { action: 'getStaleDocuments' } });
}
