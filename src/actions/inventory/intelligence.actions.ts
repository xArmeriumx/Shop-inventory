'use server';

import { requirePermission } from '@/lib/auth-guard';
import { ProductIntelligenceService } from '@/services/core/intelligence/inventory-intelligence.service';
import { StockMovementType } from '@prisma/client';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

export async function getProductIntelligenceSummary(productId: string) {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('PRODUCT_VIEW');
            return ProductIntelligenceService.getSummary(productId, ctx);
        }, 'inventory:getProductIntelligenceSummary');
    }, { context: { action: 'getProductIntelligenceSummary' } });
}

export async function getProductMovementHistory(
    productId: string,
    params: { page?: number; limit?: number; type?: StockMovementType; startDate?: string; endDate?: string } = {}
) {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('PRODUCT_VIEW');
            return ProductIntelligenceService.getMovementHistory(productId, ctx, params);
        }, 'inventory:getProductMovementHistory');
    }, { context: { action: 'getProductMovementHistory' } });
}

export async function getProductSupplierIntelligence(productId: string) {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('PRODUCT_VIEW');
            return ProductIntelligenceService.getSupplierIntelligence(productId, ctx);
        }, 'inventory:getProductSupplierIntelligence');
    }, { context: { action: 'getProductSupplierIntelligence' } });
}
