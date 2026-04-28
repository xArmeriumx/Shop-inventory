import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst({ where: { name: "Test Flow 26/04/69" } });
    if (!shop) return;

    console.log(`\n🔍 Raw Data Audit: "${shop.name}" (${shop.id})`);

    // 1. Check all WarehouseStock records for this shop
    const whStocks = await prisma.warehouseStock.findMany({
        where: { shopId: shop.id },
        include: { warehouse: { select: { name: true, id: true } } }
    });

    console.log(`\n📦 WarehouseStock records belonging to this shop (${whStocks.length}):`);
    whStocks.forEach(ws => {
        console.log(`  - ID: ${ws.id} | Product: ${ws.productId} | WH: ${ws.warehouse.name} (${ws.warehouseId}) | Qty: ${ws.quantity}`);
    });

    // 2. Check for WarehouseStock records that belong to PRODUCTS of this shop but have a DIFFERENT shopId
    const products = await prisma.product.findMany({ where: { shopId: shop.id } });
    const productIds = products.map(p => p.id);

    const crossShopStocks = await prisma.warehouseStock.findMany({
        where: {
            productId: { in: productIds },
            shopId: { not: shop.id }
        },
        include: { warehouse: { select: { name: true, id: true } } }
    });

    console.log(`\n⚠️ Cross-Shop Mismatch (Records for this shop's products but marked with different shopId): ${crossShopStocks.length}`);
    crossShopStocks.forEach(ws => {
        console.log(`  - ID: ${ws.id} | Product: ${ws.productId} | Record ShopId: ${ws.shopId} | WH: ${ws.warehouse.name} (${ws.warehouseId})`);
    });

    // 3. Check for Product.stock vs WarehouseStock.quantity mismatch for EVERY product in this shop
    console.log(`\n📊 Product Stock Sync check:`);
    for (const p of products) {
        const totalWhQuantity = await prisma.warehouseStock.aggregate({
            where: { productId: p.id },
            _sum: { quantity: true }
        });
        const sum = totalWhQuantity._sum?.quantity || 0;
        if (p.stock !== sum) {
            console.log(`  ❌ Product "${p.name}" (${p.id}): Product.stock=${p.stock} vs SUM(WarehouseStock)=${sum}`);
        }
    }
}

main().finally(() => prisma.$disconnect());
