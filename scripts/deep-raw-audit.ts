import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log(`\n🔍 DEEP RAW AUDIT for ฿500,200 data...`);

    const stocks = await prisma.warehouseStock.findMany({
        where: { quantity: { gt: 0 } },
        include: {
            product: { select: { name: true, shopId: true } },
            warehouse: { select: { name: true, id: true } }
        }
    });

    const targetRecords = stocks.filter(s => s.product?.name === "ฟหกฟหก" || s.quantity >= 100);

    targetRecords.forEach(ws => {
        console.log(`\n[Record: ${ws.id}]`);
        console.log(`  Product: ${ws.product?.name} (${ws.productId}) [Product Owner Shop: ${ws.product?.shopId}]`);
        console.log(`  WH: ${ws.warehouse.name} (${ws.warehouseId})`);
        console.log(`  Record Owner Shop: ${ws.shopId}`);
        console.log(`  Quantity: ${ws.quantity}`);
    });

    const shopNames = await prisma.shop.findMany({
        where: { id: { in: targetRecords.map(r => r.shopId) } },
        select: { id: true, name: true }
    });
    console.log(`\n🏢 Shop mapping:`);
    shopNames.forEach(s => console.log(`  ${s.id} -> ${s.name}`));
}

main().finally(() => prisma.$disconnect());
