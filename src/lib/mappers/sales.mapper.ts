import { toNumber } from '@/lib/money';
import { RequestContext } from '@/types/common';
import { Permission } from '@prisma/client';
import { SaleListDTO, SaleDetailDTO, SaleItemDTO } from '@/types/dtos/sales.dto';

/**
 * SaleMapper - Central logic for Sale DTO shaping & security
 */
export const SaleMapper = {
    /**
     * Map Sale to List DTO (Lightweight)
     */
    toListDTO(sale: any, ctx?: RequestContext): SaleListDTO {
        const dto: SaleListDTO = {
            id: sale.id,
            invoiceNumber: sale.invoiceNumber,
            date: sale.date,
            customerName: sale.customer?.name || sale.customerName || 'N/A',
            customerAddress: sale.customer?.address || sale.customerAddress || undefined,
            customerPhone: sale.customer?.phone || sale.customerPhone || undefined,
            customerTaxId: sale.customer?.taxId || sale.customerTaxId || undefined,
            status: sale.status,
            paymentStatus: sale.paymentStatus,
            paymentMethod: sale.paymentMethod,
            netAmount: toNumber(sale.netAmount),
        };

        if (ctx && (ctx.permissions.includes(Permission.SALE_VIEW_PROFIT) || ctx.isOwner)) {
            dto.profit = toNumber(sale.profit);
        }

        return dto;
    },

    /**
     * Map Sale to Detail DTO (Full Data + Security)
     */
    toDetailDTO(sale: any, ctx: RequestContext): SaleDetailDTO {
        const canViewProfit = ctx.permissions.includes(Permission.SALE_VIEW_PROFIT) || ctx.isOwner;

        const detail: SaleDetailDTO = {
            ...this.toListDTO(sale, ctx),
            notes: sale.notes || undefined,
            paymentMethod: sale.paymentMethod,
            channel: sale.channel,
            discountAmount: toNumber(sale.discountAmount),
            taxAmount: toNumber(sale.taxAmount),
            taxableAmount: toNumber(sale.taxableAmount),
            totalAmount: toNumber(sale.totalAmount),
            paidAmount: toNumber(sale.paidAmount),
            residualAmount: toNumber(sale.residualAmount),
            items: (sale.items || []).map((item: any) => this.toItemDTO(item, canViewProfit)),
        };

        if (canViewProfit) {
            detail.totalCost = toNumber(sale.totalCost);
            detail.profit = toNumber(sale.profit);
        }

        return detail;
    },

    /**
     * Map Sale Item to DTO
     */
    toItemDTO(item: any, canViewProfit: boolean): SaleItemDTO {
        const dto: SaleItemDTO = {
            id: item.id,
            productId: item.productId,
            productName: item.product?.name || item.productName || 'Unknown Product',
            quantity: toNumber(item.quantity),
            unitPrice: toNumber(item.salePrice),
            discountAmount: toNumber(item.discountAmount),
            subtotal: toNumber(item.subtotal),
        };

        if (canViewProfit) {
            dto.costPrice = toNumber(item.costPrice);
            dto.profit = toNumber(item.profit);
        }

        return dto;
    }
};
