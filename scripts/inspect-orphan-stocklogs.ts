import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const logs = await p.stockLog.findMany({
    where: { type: 'SALE', saleId: null },
    select: {
      id: true, productId: true, quantity: true, balance: true,
      note: true, date: true, referenceId: true, referenceType: true,
      product: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`\nFound ${logs.length} SALE StockLogs without saleId:\n`);
  for (const log of logs) {
    console.log(`  ID: ${log.id}`);
    console.log(`  Product: ${log.product.name}`);
    console.log(`  Qty: ${log.quantity} | Balance: ${log.balance}`);
    console.log(`  Note: ${log.note}`);
    console.log(`  Date: ${log.date.toISOString()}`);
    console.log(`  referenceId: ${log.referenceId}`);
    console.log(`  referenceType: ${log.referenceType}`);
    console.log('');
  }

  await p.$disconnect();
}
main();
