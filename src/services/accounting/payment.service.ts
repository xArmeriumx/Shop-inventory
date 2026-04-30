/**
 * payment.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { PaymentRecord } from './payment/record';
import { PaymentVoid } from './payment/void';
import { PaymentRecalculateEngine } from './payment/recalculate.engine';
import { PaymentQuery } from './payment/query';

export * from './payment/record'; // Export PaymentInput

export const PaymentService = {
    // Queries
    getPaymentHistory: PaymentQuery.getPaymentHistory,

    // Mutations
    recordPayment: PaymentRecord.recordPayment,
    voidPayment: PaymentVoid.voidPayment,

    // Engine
    recalculateDocumentBalance: PaymentRecalculateEngine.recalculateDocumentBalance,
};
