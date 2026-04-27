import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== 🔍 DASHBOARD DIAGNOSTIC REPORT ===\n');

    // 1. Get the main shop
    const shops = await prisma.shop.findMany({ select: { id: true, name: true } });
    console.log(`📌 Shops: ${shops.map(s => `${s.name} (${s.id})`).join(', ')}\n`);

    for (const shop of shops) {
        console.log(`\n━━━ Shop: "${shop.name}" ━━━`);

        // 2. List all warehouses
        const warehouses = await prisma.warehouse.findMany({
            where: { shopId: shop.id },
            select: { id: true, name: true, code: true, isDefault: true, isActive: true }
        });
        console.log(`\n📦 Warehouses (${warehouses.length}):`);
        warehouses.forEach(w =>
            console.log(`  - ${w.name} (${w.code}) [ID: ${w.id}] default=${w.isDefault} active=${w.isActive}`)
        );

        // 3. Check SaleItem warehouseId distribution
        const totalSaleItems = await prisma.saleItem.count({
            where: { sale: { shopId: shop.id } }
        });
        const nullWhSaleItems = await prisma.saleItem.count({
            where: { sale: { shopId: shop.id }, warehouseId: null }
        });
        console.log(`\n🧾 SaleItem warehouseId distribution:`);
        console.log(`  Total SaleItems: ${totalSaleItems}`);
        console.log(`  With warehouseId: ${totalSaleItems - nullWhSaleItems}`);
        console.log(`  warehouseId = null: ${nullWhSaleItems}`);

        // 4. Check which warehouse IDs are on SaleItems
        if (totalSaleItems > 0) {
            const distinctWhs = await prisma.saleItem.groupBy({
                by: ['warehouseId'],
                where: { sale: { shopId: shop.id } },
                _count: true,
            });
            console.log(`\n  Breakdown by warehouseId:`);
            distinctWhs.forEach(g => {
                const whName = warehouses.find(w => w.id === g.warehouseId)?.name || 'UNKNOWN/NULL';
                console.log(`    ${g.warehouseId || 'null'} (${whName}): ${g._count} items`);
            });
        }

        // 5. Test the actual dashboard query for each warehouse
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        console.log(`\n📊 Dashboard Query Tests (today: ${today.toLocaleDateString()}):`);

        // Test without filter
        const allSalesToday = await prisma.sale.findMany({
            where: { shopId: shop.id, date: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } },
            select: { id: true, invoiceNumber: true, netAmount: true }
        });
        console.log(`\n  [ALL] Today's sales: ${allSalesToday.length}`);
        allSalesToday.forEach(s => console.log(`    - ${s.invoiceNumber}: ${s.netAmount}`));

        // Test with each warehouse
        for (const wh of warehouses) {
            const matchingSales = await prisma.sale.findMany({
                where: {
                    shopId: shop.id,
                    date: { gte: today, lt: tomorrow },
                    status: { not: 'CANCELLED' },
                    items: { some: { warehouseId: wh.id } }
                },
                select: { id: true, invoiceNumber: true, netAmount: true }
            });
            console.log(`\n  [WH: ${wh.name}] Matching sales: ${matchingSales.length}`);
            matchingSales.forEach(s => console.log(`    - ${s.invoiceNumber}: ${s.netAmount}`));

            // Also test with OR null
            const matchingWithNull = await prisma.sale.findMany({
                where: {
                    shopId: shop.id,
                    date: { gte: today, lt: tomorrow },
                    status: { not: 'CANCELLED' },
                    items: { some: { OR: [{ warehouseId: wh.id }, { warehouseId: null }] } }
                },
                select: { id: true, invoiceNumber: true, netAmount: true }
            });
            console.log(`  [WH: ${wh.name} + null] Matching sales: ${matchingWithNull.length}`);
        }

        // 6. Check ALL sales (not just today) for this shop with items
        const totalSales = await prisma.sale.count({
            where: { shopId: shop.id, status: { not: 'CANCELLED' } }
        });
        console.log(`\n📈 Total non-cancelled sales: ${totalSales}`);

        for (const wh of warehouses) {
            const matchingAllTime = await prisma.sale.count({
                where: {
                    shopId: shop.id,
                    status: { not: 'CANCELLED' },
                    items: { some: { warehouseId: wh.id } }
                }
            });
            console.log(`  [WH: ${wh.name}] All-time matching: ${matchingAllTime}`);
        }

        // 7. Check WarehouseStock
        const whStocks = await prisma.warehouseStock.findMany({
            where: { shopId: shop.id },
            select: { warehouseId: true, quantity: true },
        });
        const whStockSummary = new Map<string, { count: number; totalQty: number }>();
        whStocks.forEach(ws => {
            const key = ws.warehouseId;
            const existing = whStockSummary.get(key) || { count: 0, totalQty: 0 };
            existing.count++;
            existing.totalQty += ws.quantity;
            whStockSummary.set(key, existing);
        });
        console.log(`\n📦 WarehouseStock summary:`);
        whStockSummary.forEach((v, k) => {
            const whName = warehouses.find(w => w.id === k)?.name || 'UNKNOWN';
            console.log(`  ${whName}: ${v.count} products, total qty: ${v.totalQty}`);
        });
    }
}

main()
    .catch(e => { console.error('❌ Error:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
