import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log(`\n🔍 Searching for the ฿500,200 shop...`);

    const stocks = await prisma.warehouseStock.findMany({
        where: { quantity: { gt: 0 } },
        include: {
            product: { select: { name: true, costPrice: true, shopId: true } },
            warehouse: { select: { name: true, id: true, shopId: true } },
            shop: { select: { name: true, id: true } }
        }
    });

    const shopStats = new Map<string, { name: string, totalValue: number, warehouses: any[] }>();

    stocks.forEach(ws => {
        const cost = Number(ws.product?.costPrice || 0);
        const value = cost * ws.quantity;
        const shopId = ws.shopId;

        if (!shopStats.has(shopId)) {
            shopStats.set(shopId, { name: ws.shop.name, totalValue: 0, warehouses: [] });
        }
        const stat = shopStats.get(shopId)!;
        stat.totalValue += value;

        if (!stat.warehouses.some(w => w.id === ws.warehouseId)) {
            stat.warehouses.push({ id: ws.warehouseId, name: ws.warehouse.name, shopId: ws.warehouse.shopId });
        }
    });

    console.log(`\n📊 Shop stock summary:`);
    shopStats.forEach((v, k) => {
        if (v.totalValue > 0) {
            console.log(`  - Shop: "${v.name}" (${k}) | Total Value: ${v.totalValue.toLocaleString()}`);
            v.warehouses.forEach(wh => {
                console.log(`    > WH: ${wh.name} (${wh.id}) [Owner Shop: ${wh.shopId}]`);
            });
        }
    });
}

main().finally(() => prisma.$disconnect());
