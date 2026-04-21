import { ServiceError } from '@/types/domain';

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
    canSaleAction(sale: { status: string; billingStatus: string; isLocked: boolean; editLockStatus: string }, action: WorkflowAction) {
        if (action === 'UPDATE' || action === 'CANCEL') {
            if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

            // If billed or locked by system, generally shouldn't be editable unless with special permission
            // (Note: SALE_UPDATE_LOCKED permission logic belongs in SecurityService, here we just check raw state)
            if (sale.isLocked || sale.editLockStatus === 'LOCKED') {
                if (action === 'CANCEL') throw new ServiceError('ไม่สามารถยกเลิกรายการที่ถูกล็อกหรือประมวลผลไปแล้วได้');
                // UPDATE might still be allowed but it will be gated by Security.require('SALE_UPDATE_LOCKED')
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
