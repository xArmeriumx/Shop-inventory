import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  console.log('🚀 Starting Warehouse ID Backfill for SaleItems and ReturnItems...');

  const shops = await prisma.shop.findMany({
    select: { id: true, name: true }
  });

  for (const shop of shops) {
    console.log(`\nProcessing Shop: ${shop.name} (${shop.id})`);

    // 1. Find or create default warehouse for this shop
    let defaultWarehouse = await prisma.warehouse.findFirst({
      where: { shopId: shop.id, isDefault: true }
    });

    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.warehouse.findFirst({
        where: { shopId: shop.id }
      });
    }

    if (!defaultWarehouse) {
      console.log(`⚠️  No warehouse found for shop ${shop.name}. Creating 'Main' warehouse...`);
      defaultWarehouse = await prisma.warehouse.create({
        data: {
          name: 'คลังสินค้าหลัก (Auto)',
          code: 'MAIN',
          isDefault: true,
          shopId: shop.id
        }
      });
    }

    console.log(`📍 Using Default Warehouse: ${defaultWarehouse.name} (${defaultWarehouse.id})`);

    // 2. Backfill SaleItems
    const saleItemResult = await prisma.saleItem.updateMany({
      where: {
        warehouseId: null,
        sale: { shopId: shop.id }
      },
      data: {
        warehouseId: defaultWarehouse.id
      }
    });
    console.log(`✅ Backfilled ${saleItemResult.count} SaleItems`);

    // 3. Backfill ReturnItems
    const returnItemResult = await prisma.returnItem.updateMany({
      where: {
        warehouseId: null,
        return: { shopId: shop.id }
      },
      data: {
        warehouseId: defaultWarehouse.id
      }
    });
    console.log(`✅ Backfilled ${returnItemResult.count} ReturnItems`);
  }

  console.log('\n✨ Backfill complete!');
}

backfill()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
