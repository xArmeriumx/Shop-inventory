import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Stock-to-Warehouse Migration...');

    // 1. Get all shops
    const shops = await prisma.shop.findMany();

    for (const shop of shops) {
        console.log(`Processing shop: ${shop.name} (${shop.id})`);

        // 2. Find or create default warehouse for this shop
        let defaultWarehouse = await prisma.warehouse.findFirst({
            where: { shopId: shop.id, isDefault: true }
        });

        if (!defaultWarehouse) {
            console.log(`  - Creating default warehouse for shop ${shop.name}...`);
            defaultWarehouse = await prisma.warehouse.create({
                data: {
                    name: 'คลังสินค้าหลัก',
                    code: 'MAIN',
                    isDefault: true,
                    shopId: shop.id
                }
            });
        }

        // 3. Find all products with stock but no warehouse stock records
        const products = await prisma.product.findMany({
            where: {
                shopId: shop.id,
                stock: { gt: 0 },
                warehouseStocks: { none: {} }
            }
        });

        console.log(`  - Found ${products.length} products to migrate.`);

        for (const product of products) {
            console.log(`    - Migrating ${product.name}: ${product.stock} units`);

            await prisma.warehouseStock.create({
                data: {
                    productId: product.id,
                    warehouseId: defaultWarehouse.id,
                    shopId: shop.id,
                    quantity: product.stock
                }
            });
        }
    }

    console.log('✅ Migration completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
