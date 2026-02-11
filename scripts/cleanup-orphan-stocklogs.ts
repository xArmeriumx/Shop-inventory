import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const result = await p.stockLog.deleteMany({
    where: { type: 'SALE', saleId: null, referenceId: { not: null } },
  });
  console.log(`\nDeleted ${result.count} orphan SALE StockLogs\n`);
  await p.$disconnect();
}
main();
