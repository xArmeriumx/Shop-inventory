import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst({
        where: { name: "Test Flow 26/04/69" }
    });

    if (!shop) {
        console.log("❌ Shop not found");
        return;
    }

    console.log(`\n━━━ 🔍 Focus Diagnostic: "${shop.name}" (${shop.id}) ━━━`);

    const warehouses = await prisma.warehouse.findMany({ where: { shopId: shop.id } });
    console.log(`\n📦 Warehouses:`);
    for (const wh of warehouses) {
        console.log(`  - ${wh.name} (${wh.id}) default=${wh.isDefault}`);
    }

    const productsWithStockValue = await prisma.product.findMany({
        where: { shopId: shop.id, isActive: true },
        select: { id: true, name: true, stock: true, costPrice: true }
    });

    console.log(`\n🏷️ Products in Shop:`);
    for (const p of productsWithStockValue) {
        console.log(`  - ${p.name}: Product.stock=${p.stock}, costPrice=${p.costPrice}`);

        const whStocks = await prisma.warehouseStock.findMany({
            where: { productId: p.id },
            include: { warehouse: { select: { name: true } } }
        });

        if (whStocks.length === 0) {
            console.log(`    ❌ NO WarehouseStock records found!`);
        } else {
            whStocks.forEach(ws => {
                console.log(`    ✅ WH: ${ws.warehouse.name} (${ws.warehouseId}) | Qty: ${ws.quantity}`);
            });
        }
    }

    // Check the DashboardService calculation logic manually
    const stockValueRecords = await prisma.warehouseStock.findMany({
        where: { shopId: shop.id, quantity: { gt: 0 } },
        include: { product: { select: { costPrice: true } } }
    });

    console.log(`\n📊 Global Stock Value Calculation (WarehouseStock SSOT):`);
    console.log(`   Positive Stock Records: ${stockValueRecords.length}`);
    let total = 0;
    stockValueRecords.forEach(r => {
        const cost = Number(r.product?.costPrice || 0);
        total += cost * r.quantity;
        console.log(`     Item: ${r.productId} | Qty: ${r.quantity} | Cost: ${cost} | Sum: ${cost * r.quantity}`);
    });
    console.log(`   Final Total Value: ${total}`);
}

main().finally(() => prisma.$disconnect());
