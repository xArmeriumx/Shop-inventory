import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcile() {
  console.log('🚀 Starting Stock Reconciliation...');

  // 1. Get all shops
  const shops = await prisma.shop.findMany();

  for (const shop of shops) {
    console.log(`\n📦 Reconciling Shop: ${shop.name} (${shop.id})`);

    // Ensure main warehouse exists
    let defaultWh = await prisma.warehouse.findFirst({
        where: { shopId: shop.id, isDefault: true }
    });

    if (!defaultWh) {
        console.log(`⚠️ No default warehouse for ${shop.name}. Creating WH-MAIN...`);
        defaultWh = await prisma.warehouse.create({
            data: {
                name: 'คลังสินค้าหลัก',
                code: 'WH-MAIN',
                isDefault: true,
                shopId: shop.id
            }
        });
    }

    // 2. Get all products for this shop
    const products = await prisma.product.findMany({
      where: { shopId: shop.id, deletedAt: null },
      include: {
        warehouseStocks: true
      }
    });

    for (const product of products) {
      const sumWhStock = product.warehouseStocks.reduce((sum, ws) => sum + ws.quantity, 0);

      // If Product.stock != sum(WarehouseStock), we have drift
      if (product.stock !== sumWhStock) {
        console.log(`❌ Drift detected for [${product.sku || 'N/A'}] ${product.name}: Global=${product.stock}, WHSum=${sumWhStock}`);

        // If no warehouse stock exists but global stock > 0, provision it to default warehouse
        if (product.warehouseStocks.length === 0 && product.stock > 0) {
            console.log(`🔧 Provisioning ${product.stock} units to default warehouse...`);
            await prisma.warehouseStock.create({
                data: {
                    productId: product.id,
                    warehouseId: defaultWh.id,
                    shopId: shop.id,
                    quantity: product.stock
                }
            });
        } else {
            // Update global stock to match warehouse (SSOT)
            console.log(`🔧 Updating global stock to match WH SSOT: ${sumWhStock}`);
            await prisma.product.update({
                where: { id: product.id },
                data: { stock: sumWhStock }
            });
        }
      } else {
        // console.log(`✅ [${product.sku || 'N/A'}] ${product.name} is in sync.`);
      }
    }
  }

  console.log('\n✅ Reconciliation Complete!');
}

reconcile()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
