'use server';

import { handleAction } from '@/lib/action-handler';
import { requirePermission } from '@/lib/auth-guard';
import { OrderRequestConversionService } from '@/services/purchases/conversion.service';
import { revalidateTag } from 'next/cache';

/**
 * Action: แปลง Order Request เป็น Purchase Order
 * 
 * ใช้ handleAction เพื่อมาตรฐานการส่งกลับข้อมูลและความปลอดภัย
 */
export async function convertToPOAction(orderRequestId: string, supplierId: string) {
  return handleAction(async () => {
    const ctx = await requirePermission('PURCHASE_CREATE');
    const result = await OrderRequestConversionService.convertToPO(ctx, orderRequestId, supplierId);
    
    // ล้าง Cache ที่เกี่ยวข้อง
    result.affectedTags?.forEach(tag => revalidateTag(tag));
    
    return result.data;
  }, {
    context: { 
      action: 'ORDER_REQUEST_CONVERT',
      orderRequestId,
      supplierId
    }
  });
}
