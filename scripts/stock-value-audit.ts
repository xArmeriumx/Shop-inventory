import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst({ where: { name: "อาร์ม ณภัทร (Armerium)" } });
    if (!shop) return;

    console.log(`\n💰 Stock Value Audit for shop: "${shop.name}"`);

    const whs = await prisma.warehouse.findMany({ where: { shopId: shop.id } });

    for (const wh of whs) {
        const stocks = await prisma.warehouseStock.findMany({
            where: { warehouseId: wh.id, quantity: { gt: 0 } },
            select: {
                quantity: true,
                product: { select: { name: true, costPrice: true, sku: true } }
            }
        });

        console.log(`\n📦 Warehouse: ${wh.name} (${wh.id})`);
        console.log(`   Items with quantity > 0: ${stocks.length}`);

        let totalValue = 0;
        let itemsWithZeroCost = 0;

        stocks.forEach(s => {
            const cost = Number(s.product?.costPrice || 0);
            const qty = s.quantity;
            const lineValue = cost * qty;
            totalValue += lineValue;
            if (cost === 0) itemsWithZeroCost++;
        });

        console.log(`   Calculated Total Value: ${totalValue.toLocaleString()}`);
        console.log(`   Items with quantity > 0 BUT costPrice = 0: ${itemsWithZeroCost}`);

        if (stocks.length > 0) {
            console.log(`   Sample items:`);
            stocks.slice(0, 5).forEach(s =>
                console.log(`     - ${s.product?.name} (SKU: ${s.product?.sku}): Qty: ${s.quantity}, Cost: ${s.product?.costPrice}`)
            );
        }
    }
}

main().finally(() => prisma.$disconnect());
