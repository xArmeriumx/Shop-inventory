'use server';

import { requirePermission } from '@/lib/auth-guard';
import { ExportService } from '@/services';

export async function exportProductsData() {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ExportService.exportProductsData({ userId: ctx.userId, shopId: ctx.shopId });
}

export async function exportPurchasesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  return ExportService.exportPurchasesData(startDate, endDate, { userId: ctx.userId, shopId: ctx.shopId });
}

export async function exportReturnsData(startDate: string, endDate: string) {
  const ctx = await requirePermission('RETURN_VIEW');
  return ExportService.exportReturnsData(startDate, endDate, { userId: ctx.userId, shopId: ctx.shopId });
}

export async function exportCustomersData() {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  return ExportService.exportCustomersData({ userId: ctx.userId, shopId: ctx.shopId });
}

export async function exportIncomesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('INCOME_VIEW');
  return ExportService.exportIncomesData(startDate, endDate, { userId: ctx.userId, shopId: ctx.shopId });
}

export async function exportSalesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ExportService.exportSalesData(startDate, endDate, { userId: ctx.userId, shopId: ctx.shopId });
}

export async function exportExpensesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return ExportService.exportExpensesData(startDate, endDate, { userId: ctx.userId, shopId: ctx.shopId });
}
