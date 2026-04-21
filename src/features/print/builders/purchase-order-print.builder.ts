import { bahtText } from '@/lib/formatters';

export interface PurchasePrintDTO {
    docNumber: string;
    docDate: string;

    // Requester/Shop Info
    requester: {
        name: string;
        address: string;
        phone: string;
        taxId: string;
    };

    // Supplier Info
    supplier: {
        name: string;
        address: string;
        phone: string;
        taxId: string | null;
        contactPerson?: string;
    };

    // Line Items
    items: Array<{
        sku: string;
        name: string;
        quantity: number;
        uom: string;
        unitPrice: number;
        subtotal: number;
    }>;

    // Financial Matrix
    financials: {
        subtotal: number;
        discount: number;
        tax: number;
        net: number;
        netText: string;
    };

    notes?: string;
}

/**
 * Maps Purchase (Prisma model) to PurchasePrintDTO
 */
export function buildPurchasePrintDTO(purchase: any, shop: any): PurchasePrintDTO {
    const financials = {
        subtotal: Number(purchase.totalAmount || 0),
        discount: Number(purchase.discountAmount || 0),
        tax: Number(purchase.taxAmount || 0),
        net: Number(purchase.netAmount || 0),
        netText: bahtText(Number(purchase.netAmount || 0)),
    };

    return {
        docNumber: purchase.invoiceNumber, // Purchase uses invoiceNumber for the ref
        docDate: purchase.date instanceof Date ? purchase.date.toISOString() : purchase.date,

        requester: {
            name: shop?.name || 'ร้านค้า',
            address: shop?.address || '-',
            phone: shop?.phone || '-',
            taxId: shop?.taxId || '-',
        },

        supplier: {
            name: purchase.supplier?.name || 'ไม่ระบุผู้จำหน่าย',
            address: purchase.supplier?.address || '-',
            phone: purchase.supplier?.phone || '-',
            taxId: purchase.supplier?.taxId || '-',
        },

        items: (purchase.items || []).map((item: any) => ({
            sku: item.product?.sku || '-',
            name: item.product?.name || 'ไม่ระบุสินค้า',
            quantity: Number(item.quantity || 0),
            uom: 'Unit', // Legacy Purchase might not have UOM snapshot yet
            unitPrice: Number(item.unitPrice || 0),
            subtotal: Number(item.subtotal || 0),
        })),

        financials,
        notes: purchase.notes || '',
    };
}
