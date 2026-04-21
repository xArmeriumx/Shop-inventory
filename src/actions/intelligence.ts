'use server';

import { requirePermission } from '@/lib/auth-guard';
import { ProductIntelligenceService } from '@/services/product-intelligence.service';
import { serialize } from '@/lib/utils';
import { StockMovementType } from '@prisma/client';

export async function getProductIntelligenceSummary(productId: string) {
    const ctx = await requirePermission('PRODUCT_VIEW');
    const result = await ProductIntelligenceService.getSummary(productId, ctx);
    return serialize(result);
}

export async function getProductMovementHistory(
    productId: string,
    params: { page?: number; limit?: number; type?: StockMovementType; startDate?: string; endDate?: string } = {}
) {
    const ctx = await requirePermission('PRODUCT_VIEW');
    const result = await ProductIntelligenceService.getMovementHistory(productId, ctx, params);
    return serialize(result);
}

export async function getProductSupplierIntelligence(productId: string) {
    const ctx = await requirePermission('PRODUCT_VIEW');
    const result = await ProductIntelligenceService.getSupplierIntelligence(productId, ctx);
    return serialize(result);
}
