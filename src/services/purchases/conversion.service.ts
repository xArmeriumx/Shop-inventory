import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { 
  RequestContext, 
  ServiceError, 
  OrderRequestStatus,
  PurchaseStatus,
  DocumentType,
  MutationResult
} from '@/types/domain';
import { SequenceService } from '@/services/core/system/sequence.service';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { ORDER_REQUEST_TAGS, PURCHASE_TAGS } from '@/config/cache-tags';
import { money, calcSubtotal } from '@/lib/money';

/**
 * OrderRequestConversionService — ระบบแปลงเอกสารภายในเป็นเอกสารจัดซื้อภายนอก
 * 
 * มุ่งเน้นการรักษา Data Integrity และ Audit Trail ตามมาตรฐาน ERP
 */
export const OrderRequestConversionService = {
  /**
   * แปลง Order Request เป็น Purchase Order
   * 
   * @param ctx - User Context
   * @param orderRequestId - ID ของคำขอซื้อ
   * @param supplierId - ID ของผู้จำหน่ายที่จะออก PO ให้
   */
  async convertToPO(
    ctx: RequestContext, 
    orderRequestId: string, 
    supplierId: string
  ): Promise<MutationResult<{ id: string; poNumber: string }>> {
    // 1. ตรวจสอบสิทธิ์
    Security.requirePermission(ctx, 'PURCHASE_CREATE');

    // 2. ดึงข้อมูลคำขอซื้อและตรวจสอบสถานะ
    const orderRequest = await db.orderRequest.findFirst({
      where: { id: orderRequestId, shopId: ctx.shopId },
      include: { items: { include: { product: true } } }
    });

    if (!orderRequest) throw new ServiceError('ไม่พบข้อมูลคำขอซื้อ');
    if (orderRequest.status !== OrderRequestStatus.APPROVED) {
      throw new ServiceError('คำขอซื้อต้องได้รับการอนุมัติก่อนจึงจะสร้างใบสั่งซื้อได้');
    }

    if (orderRequest.items.length === 0) {
      throw new ServiceError('คำขอซื้อไม่มีรายการสินค้า');
    }

    // 3. เริ่มกระบวนการแปลงภายใน Transaction
    const result = await AuditService.runWithAudit(
      ctx,
      {
        action: 'PURCHASE_CONVERT_FROM_OR',
        targetType: 'Purchase',
        note: `แปลงจากคำขอซื้อ ${orderRequest.requestNo} ไปยังผู้จำหน่าย ID: ${supplierId}`,
      },
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          // A. รันเลขที่ PO ใหม่
          const poNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_ORDER, prisma);

          // B. คำนวณราคารวม (ใช้ราคาต้นทุนปัจจุบันจาก Product ถ้ามี หรือใช้ 0)
          const totalCost = orderRequest.items.reduce((sum, item) => {
            const cost = Number(item.product?.costPrice || 0);
            return money.add(sum, calcSubtotal(item.quantity, cost));
          }, 0);

          // C. สร้างใบสั่งซื้อ (Purchase ORDER)
          const po = await prisma.purchase.create({
            data: {
              purchaseNumber: poNumber,
              purchaseType: 'LOCAL', // ค่าเริ่มต้นเป็น Local
              docType: 'ORDER',
              status: PurchaseStatus.ORDERED,
              totalCost: totalCost,
              notes: `อ้างอิงใบขอซื้อ: ${orderRequest.requestNo}\n${orderRequest.notes || ''}`,
              supplierId: supplierId,
              userId: ctx.userId,
              shopId: ctx.shopId,
              requestNumber: orderRequest.requestNo,
              // linkedORId: orderRequestId, // หมายเหตุ: ถ้าใน Schema ไม่มี field นี้ ให้ใช้ notes หรือ field อื่นแทน
              items: {
                create: orderRequest.items.map(item => ({
                  productId: item.productId!,
                  quantity: item.quantity,
                  packagingQty: (item.product as any)?.packagingQty || 1,
                  costPrice: Number(item.product?.costPrice || 0),
                  subtotal: calcSubtotal(item.quantity, Number(item.product?.costPrice || 0)),
                })),
              },
            },
          });

          // D. อัปเดตสถานะคำขอซื้อต้นทางเป็น DONE
          await prisma.orderRequest.update({
            where: { id: orderRequestId },
            data: { status: OrderRequestStatus.DONE },
          });

          return { id: po.id, poNumber: po.purchaseNumber! };
        });
      }
    );

    return {
      data: result,
      affectedTags: [
        ORDER_REQUEST_TAGS.LIST,
        ORDER_REQUEST_TAGS.DETAIL(orderRequestId),
        PURCHASE_TAGS.LIST,
        PURCHASE_TAGS.ORDERS
      ]
    };
  }
};
