import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingLookups() {
  console.log('--- Starting Lookup Data Recovery ---');

  const shops = await prisma.shop.findMany({
    select: { id: true, userId: true, name: true }
  });

  const [paymentMethodType, unitType] = await Promise.all([
    prisma.lookupType.findUnique({ where: { code: 'PAYMENT_METHOD' } }),
    prisma.lookupType.findUnique({ where: { code: 'UNIT' } }),
  ]);

  if (!paymentMethodType || !unitType) {
    console.error('Error: Lookup types PAYMENT_METHOD or UNIT not found in DB. Run seed-lookups.ts first.');
    return;
  }

  for (const shop of shops) {
    console.log(`Processing Shop: ${shop.name} (${shop.id})`);

    // 1. Payment Methods
    const existingPM = await prisma.lookupValue.count({
      where: { shopId: shop.id, lookupTypeId: paymentMethodType.id }
    });

    if (existingPM === 0) {
      console.log(`  - Seeding Payment Methods...`);
      await prisma.lookupValue.createMany({
        data: [
          { name: 'เงินสด', code: 'cash', color: '#10b981', isDefault: true, shopId: shop.id, userId: shop.userId, lookupTypeId: paymentMethodType.id, order: 1 },
          { name: 'เงินโอน (PromptPay)', code: 'transfer', color: '#3b82f6', shopId: shop.id, userId: shop.userId, lookupTypeId: paymentMethodType.id, order: 2 },
          { name: 'บัตรเครดิต', code: 'credit_card', color: '#8b5cf6', shopId: shop.id, userId: shop.userId, lookupTypeId: paymentMethodType.id, order: 3 },
        ]
      });
    }

    // 2. Units
    const existingUnit = await prisma.lookupValue.count({
      where: { shopId: shop.id, lookupTypeId: unitType.id }
    });

    if (existingUnit === 0) {
      console.log(`  - Seeding Units...`);
      await prisma.lookupValue.createMany({
        data: [
          { name: 'ชิ้น', code: 'pcs', isDefault: true, shopId: shop.id, userId: shop.userId, lookupTypeId: unitType.id, order: 1 },
          { name: 'กล่อง', code: 'box', shopId: shop.id, userId: shop.userId, lookupTypeId: unitType.id, order: 2 },
          { name: 'ชุด', code: 'set', shopId: shop.id, userId: shop.userId, lookupTypeId: unitType.id, order: 3 },
          { name: 'กิโลกรัม', code: 'kg', shopId: shop.id, userId: shop.userId, lookupTypeId: unitType.id, order: 4 },
        ]
      });
    }
  }

  console.log('--- Data Recovery Complete ---');
}

fixMissingLookups()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
