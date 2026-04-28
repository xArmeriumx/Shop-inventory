import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log(`\n🔍 Product Status Audit for ฿500k shop...`);

    const products = await prisma.product.findMany({
        where: { shopId: "cmofwcroa0003jx047hlx2py2" },
        select: { id: true, name: true, isActive: true, stock: true }
    });

    products.forEach(p => {
        console.log(`- Product: "${p.name}" (${p.id}) | isActive: ${p.isActive} | stock: ${p.stock}`);
    });
}

main().finally(() => prisma.$disconnect());
