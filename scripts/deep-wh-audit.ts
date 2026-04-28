import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shopId = "cmofwcroa0003jx047hlx2py2";
    console.log(`\n🔍 DEEP WAREHOUSE AUDIT: Shop ${shopId}`);

    const warehouses = await prisma.warehouse.findMany({
        where: { shopId },
        select: { id: true, name: true, code: true }
    });

    console.log(`\n📦 Warehouses in Shop:`);
    warehouses.forEach(wh => {
        console.log(`  - ${wh.name} (${wh.id}) [Code: ${wh.code}]`);
    });

    const stocks = await prisma.warehouseStock.findMany({
        where: { shopId, quantity: { gt: 0 } },
        select: { warehouseId: true, id: true }
    });

    console.log(`\n🧾 Unique Warehouse IDs in WarehouseStock records:`);
    const stockWhIds = Array.from(new Set(stocks.map(s => s.warehouseId)));
    stockWhIds.forEach(id => {
        const match = warehouses.find(wh => wh.id === id);
        console.log(`  - ID: ${id} | Linked to Warehouse in Shop? ${match ? `YES (${match.name})` : "❌ NO! (Orphaned or Cross-shop)"}`);
    });
}

main().finally(() => prisma.$disconnect());
