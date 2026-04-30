import { db } from '@/lib/db';
import { CUSTOMER_TAGS } from '@/config/cache-tags';
import type { 
  SerializedPartnerAddress, 
  RequestContext, 
  MutationResult 
} from '@/types/domain';

export const CustomerAddress = {
  async getAddresses(customerId: string, ctx: RequestContext): Promise<SerializedPartnerAddress[]> {
    const addresses = await (db as any).partnerAddress.findMany({
      where: { customerId, shopId: ctx.shopId, deletedAt: null },
      include: { contacts: { where: { deletedAt: null } } },
    });
    return addresses as any[];
  },

  async getAddressById(id: string, ctx: RequestContext): Promise<any> {
    return (db as any).partnerAddress.findFirst({
        where: { id, shopId: ctx.shopId, deletedAt: null },
        include: { contacts: { where: { deletedAt: null } } },
      });
  },

  async createAddress(customerId: string, ctx: RequestContext, data: any): Promise<MutationResult<SerializedPartnerAddress>> {
    const { contacts, ...addrData } = data;
    const addr = await (db as any).partnerAddress.create({
      data: {
        ...addrData,
        customerId,
        shopId: ctx.shopId,
        contacts: {
          create: contacts?.map((c: any) => ({
            ...c,
            shopId: ctx.shopId,
          })),
        },
      },
      include: { contacts: true },
    });

    return {
      data: addr as any,
      affectedTags: [CUSTOMER_TAGS.DETAIL(customerId)]
    };
  },

  async updateAddress(id: string, ctx: RequestContext, data: any): Promise<MutationResult<void>> {
    const addr = await (db as any).partnerAddress.findUnique({ where: { id }, select: { customerId: true } });
    
    await (db as any).partnerAddress.update({
      where: { id },
      data,
    });

    return {
      data: undefined,
      affectedTags: addr ? [CUSTOMER_TAGS.DETAIL(addr.customerId)] : []
    };
  },

  async deleteAddress(id: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const addr = await (db as any).partnerAddress.findUnique({ where: { id }, select: { customerId: true } });
    
    await (db as any).partnerAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return {
      data: undefined,
      affectedTags: addr ? [CUSTOMER_TAGS.DETAIL(addr.customerId)] : []
    };
  }
};
