import { db } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { PRODUCT_AUDIT_POLICIES } from '@/policies/inventory/product.policy';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { RequestContext, ServiceError, MutationResult } from '@/types/domain';

export const ProductDeleteUseCase = {
  async delete(id: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const existing = await db.product.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!existing) throw new ServiceError('ไม่พบสินค้า');

    return AuditService.runWithAudit(
      ctx,
      {
        ...PRODUCT_AUDIT_POLICIES.DELETE(id, existing.name),
        beforeSnapshot: () => existing,
      },
      async () => {
        await db.product.update({
          where: { id },
          data: { isActive: false, deletedAt: new Date() },
        });

        return {
          data: undefined,
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.SELECT, INVENTORY_TAGS.DETAIL(id)]
        };
      }
    );
  }
};
