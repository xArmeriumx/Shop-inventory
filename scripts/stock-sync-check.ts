import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shops = await prisma.shop.findMany({ select: { id: true, name: true } });

    for (const shop of shops) {
        console.log(`\n━━━ Shop: "${shop.name}" ━━━`);

        // Find products with stock > 0
        const productsWithStock = await prisma.product.findMany({
            where: { shopId: shop.id, stock: { gt: 0 } },
            select: { id: true, name: true, stock: true }
        });

        let orphanedStock = 0;
        for (const p of productsWithStock) {
            const whStockSum = await prisma.warehouseStock.aggregate({
                where: { productId: p.id },
                _sum: { quantity: true }
            });

            const sum = whStockSum._sum?.quantity || 0;
            if (sum !== p.stock) {
                orphanedStock++;
                if (orphanedStock < 5) {
                    console.log(`  Mismatch: Product "${p.name}" | Product.stock=${p.stock} vs Sum(WH)=${sum}`);
                }
            }
        }

        console.log(`  Total Products with Stock: ${productsWithStock.length}`);
        console.log(`  Products with out-of-sync stock: ${orphanedStock}`);
    }
}

main().finally(() => prisma.$disconnect());
