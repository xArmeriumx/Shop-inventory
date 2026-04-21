import { PaymentService } from '../services/payment.service';
import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../types/domain';

const prisma = new PrismaClient();

async function testPaymentFlow() {
    console.log("🧪 Starting Payment System Verification...");

    // 1. Setup Mock Context
    const shop = await (prisma as any).shop.findFirst();
    if (!shop) throw new Error("No shop found for testing");

    const member = await (prisma as any).shopMember.findFirst({
        where: { shopId: shop.id }
    });
    if (!member) throw new Error("No shop member found for testing");

    const ctx: RequestContext = {
        userId: shop.userId,
        shopId: shop.id,
        memberId: member.id,
        permissions: [],
        isOwner: true
    };

    // 2. Setup Mock Sale (if none exists)
    let sale = await (prisma as any).sale.findFirst({
        where: { shopId: shop.id, status: { not: 'CANCELLED' } }
    });

    if (!sale) {
        console.log("- Creating mock sale for testing...");
        sale = await (prisma as any).sale.create({
            data: {
                shopId: shop.id,
                userId: shop.userId,
                memberId: member.id,
                totalAmount: 1000,
                netAmount: 1000,
                totalCost: 500,
                profit: 500,
                paymentMethod: 'CASH',
                billingStatus: 'UNBILLED',
                paymentStatus: 'UNPAID',
                paidAmount: 0,
                residualAmount: 1000,
                invoiceNumber: 'TEST-SALE-' + Date.now(),
                date: new Date(),
            }
        });
    }

    console.log(`- Parent Sale ID: ${sale.id} (Total: ${sale.totalAmount} THB)`);
    console.log(`- Initial Residual: ${sale.residualAmount} THB`);

    // 3. Record Partial Payment
    console.log("- Action: Recording partial payment (400 THB)...");
    await (PaymentService as any).recordPayment({
        saleId: sale.id,
        amount: 400,
        paymentMethodCode: 'TRANSFER',
        note: 'Partial payment test',
    }, ctx);

    let updatedSale = await (prisma as any).sale.findUnique({ where: { id: sale.id } });
    console.log(`  -> Current Residual: ${updatedSale.residualAmount} THB`);
    console.log(`  -> Payment Status: ${updatedSale.paymentStatus}`);

    // 4. Record Full Payment
    console.log("- Action: Recording full remaining payment...");
    await (PaymentService as any).recordPayment({
        saleId: sale.id,
        amount: (updatedSale as any).residualAmount,
        paymentMethodCode: 'CASH',
        note: 'Settlement test',
    }, ctx);

    updatedSale = await (prisma as any).sale.findUnique({ where: { id: sale.id } });
    console.log(`  -> Current Residual: ${updatedSale.residualAmount} THB`);
    console.log(`  -> Payment Status: ${updatedSale.paymentStatus}`);

    // 5. Void a payment
    const payments = await (PaymentService as any).getPaymentHistory({ saleId: sale.id }, ctx);
    const toVoid = payments[0]; // Most recent
    console.log(`- Action: Voiding payment ID: ${toVoid.id} (${toVoid.amount} THB)...`);
    await (PaymentService as any).voidPayment(toVoid.id, ctx);

    updatedSale = await (prisma as any).sale.findUnique({ where: { id: sale.id } });
    console.log(`  -> Current Residual: ${updatedSale.residualAmount} THB`);
    console.log(`  -> Payment Status: ${updatedSale.paymentStatus}`);

    console.log("✅ Verification Suite Completed.");
}

testPaymentFlow()
    .catch((e) => {
        console.error("❌ Test failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
