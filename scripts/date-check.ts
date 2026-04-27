import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst({ where: { name: "อาร์ม ณภัทร (Armerium)" } });
    if (!shop) return;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    console.log(`\n📅 Date check for April 2026: ${firstDayOfMonth.toLocaleDateString()} - ${firstDayOfNextMonth.toLocaleDateString()}`);

    const monthlySales = await prisma.sale.count({
        where: {
            shopId: shop.id,
            date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
            status: { not: 'CANCELLED' }
        }
    });
    console.log(`  Monthly Sales count: ${monthlySales}`);

    const sampleRecent = await prisma.sale.findMany({
        where: { shopId: shop.id },
        select: { date: true, invoiceNumber: true },
        orderBy: { date: 'desc' },
        take: 5
    });
    console.log(`\n  Sample Recent Sales:`);
    sampleRecent.forEach(s => console.log(`    - ${s.invoiceNumber}: ${s.date.toISOString()}`));
}

main().finally(() => prisma.$disconnect());
