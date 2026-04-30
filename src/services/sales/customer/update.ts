import { db } from '@/lib/db';
import { CUSTOMER_TAGS } from '@/config/cache-tags';
import { AuditService } from '@/services/core/system/audit.service';
import { CUSTOMER_AUDIT_POLICIES } from '@/policies/sales/customer.policy';
import { CustomerInput } from '@/schemas/sales/customer.schema';
import { CustomerQuery } from './query';
import { SerializedCustomer, RequestContext, MutationResult, ServiceError } from '@/types/domain';

export const CustomerUpdate = {
  async update(id: string, ctx: RequestContext, data: CustomerInput): Promise<MutationResult<SerializedCustomer>> {
    const existing = await CustomerQuery.getById(id, ctx);
    if (!existing) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    const result = await AuditService.runWithAudit(
      ctx,
      {
        ...CUSTOMER_AUDIT_POLICIES.UPDATE(id, existing.name),
        beforeSnapshot: () => existing,
        afterSnapshot: () => CustomerQuery.getById(id, ctx),
      },
      async () => {
        const { partnerAddresses, ...customerData } = data as any;

        const customer = await db.$transaction(async (tx) => {
          const c = await tx.customer.update({
            where: { id },
            data: customerData,
          });

          if (partnerAddresses) {
            const existingAddressIds = (existing as any).partnerAddresses.map((a: any) => a.id);
            const incomingAddressIds = partnerAddresses.filter((a: any) => a.id).map((a: any) => a.id as string);

            const removedAddressIds = existingAddressIds.filter((id: string) => !incomingAddressIds.includes(id));
            if (removedAddressIds.length > 0) {
              await (tx as any).partnerAddress.updateMany({
                where: { id: { in: removedAddressIds } },
                data: { deletedAt: new Date() },
              });
            }

            for (const addr of partnerAddresses) {
              const { id: addrId, contacts, ...addrData } = addr;
              if (addrId && existingAddressIds.includes(addrId)) {
                await (tx as any).partnerAddress.update({
                  where: { id: addrId },
                  data: addrData,
                });

                const existingAddr = (existing as any).partnerAddresses.find((a: any) => a.id === addrId);
                const existingContactIds = existingAddr?.contacts.map((c: any) => c.id) || [];
                const incomingContactIds = contacts?.filter((c: any) => c.id).map((c: any) => c.id as string) || [];

                const removedContactIds = existingContactIds.filter((id: string) => !incomingContactIds.includes(id));
                if (removedContactIds.length > 0) {
                  await (tx as any).partnerContact.updateMany({
                    where: { id: { in: removedContactIds } },
                    data: { deletedAt: new Date() },
                  });
                }

                if (contacts) {
                  for (const contact of contacts) {
                    const { id: contactId, ...contactData } = contact;
                    if (contactId && existingContactIds.includes(contactId)) {
                      await (tx as any).partnerContact.update({
                        where: { id: contactId },
                        data: contactData,
                      });
                    } else {
                      await (tx as any).partnerContact.create({
                        data: {
                          ...contactData,
                          partnerAddressId: addrId,
                          shopId: ctx.shopId,
                        },
                      });
                    }
                  }
                }
              } else {
                await (tx as any).partnerAddress.create({
                  data: {
                    ...addrData,
                    customerId: id,
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
          }
          return c;
        });

        return customer as any;
      }
    );

    return {
      data: result,
      affectedTags: [CUSTOMER_TAGS.LIST, CUSTOMER_TAGS.DETAIL(id)]
    };
  }
};
