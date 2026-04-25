import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Data Migration: Setting salesFlowMode based on invoiceNumber prefix...');

  // 1. Migrate ERP Sales (SO-)
  const erpResult = await prisma.sale.updateMany({
    where: {
      invoiceNumber: { startsWith: 'SO-' }
    },
    data: {
      salesFlowMode: 'ERP'
    }
  });
  console.log(`✅ Updated ${erpResult.count} records to ERP Mode (SO-)`);

  // 2. Migrate Retail Sales (INV-)
  const retailResult = await prisma.sale.updateMany({
    where: {
      invoiceNumber: { startsWith: 'INV-' }
    },
    data: {
      salesFlowMode: 'RETAIL'
    }
  });
  console.log(`✅ Updated ${retailResult.count} records to RETAIL Mode (INV-)`);

  console.log('🏁 Migration Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
