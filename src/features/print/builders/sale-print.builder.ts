import { bahtText } from '@/lib/formatters';
import { InvoicePrintSnapshotDTO } from './invoice-print.builder';

/**
 * Maps Sale (from Prisma) to InvoicePrintSnapshotDTO
 * This allows a Sale to be printed using the standard Invoice template
 */
export function buildSalePrintDTO(sale: any, shop: any): InvoicePrintSnapshotDTO {
    const financials = {
        subtotal: Number(sale.totalAmount || 0),
        discount: Number(sale.discountAmount || 0),
        tax: Number(sale.taxAmount || 0),
        net: Number(sale.netAmount || 0),
        netText: bahtText(Number(sale.netAmount || 0)),
    };

    return {
        docNumber: sale.invoiceNumber || sale.id.slice(0, 8).toUpperCase(),
        docDate: sale.date instanceof Date ? sale.date.toISOString() : sale.date,

        seller: {
            name: shop?.name || 'ร้านค้า',
            address: shop?.address || '-',
            phone: shop?.phone || '-',
            taxId: shop?.taxId || '-',
        },

        buyer: {
            name: sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป',
            address: sale.customer?.address || '-',
            taxId: sale.customer?.taxId || null,
        },

        items: (sale.items || []).map((item: any) => ({
            sku: item.product?.sku || '-',
            name: item.product?.name || 'ไม่ระบุสินค้า',
            quantity: Number(item.quantity || 0),
            uom: item.product?.uom || 'Unit',
            unitPrice: Number(item.salePrice || 0),
            discountAmount: Number(item.discountAmount || 0),
            subtotal: Number(item.subtotal || 0),
            netAmount: Number(item.subtotal || 0), // Sales items usually have subtotal as net per line
        })),

        financials,
        notes: sale.notes || '',
    };
}
