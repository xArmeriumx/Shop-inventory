import { db } from '@/lib/db';
import {
    QuotationStatus,
    ServiceError,
    type RequestContext,
    type MutationResult
} from '@/types/domain';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { QUOTATION_TAGS } from '@/config/cache-tags';
import { QUOTATION_AUDIT_FIELDS } from './create';

export const QuotationCancel = {
    async cancel(ctx: RequestContext, id: string): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.QUOTATION_CANCEL,
            targetType: 'Quotation',
            targetId: id,
            allowlist: QUOTATION_AUDIT_FIELDS,
            note: 'ยกเลิกใบเสนอราคา',
            getBefore: async () => db.quotation.findUnique({ where: { id } }),
            getAfter: async () => db.quotation.findUnique({ where: { id } })
        }, async () => {
            return await db.$transaction(async (tx) => {
                const quotation = await tx.quotation.findUnique({
                    where: { id },
                });

                if (!quotation || quotation.shopId !== ctx.shopId) {
                    throw new ServiceError('ไม่พบใบเสนอราคา');
                }

                return await tx.quotation.update({
                    where: { id },
                    data: { status: QuotationStatus.CANCELLED },
                });
            });
        });

        return {
            data: result,
            affectedTags: [QUOTATION_TAGS.LIST, QUOTATION_TAGS.DETAIL(id)]
        };
    }
};
