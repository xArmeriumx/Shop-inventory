import { toNumber } from '@/lib/money';
import { RequestContext } from '@/types/common';
import { Permission } from '@prisma/client';
import { SaleListDTO, SaleDetailDTO, SaleItemDTO } from '@/types/dtos/sales.dto';
import { resolveLocked } from '@/lib/lock-helpers';

/**
 * SaleMapper — Central logic for Sale DTO shaping & security
 *
 * 🛡️ MAPPER SHIELD PATTERN:
 *   อ่านข้อมูลจาก Child Tables (statusDetail, taxSummary, paymentDetail) ก่อนเสมอ
 *   และ Fallback ไปยังฟิลด์เดิมใน Sale สำหรับ Record เก่าที่ยังไม่ได้ Backfill
 *   ทำให้ UI ไม่รู้ตัวว่า Database โครงสร้างเปลี่ยนแล้ว
 */
export const SaleMapper = {

    // ─── Private Helpers: Read from child tables with legacy fallback ───────────

    /** อ่านสถานะจาก SaleStatus ก่อน Fallback ไป Sale เดิม */
    _resolveStatus(sale: any) {
        const s = sale.statusDetail;
        const resolvedLockStatus = s?.editLockStatus ?? sale.editLockStatus ?? 'NONE';
        return {
            status:         s?.status         ?? sale.status,
            paymentStatus:  s?.paymentStatus  ?? sale.paymentStatus,
            billingStatus:  s?.billingStatus  ?? sale.billingStatus,
            deliveryStatus: s?.deliveryStatus ?? sale.deliveryStatus,
            bookingStatus:  s?.bookingStatus  ?? sale.bookingStatus,
            editLockStatus: resolvedLockStatus,
            isLocked:       resolveLocked({ editLockStatus: resolvedLockStatus }),
            lockReason:     s?.lockReason     ?? sale.lockReason,
            cancelReason:   s?.cancelReason   ?? sale.cancelReason,
            cancelledAt:    s?.cancelledAt    ?? sale.cancelledAt,
            cancelledBy:    s?.cancelledBy    ?? sale.cancelledBy,
        };
    },

    /** อ่านข้อมูลภาษีจาก SaleTaxSummary ก่อน Fallback ไป Sale เดิม */
    _resolveTax(sale: any) {
        const t = sale.taxSummary;
        return {
            taxMode:       t?.taxMode       ?? sale.taxMode       ?? 'INCLUSIVE',
            taxRate:       toNumber(t?.taxRate       ?? sale.taxRate       ?? 7),
            taxAmount:     toNumber(t?.taxAmount     ?? sale.taxAmount     ?? 0),
            taxableAmount: toNumber(t?.taxableAmount ?? sale.taxableAmount ?? 0),
        };
    },

    /** อ่านข้อมูลชำระเงินจาก SalePaymentDetail ก่อน Fallback ไป Sale เดิม */
    _resolvePayment(sale: any) {
        const p = sale.paymentDetail;
        return {
            paymentMethod:      p?.paymentMethod      ?? sale.paymentMethod,
            paymentProof:       p?.paymentProof       ?? sale.paymentProof,
            paymentNote:        p?.paymentNote        ?? sale.paymentNote,
            paymentVerifiedAt:  p?.paymentVerifiedAt  ?? sale.paymentVerifiedAt,
            paymentVerifiedBy:  p?.paymentVerifiedBy  ?? sale.paymentVerifiedBy,
            paymentStatusProof: p?.paymentStatusProof ?? sale.paymentStatusProof ?? 'VERIFIED',
            paidAmount:         toNumber(p?.paidAmount     ?? sale.paidAmount     ?? 0),
            residualAmount:     toNumber(p?.residualAmount ?? sale.residualAmount ?? 0),
        };
    },

    // ─── Public Methods ──────────────────────────────────────────────────────────

    /**
     * Map Sale to List DTO (Lightweight — ใช้สำหรับหน้า List/Dashboard)
     */
    toListDTO(sale: any, ctx?: RequestContext): SaleListDTO {
        const { status, paymentStatus } = this._resolveStatus(sale);
        const { paymentMethod } = this._resolvePayment(sale);

        const dto: SaleListDTO = {
            id:              sale.id,
            invoiceNumber:   sale.invoiceNumber,
            date:            sale.date,
            customerName:    sale.customer?.name || sale.customerName || 'N/A',
            customerAddress: sale.customer?.address || sale.customerAddress || undefined,
            customerPhone:   sale.customer?.phone  || sale.customerPhone  || undefined,
            customerTaxId:   sale.customer?.taxId  || sale.customerTaxId  || undefined,
            status,
            paymentStatus,
            paymentMethod,
            netAmount:       toNumber(sale.netAmount),
        };

        if (ctx && (ctx.permissions.includes(Permission.SALE_VIEW_PROFIT) || ctx.isOwner)) {
            dto.profit = toNumber(sale.profit);
        }

        return dto;
    },

    /**
     * Map Sale to Detail DTO (Full Data + Security)
     * 🛡️ Mapper Shield: UI ได้รับ Flat Object เหมือนเดิม แม้ DB จะแตก Child Tables แล้ว
     */
    toDetailDTO(sale: any, ctx: RequestContext): SaleDetailDTO {
        const canViewProfit = ctx.permissions.includes(Permission.SALE_VIEW_PROFIT) || ctx.isOwner;
        const statusFields  = this._resolveStatus(sale);
        const taxFields     = this._resolveTax(sale);
        const paymentFields = this._resolvePayment(sale);

        const detail: SaleDetailDTO = {
            // Core
            ...this.toListDTO(sale, ctx),

            // Override with fully-resolved values
            status:             statusFields.status,
            paymentStatus:      statusFields.paymentStatus,
            paymentMethod:      paymentFields.paymentMethod,

            // Status Extended
            billingStatus:      statusFields.billingStatus,
            deliveryStatus:     statusFields.deliveryStatus,
            bookingStatus:      statusFields.bookingStatus,
            editLockStatus:     statusFields.editLockStatus,
            isLocked:           statusFields.isLocked,
            lockReason:         statusFields.lockReason,
            cancelReason:       statusFields.cancelReason,

            // Financial Core
            notes:              sale.notes || undefined,
            channel:            sale.channel,
            discountAmount:     toNumber(sale.discountAmount),
            totalAmount:        toNumber(sale.totalAmount),

            // Tax (from SaleTaxSummary)
            taxMode:            taxFields.taxMode,
            taxRate:            taxFields.taxRate,
            taxAmount:          taxFields.taxAmount,
            taxableAmount:      taxFields.taxableAmount,

            // Payment (from SalePaymentDetail)
            paidAmount:         paymentFields.paidAmount,
            residualAmount:     paymentFields.residualAmount,
            paymentProof:       paymentFields.paymentProof,
            paymentNote:        paymentFields.paymentNote,
            paymentVerifiedAt:  paymentFields.paymentVerifiedAt,
            paymentStatusProof: paymentFields.paymentStatusProof,

            // Items
            items: (sale.items || []).map((item: any) => this.toItemDTO(item, canViewProfit)),
        };

        if (canViewProfit) {
            detail.totalCost = toNumber(sale.totalCost);
            detail.profit    = toNumber(sale.profit);
        }

        return detail;
    },

    /**
     * Map Sale Item to DTO
     */
    toItemDTO(item: any, canViewProfit: boolean): SaleItemDTO {
        const dto: SaleItemDTO = {
            id:             item.id,
            productId:      item.productId,
            productName:    item.product?.name || item.productName || 'Unknown Product',
            quantity:       toNumber(item.quantity),
            unitPrice:      toNumber(item.salePrice),
            discountAmount: toNumber(item.discountAmount),
            subtotal:       toNumber(item.subtotal),
        };

        if (canViewProfit) {
            dto.costPrice = toNumber(item.costPrice);
            dto.profit    = toNumber(item.profit);
        }

        return dto;
    }
};


