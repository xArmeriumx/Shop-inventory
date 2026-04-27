import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting WarehouseStock backfill...');

    const shops = await prisma.shop.findMany({ select: { id: true, name: true } });

    let totalCreated = 0;

    for (const shop of shops) {
        const defaultWarehouse = await prisma.warehouse.findFirst({
            where: { shopId: shop.id, isDefault: true },
            select: { id: true }
        });

        if (!defaultWarehouse) {
            console.warn(`⚠️ Shop "${shop.name}" has no default warehouse. skipping.`);
            continue;
        }

        // Find products that have stock > 0 but NO warehouse stock record
        const orphanedProducts = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                stock: { gt: 0 },
                warehouseStocks: { none: {} }
            },
            select: { id: true, name: true, stock: true }
        });

        if (orphanedProducts.length > 0) {
            console.log(`📦 Shop "${shop.name}": Found ${orphanedProducts.length} items to sync.`);

            for (const p of orphanedProducts) {
                await prisma.warehouseStock.create({
                    data: {
                        productId: p.id,
                        warehouseId: defaultWarehouse.id,
                        shopId: shop.id,
                        quantity: p.stock,
                    }
                });
                totalCreated++;
            }
            console.log(`✅ Created ${orphanedProducts.length} stock links for "${shop.name}".`);
        }
    }

    console.log(`\n🎉 Backfill complete! Total WarehouseStock records created: ${totalCreated}`);
}

main()
    .catch(e => { console.error('❌ Error:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
