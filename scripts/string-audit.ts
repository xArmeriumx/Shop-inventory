import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shopId = "cmofwcroa0003jx047hlx2py2";
    console.log(`\n🔍 STRING INTEGRITY AUDIT: Shop ${shopId}`);

    const whs = await prisma.warehouse.findMany({
        where: { shopId },
        select: { id: true, name: true }
    });

    whs.forEach(wh => {
        console.log(`- WH: "${wh.name}" | ID: "${wh.id}" | Len: ${wh.id.length}`);
    });

    const stocks = await prisma.warehouseStock.findMany({
        where: { shopId, quantity: { gt: 0 } },
        select: { warehouseId: true, id: true, quantity: true }
    });

    stocks.forEach(s => {
        console.log(`- Stock Item WH ID: "${s.warehouseId}" | Len: ${s.warehouseId.length} | Qty: ${s.quantity}`);
    });
}

main().finally(() => prisma.$disconnect());
