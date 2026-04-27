import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst({ where: { name: "อาร์ม ณภัทร (Armerium)" } });
    if (!shop) return;

    const salesWithNoItems = await prisma.sale.count({
        where: {
            shopId: shop.id,
            items: { none: {} }
        }
    });
    console.log(`\n🚫 Sales with NO items for Armerium: ${salesWithNoItems}`);

    if (salesWithNoItems > 0) {
        const list = await prisma.sale.findMany({
            where: { shopId: shop.id, items: { none: {} } },
            select: { id: true, invoiceNumber: true, netAmount: true, date: true },
            take: 5
        });
        list.forEach(s => console.log(`  - ${s.invoiceNumber}: ${s.netAmount} (${s.date.toISOString()})`));
    }
}

main().finally(() => prisma.$disconnect());
