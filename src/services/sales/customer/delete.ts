import { db } from '@/lib/db';
import { CUSTOMER_TAGS } from '@/config/cache-tags';
import { AuditService } from '@/services/core/system/audit.service';
import { CUSTOMER_AUDIT_POLICIES } from '@/policies/sales/customer.policy';
import { CustomerQuery } from './query';
import { RequestContext, MutationResult, ServiceError } from '@/types/domain';

export const CustomerDelete = {
  async delete(id: string, ctx: RequestContext): Promise<MutationResult<{ message: string; type: 'delete' | 'archive' }>> {
    const existing = await CustomerQuery.getById(id, ctx);
    if (!existing) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    const impact = await CustomerQuery.getDeletionImpact(id, ctx);

    const result = await AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.DELETE(id, existing.name),
      async () => {
        if (impact.canHardDelete) {
          await db.customer.delete({ where: { id } });
          return { message: 'ลบข้อมูลลูกค้าถาวรสำเร็จ', type: 'delete' as const };
        } else {
          await db.customer.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
          return { message: 'ปิดใช้งานลูกค้าสำเร็จ (เนื่องจากมีรายการธุรการค้างอยู่)', type: 'archive' as const };
        }
      }
    );

    return {
      data: result,
      affectedTags: [CUSTOMER_TAGS.LIST, CUSTOMER_TAGS.DETAIL(id)]
    };
  }
};
