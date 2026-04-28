import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = "flow1@gmail.com";
    const user = await prisma.user.findFirst({
        where: { email },
        include: { memberships: { include: { shop: true } } }
    });

    if (!user) {
        console.log("❌ User not found");
        return;
    }

    console.log(`\n👤 User: ${user.name} (${user.email}) [ID: ${user.id}]`);
    console.log(`🏢 Shops for this user:`);
    for (const m of user.memberships) {
        console.log(`  - Shop: "${m.shop.name}" (${m.shop.id})`);

        const whs = await prisma.warehouse.findMany({ where: { shopId: m.shopId } });
        const productCount = await prisma.product.count({ where: { shopId: m.shopId } });

        const warehouseStocks = await prisma.warehouseStock.findMany({
            where: { shopId: m.shopId, quantity: { gt: 0 } },
            include: { product: { select: { costPrice: true } } }
        });

        let totalValue = 0;
        warehouseStocks.forEach(ws => {
            totalValue += Number(ws.product?.costPrice || 0) * ws.quantity;
        });

        console.log(`    > Warehouses (${whs.length}):`);
        whs.forEach(w => console.log(`      * ${w.name} (${w.id})`));
        console.log(`    > Products: ${productCount}`);
        console.log(`    > Total Stock Value: ${totalValue.toLocaleString()}`);
    }
}

main().finally(() => prisma.$disconnect());
