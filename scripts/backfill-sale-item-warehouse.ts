import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting SaleItem warehouseId backfill...');

    // 1. Get all shops
    const shops = await prisma.shop.findMany({
        select: { id: true, name: true }
    });

    console.log(`🔍 Found ${shops.length} shops.`);

    let totalUpdated = 0;

    for (const shop of shops) {
        // 2. Find default warehouse for this shop
        const defaultWarehouse = await prisma.warehouse.findFirst({
            where: { shopId: shop.id, isDefault: true },
            select: { id: true, name: true }
        });

        if (!defaultWarehouse) {
            // Fallback: any active warehouse if no default is set
            const anyWarehouse = await prisma.warehouse.findFirst({
                where: { shopId: shop.id, isActive: true },
                select: { id: true }
            });

            if (!anyWarehouse) {
                console.warn(`⚠️ Shop "${shop.name}" (${shop.id}) has NO active warehouses. Skipping.`);
                continue;
            }

            console.log(`ℹ️ Shop "${shop.name}" has no default. Using first active warehouse: ${anyWarehouse.id}`);

            const result = await prisma.saleItem.updateMany({
                where: {
                    warehouseId: null,
                    sale: { shopId: shop.id }
                },
                data: { warehouseId: anyWarehouse.id }
            });

            totalUpdated += result.count;
            console.log(`✅ Updated ${result.count} items for shop "${shop.name}".`);
        } else {
            console.log(`📦 Shop "${shop.name}" using default warehouse: "${defaultWarehouse.name}" (${defaultWarehouse.id})`);

            const result = await prisma.saleItem.updateMany({
                where: {
                    warehouseId: null,
                    sale: { shopId: shop.id }
                },
                data: { warehouseId: defaultWarehouse.id }
            });

            totalUpdated += result.count;
            console.log(`✅ Updated ${result.count} items for shop "${shop.name}".`);
        }
    }

    console.log(`\n🎉 Backfill complete! Total SaleItems updated: ${totalUpdated}`);
}

main()
    .catch((e) => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
