import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { CUSTOMER_TAGS } from '@/config/cache-tags';
import { AuditService } from '@/services/core/system/audit.service';
import { CUSTOMER_AUDIT_POLICIES } from '@/policies/sales/customer.policy';
import { CustomerInput } from '@/schemas/sales/customer.schema';
import type { 
  SerializedCustomer, 
  RequestContext, 
  MutationResult 
} from '@/types/domain';

export const CustomerCreate = {
  async create(ctx: RequestContext, data: CustomerInput): Promise<MutationResult<SerializedCustomer>> {
    const result = await AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.CREATE(data.name),
      async () => {
        const { partnerAddresses, ...customerData } = data as any;

        const customer = await db.$transaction(async (tx) => {
          const c = await (tx as any).customer.create({
            data: {
              ...customerData,
              userId: ctx.userId,
              shopId: ctx.shopId,
            } as Prisma.CustomerUncheckedCreateInput,
          });

          if (partnerAddresses && partnerAddresses.length > 0) {
            for (const addr of partnerAddresses) {
              const { contacts, ...addrData } = addr;
              await (tx as any).partnerAddress.create({
                data: {
                  ...addrData,
                  customerId: c.id,
                  shopId: ctx.shopId,
                  contacts: {
                    create: contacts?.map((con: any) => ({
                      ...con,
                      shopId: ctx.shopId,
                    })),
                  },
                },
              });
            }
          }

          return c;
        });

        return customer as any;
      }
    );

    return {
      data: result,
      affectedTags: [CUSTOMER_TAGS.LIST]
    };
  }
};
