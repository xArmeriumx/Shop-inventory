/**
 * quotation.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { QuotationQuery } from './quotation/query';
import { QuotationCreate } from './quotation/create';
import { QuotationConfirm } from './quotation/confirm';
import { QuotationCancel } from './quotation/cancel';

export const QuotationService = {
    // Queries
    list: QuotationQuery.list,
    getById: QuotationQuery.getById,

    // Mutations
    create: QuotationCreate.create,
    confirm: QuotationConfirm.confirm,
    cancel: QuotationCancel.cancel,
};
