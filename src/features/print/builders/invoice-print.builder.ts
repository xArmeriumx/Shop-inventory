import { bahtText } from '@/lib/formatters';

export interface InvoicePrintSnapshotDTO {
    docNumber: string;
    docDate: string;

    // T2 Tax Control
    isTaxInvoice: boolean;
    taxCode: string | null;
    taxRate: number;
    taxCalculationMode: string;

    // Seller Info (from Snapshots for Integrity)
    seller: {
        name: string;
        address: string;
        phone: string;
        taxId: string | null;
        branch: string | null;
    };

    // Buyer Info (from Snapshots)
    buyer: {
        name: string;
        address: string;
        taxId: string | null;
        branch: string | null;
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
        taxableBase: number;
        taxAmount: number;
        taxRate: number;
        taxCode: string | null;
        subtotal: number;
        netAmount: number;
    }>;

    // Financial Matrix
    financials: {
        subtotal: number;
        discount: number;
        taxableBase: number;
        tax: number;
        net: number;
        netText: string; // "บาทถ้วน"
    };

    notes?: string;
}

/**
 * Maps Invoice (Prisma model with snapshots) to InvoicePrintSnapshotDTO
 * Phase T2: Uses snapshots exclusively for all printed data
 */
export function buildInvoicePrintDTO(invoice: any, shop: any): InvoicePrintSnapshotDTO {
    const financials = {
        subtotal: Number(invoice.subtotalAmount || 0),
        discount: Number(invoice.discountAmount || 0),
        taxableBase: Number(invoice.taxableBaseAmount || 0),
        tax: Number(invoice.taxAmount || 0),
        net: Number(invoice.netAmount || 0),
        netText: bahtText(Number(invoice.netAmount || 0)),
    };

    return {
        docNumber: invoice.invoiceNo,
        docDate: invoice.date instanceof Date ? invoice.date.toISOString() : invoice.date,

        isTaxInvoice: !!invoice.isTaxInvoice,
        taxCode: invoice.taxCodeSnapshot,
        taxRate: Number(invoice.taxRateSnapshot || 0),
        taxCalculationMode: invoice.taxCalculationModeSnapshot || 'EXCLUSIVE',

        seller: {
            name: invoice.sellerNameSnapshot || shop?.name || 'ร้านค้า',
            address: invoice.sellerAddressSnapshot || shop?.address || '-',
            phone: shop?.phone || '-', // Phone is not yet snapshotted in schema but could be added
            taxId: invoice.sellerTaxIdSnapshot,
            branch: invoice.sellerBranchSnapshot,
        },

        buyer: {
            name: invoice.customerNameSnapshot || 'ลูกค้าทั่วไป',
            address: invoice.billingAddressSnapshot || '-',
            taxId: invoice.taxIdSnapshot,
            branch: invoice.customerBranchSnapshot,
        },

        items: (invoice.items || []).map((item: any) => ({
            sku: item.skuSnapshot || '-',
            name: item.productNameSnapshot || 'ไม่ระบุสินค้า',
            quantity: Number(item.quantity || 0),
            uom: item.uomSnapshot || 'Unit',
            unitPrice: Number(item.unitPrice || 0),
            discountAmount: Number(item.discountAmount || 0),
            taxableBase: Number(item.taxableBaseAmount || 0),
            taxAmount: Number(item.taxAmount || 0),
            taxRate: Number(item.taxRateSnapshot || 0),
            taxCode: item.taxCodeSnapshot,
            subtotal: Number(item.lineSubtotalAmount || 0),
            netAmount: Number(item.lineNetAmount || 0),
        })),

        financials,
        notes: invoice.notes || (invoice.sale?.notes) || '',
    };
}
