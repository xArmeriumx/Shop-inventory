/**
 * sale-create.use-case.ts — Sale creation and updating
 */
import { db, runInTransaction } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { NotificationService } from '@/services/core/intelligence/notification.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { CustomerService } from '../customer.service';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { WorkflowService } from '@/services/core/workflow/workflow.service';
import { SaleMapper } from '@/lib/mappers/sales.mapper';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { SALE_AUDIT_POLICIES } from '@/policies/sales/sale.policy';
import { SALES_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';
import { resolveLocked } from '@/lib/lock-helpers';
import { money, toNumber } from '@/lib/money';
import { SaleInput } from '@/schemas/sales/sale.schema';
import {
  RequestContext,
  ServiceError,
  DocumentType,
  SaleStatus,
  BookingStatus,
  DocPaymentStatus,
  MutationResult,
  SaleDetailDTO,
} from '@/types/domain';

export const SaleCreateUseCase = {
  async create(ctx: RequestContext, payload: SaleInput, tx?: Prisma.TransactionClient): Promise<MutationResult<SaleDetailDTO>> {
    Security.requirePermission(ctx, 'SALE_CREATE');
    Security.assertSameShop(ctx, ctx.shopId);

    if (!ctx.memberId) {
      throw new ServiceError('ไม่สามารถสร้างรายการขายได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
    }
    const { items, customerAddress, ...saleData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const result = await AuditService.runWithAudit(
      ctx,
      {
        ...SALE_AUDIT_POLICIES.CREATE(saleData.customerName || 'New Sale'),
        note: `ลงบัญชีการขายใหม่: #${ctx.memberId || 'SYSTEM'}`,
      },
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const departmentCode = ctx.employeeDepartment || null;
          const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, prisma, {
            departmentCode: departmentCode || undefined,
          });

          const productIds = items.map(item => item.productId);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, stock: true, reservedStock: true, costPrice: true, packagingQty: true, isSaleable: true },
          });
          const productDataMap = new Map<string, any>(products.map(p => [p.id, p]));

          const defaultWhId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
          const resolvedWarehouseIds = items.map(item => item.warehouseId || defaultWhId);

          const itemsWithWarehouse = items
            .map((item, idx) => ({ item, warehouseId: resolvedWarehouseIds[idx] }))
            .filter(({ item }) => !!item.warehouseId);

          const warehouseStockMap = new Map<string, number>();
          if (itemsWithWarehouse.length > 0) {
            const warehouseStocks = await (prisma as any).warehouseStock.findMany({
              where: {
                OR: itemsWithWarehouse.map(({ item, warehouseId }) => ({
                  productId: item.productId,
                  warehouseId,
                })),
              },
              select: { productId: true, warehouseId: true, quantity: true },
            });
            for (const ws of warehouseStocks) {
              warehouseStockMap.set(`${ws.productId}:${ws.warehouseId}`, Number(ws.quantity));
            }
          }

          const stockErrors: string[] = [];
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const product = productDataMap.get(item.productId);
            if (!product) {
              stockErrors.push(`ไม่พบสินค้า ID: ${item.productId}`);
              continue;
            }
            if (product.isSaleable === false) {
              stockErrors.push(`"${product.name}" ไม่ได้เปิดให้ขาย กรุณาติดต่อผู้ดูแลระบบ`);
              continue;
            }

            if (item.warehouseId) {
              const whQty = warehouseStockMap.get(`${item.productId}:${item.warehouseId}`) ?? 0;
              if (whQty < item.quantity) {
                stockErrors.push(`"${product.name}" คงเหลือในคลังนี้ไม่พอ (ต้องการ ${item.quantity}, คงเหลือในคลัง ${whQty})`);
              }
            } else {
              const available = Number(money.subtract(product.stock, product.reservedStock || 0));
              if (available < item.quantity) {
                stockErrors.push(`"${product.name}" มีสต็อกไม่พอ (ต้องการ ${item.quantity}, มีอยู่ ${available})`);
              }
            }
          }

          if (stockErrors.length > 0) {
            throw new ServiceError(stockErrors.join('\n'));
          }

          const beforeSnapshot = products.map(p => ({
            id: p.id,
            name: p.name,
            stock: Number(p.stock),
            reservedStock: Number(p.reservedStock || 0)
          }));

          const computationItems: CalculationItemInput[] = items.map(item => {
            const product = productDataMap.get(item.productId)!;
            return {
              qty: item.quantity,
              unitPrice: item.salePrice,
              costPrice: toNumber(product.costPrice),
              lineDiscount: item.discountAmount || 0,
            };
          });

          const calculation = ComputationEngine.calculateTotals(
            computationItems,
            { type: saleData.discountType as any, value: saleData.discountValue || 0 },
            {
              rate: Number(saleData.taxRate) || 0,
              mode: saleData.taxMode === 'NO_VAT' ? 'EXCLUSIVE' : (saleData.taxMode as any),
              kind: saleData.taxMode === 'NO_VAT' ? 'NO_VAT' : 'VAT' as any
            }
          );

          const saleItemsToCreate = calculation.lines.map((res, idx) => ({
            productId: items[idx].productId,
            quantity: res.qty,
            packagingQty: productDataMap.get(items[idx].productId)!.packagingQty || 1,
            salePrice: res.unitPrice,
            costPrice: res.costPrice,
            subtotal: res.lineNet,
            profit: res.lineProfit,
            discountAmount: res.lineDiscount,
            taxAmount: res.taxAmount,
            taxableAmount: res.taxableBase,
            warehouseId: resolvedWarehouseIds[idx],
          }));

          const orderNumber = await SequenceService.generate(ctx, DocumentType.SALE_ORDER, prisma);

          const { totals } = calculation;
          const netAmount = totals.netAmount;
          const totalAmount = totals.subtotalAmount;
          const totalCost = totals.totalCost;
          const billDiscountAmount = totals.billDiscountAmount;

          let finalCustomerId = saleData.customerId;
          if (finalCustomerId) {
            await CustomerService.checkCreditLimit(finalCustomerId, netAmount, ctx, prisma);
          }

          const resolvedPaymentStatus = (saleData.paymentMethod === 'CREDIT' ? 'UNPAID' : 'PAID') as DocPaymentStatus;
          const sale = await prisma.sale.create({
            data: {
              customerId: finalCustomerId || null,
              userId: ctx.userId,
              memberId: ctx.memberId || null,
              shopId: ctx.shopId,
              invoiceNumber: orderNumber,
              date: saleData.date ? new Date(saleData.date) : new Date(),
              paymentMethod: saleData.paymentMethod,
              notes: saleData.notes || null,
              departmentCode: departmentCode || undefined,
              totalAmount,
              totalCost,
              profit: totals.totalProfit,
              taxMode: saleData.taxMode,
              taxRate: saleData.taxRate,
              taxAmount: totals.taxAmount,
              taxableAmount: totals.taxableBaseAmount,
              discountType: saleData.discountType,
              discountValue: saleData.discountValue,
              discountAmount: billDiscountAmount,
              netAmount,
              paymentStatus: resolvedPaymentStatus,
              status: SaleStatus.CONFIRMED,
              bookingStatus: BookingStatus.RESERVED,
              channel: 'ERP',
              items: { create: saleItemsToCreate },
              statusDetail: {
                create: {
                  shopId:        ctx.shopId,
                  status:        SaleStatus.CONFIRMED,
                  paymentStatus: resolvedPaymentStatus,
                  billingStatus: 'UNBILLED',
                  deliveryStatus:'PENDING',
                  bookingStatus: BookingStatus.RESERVED,
                  editLockStatus:'NONE',
                },
              },
              taxSummary: {
                create: {
                  shopId:        ctx.shopId,
                  taxMode:       saleData.taxMode,
                  taxRate:       saleData.taxRate,
                  taxAmount:     totals.taxAmount,
                  taxableAmount: totals.taxableBaseAmount,
                },
              },
              paymentDetail: {
                create: {
                  shopId:       ctx.shopId,
                  paymentMethod:saleData.paymentMethod,
                  paidAmount:   resolvedPaymentStatus === 'PAID' ? netAmount : 0,
                  residualAmount:resolvedPaymentStatus === 'PAID' ? 0 : netAmount,
                },
              },
            } as Prisma.SaleUncheckedCreateInput,
            include: { items: true, customer: true, statusDetail: true, taxSummary: true, paymentDetail: true },
          });

          await StockService.bulkReserveStock(sale.items, ctx, prisma);

          const afterSnapshot = products.map(p => {
            const item = items.find(i => i.productId === p.id);
            const qty = item ? Number(item.quantity) : 0;
            return {
              id: p.id,
              name: p.name,
              stock: Number(p.stock) - qty,
              reservedStock: Number(p.reservedStock || 0)
            };
          });

          (ctx as any).auditMetadata = {
            before: { inventoryBefore: beforeSnapshot },
            after: { inventoryAfter: afterSnapshot }
          };

          const resultDTO = SaleMapper.toDetailDTO(sale, ctx);

          NotificationService.create({
            shopId: ctx.shopId,
            type: 'NEW_SALE',
            severity: 'INFO',
            title: `ยอดขายใหม่ ${resultDTO.invoiceNumber}`,
            message: `ยอดรวม ${resultDTO.netAmount} บาท`,
            link: `/sales/${resultDTO.id}`,
          }).catch(() => { });

          return resultDTO;
        });
      }
    );

    const affectedTags: string[] = [SALES_TAGS.LIST, SALES_TAGS.DASHBOARD];
    payload.items.forEach(item => {
      affectedTags.push(INVENTORY_TAGS.STOCK(item.productId));
    });

    return {
      data: result,
      affectedTags
    };
  },

  async update(id: string, ctx: RequestContext, payload: any): Promise<MutationResult<SaleDetailDTO>> {
    Security.require(ctx, 'SALE_UPDATE' as Permission);
    const sale = await db.sale.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    WorkflowService.canSaleAction(sale as any, 'UPDATE');

    const result = await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.UPDATE(sale.invoiceNumber, payload),
      async () => {
        const locked = resolveLocked(sale as any);

        if (locked) {
          try {
            Security.require(ctx, Permission.SALE_EDIT_LOCKED);
          } catch (e) {
            const { notes, paymentMethod, channel } = payload;
            const updated = await db.sale.update({
              where: { id, shopId: ctx.shopId },
              data: {
                notes: notes ?? sale.notes,
                paymentMethod: paymentMethod ?? sale.paymentMethod,
                channel: channel ?? sale.channel,
              },
              include: { items: true, customer: true },
            });
            return SaleMapper.toDetailDTO(updated, ctx);
          }
        }

        const updated = await db.sale.update({
          where: { id, shopId: ctx.shopId },
          data: payload,
          include: { items: true, customer: true },
        });

        return SaleMapper.toDetailDTO(updated, ctx);
      }
    );

    return {
      data: result,
      affectedTags: [SALES_TAGS.LIST, SALES_TAGS.DETAIL(id), SALES_TAGS.DASHBOARD]
    };
  }
};
