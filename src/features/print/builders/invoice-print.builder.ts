import { bahtText } from '@/lib/formatters';

export interface InvoicePrintSnapshotDTO {
    docNumber: string;
    docDate: string;

    // Seller Info (from Shop)
    seller: {
        name: string;
        address: string;
        phone: string;
        taxId: string;
    };

    // Buyer Info (from Snapshots)
    buyer: {
        name: string;
        address: string;
        taxId: string | null;
        customerCode?: string;
    };

    // Line Items (from Snapshots)
    items: Array<{
        sku: string;
        name: string;
        quantity: number;
        uom: string;
        unitPrice: number;
        discountAmount: number;
        subtotal: number;
        netAmount: number;
    }>;

    // Financial Matrix
    financials: {
        subtotal: number;
        discount: number;
        tax: number;
        net: number;
        netText: string; // "บาทถ้วน"
    };

    notes?: string;
}

/**
 * Maps Invoice (Prisma model with snapshots) to InvoicePrintSnapshotDTO
 */
export function buildInvoicePrintDTO(invoice: any, shop: any): InvoicePrintSnapshotDTO {
    const financials = {
        subtotal: Number(invoice.subtotalAmount || 0),
        discount: Number(invoice.discountAmount || 0),
        tax: Number(invoice.taxAmount || 0),
        net: Number(invoice.netAmount || 0),
        netText: bahtText(Number(invoice.netAmount || 0)),
    };

    return {
        docNumber: invoice.invoiceNo,
        docDate: invoice.createdAt instanceof Date ? invoice.createdAt.toISOString() : invoice.createdAt,

        seller: {
            name: shop?.name || 'ร้านค้า',
            address: shop?.address || '-',
            phone: shop?.phone || '-',
            taxId: shop?.taxId || '-',
        },

        buyer: {
            name: invoice.customerNameSnapshot || 'ลูกค้าทั่วไป',
            address: invoice.billingAddressSnapshot || '-',
            taxId: invoice.taxIdSnapshot,
        },

        items: (invoice.items || []).map((item: any) => ({
            sku: item.skuSnapshot || '-',
            name: item.productNameSnapshot || 'ไม่ระบุสินค้า',
            quantity: Number(item.quantity || 0),
            uom: item.uomSnapshot || 'Unit',
            unitPrice: Number(item.unitPrice || 0),
            discountAmount: Number(item.discountAmount || 0),
            subtotal: Number(item.lineSubtotalAmount || 0),
            netAmount: Number(item.lineNetAmount || 0),
        })),

        financials,
        notes: invoice.notes || (invoice.sale?.notes) || '',
    };
}
