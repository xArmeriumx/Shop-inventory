import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shopNames = ["อาร์ม ณภัทร (Armerium)", "AAA ทีมโห"];

    for (const name of shopNames) {
        const shop = await prisma.shop.findFirst({ where: { name } });
        if (!shop) continue;

        console.log(`\n━━━ Shop: "${shop.name}" (${shop.id}) ━━━`);

        const warehouses = await prisma.warehouse.findMany({ where: { shopId: shop.id } });
        warehouses.forEach(w => console.log(`  WH: ${w.name} (${w.id}) default=${w.isDefault}`));

        const totalSaleItems = await prisma.saleItem.count({ where: { sale: { shopId: shop.id } } });
        const nullWhSaleItems = await prisma.saleItem.count({ where: { sale: { shopId: shop.id }, warehouseId: null } });
        console.log(`  SaleItems: ${totalSaleItems} (null: ${nullWhSaleItems})`);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

        for (const wh of warehouses) {
            const todaySales = await prisma.sale.count({
                where: { shopId: shop.id, date: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' }, items: { some: { warehouseId: wh.id } } }
            });
            const allSales = await prisma.sale.count({
                where: { shopId: shop.id, status: { not: 'CANCELLED' }, items: { some: { warehouseId: wh.id } } }
            });
            const stockItems = await prisma.warehouseStock.count({ where: { warehouseId: wh.id, quantity: { gt: 0 } } });

            console.log(`  > Warehouse [${wh.name}]:`);
            console.log(`    Today Sales: ${todaySales}`);
            console.log(`    All-time Sales: ${allSales}`);
            console.log(`    Positive Stock Items: ${stockItems}`);
        }
    }
}

main().finally(() => prisma.$disconnect());
