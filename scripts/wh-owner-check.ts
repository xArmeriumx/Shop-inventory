import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log(`\n🔍 Warehouse Ownership Audit...`);

    const wh = await prisma.warehouse.findUnique({
        where: { id: "cmogsl78p000jpk38utnsq8dr" },
        select: { id: true, name: true, shopId: true }
    });

    if (wh) {
        console.log(`- Warehouse: "${wh.name}" (${wh.id}) | Owned by Shop: ${wh.shopId}`);
    } else {
        console.log(`- Warehouse NOT FOUND`);
    }

    const shop = await prisma.shop.findUnique({
        where: { id: "cmogsl78p000jpk38utnsq8dr" }
    });
    if (shop) {
        console.log(`- Shop: "${shop.name}" (${shop.id}) EXISTS`);
    }
}

main().finally(() => prisma.$disconnect());
