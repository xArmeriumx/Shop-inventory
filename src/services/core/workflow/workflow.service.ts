import { ServiceError } from '@/types/domain';
import { resolveLocked } from '@/lib/lock-helpers';

export type WorkflowAction = 'UPDATE' | 'CANCEL' | 'VOID' | 'POST' | 'APPROVE' | 'DELETE';

/**
 * Workflow Service (Pillar 1.1)
 * 
 * Separates "Can they do it?" (Permission) from "Is the document state allow it?" (Workflow)
 */
export const WorkflowService = {
    /**
     * Standard check for Invoice state machine
     */
    canInvoiceAction(invoice: { status: string; paidAmount: number | any }, action: WorkflowAction) {
        const status = invoice.status;
        const paidAmount = Number(invoice.paidAmount || 0);

        if (action === 'CANCEL') {
            if (status === 'CANCELLED') throw new ServiceError('ใบแจ้งหนี้นี้ถูกยกเลิกไปแล้ว');
            if (paidAmount > 0) throw new ServiceError('ไม่สามารถยกเลิกใบแจ้งหนี้ที่มีการรับชำระเงินแล้วได้');
        }

        if (action === 'POST') {
            if (status !== 'DRAFT') throw new ServiceError('สามารถ Post ได้เฉพาะใบแจ้งหนี้สถานะร่างเท่านั้น');
        }

        return true;
    },

    /**
     * Standard check for Sale state machine
     */
    canSaleAction(
        sale: { status: string; billingStatus: string; editLockStatus: string },
        action: WorkflowAction
    ) {
        if (action === 'UPDATE' || action === 'CANCEL') {
            if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

            // SSOT: resolveLocked() อ่านจาก editLockStatus เป็นหลัก (Fallback: isLocked)
            if (resolveLocked(sale)) {
                if (action === 'CANCEL') throw new ServiceError('ไม่สามารถยกเลิกรายการที่ถูกล็อกหรือประมวลผลไปแล้วได้');
                // UPDATE ยังอนุญาต แต่ต้องผ่าน Security.require('SALE_EDIT_LOCKED')
            }
        }

        return true;
    },

    /**
     * Generic wrapper for auditable state checks
     */
    assert(condition: boolean, message: string) {
        if (!condition) {
            throw new ServiceError(message);
        }
    }
};
