import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Income Categories...');

  // Get INCOME_CATEGORY lookup type
  const incomeCategoryType = await prisma.lookupType.findUnique({
    where: { code: 'INCOME_CATEGORY' },
  });

  if (!incomeCategoryType) {
    console.error('INCOME_CATEGORY lookup type not found! Run seed-lookups.ts first.');
    return;
  }

  // Get all shops
  const shops = await prisma.shop.findMany({
    include: { user: true },
  });

  // Default income categories
  const incomeCategories = [
    { name: 'ค่าบริการ/ค่าซ่อม', code: 'service', color: '#22c55e' },
    { name: 'ค่าติดตั้ง/ค่าแรง', code: 'installation', color: '#10b981' },
    { name: 'ค่าเช่า', code: 'rental', color: '#3b82f6' },
    { name: 'ค่าคอมมิชชั่น', code: 'commission', color: '#8b5cf6' },
    { name: 'ค่าจัดส่ง', code: 'delivery', color: '#f59e0b' },
    { name: 'อื่นๆ', code: 'other_income', color: '#6b7280' },
  ];

  for (const shop of shops) {
    console.log(`Seeding income categories for shop: ${shop.name}`);

    // Check if already seeded
    const existingCount = await prisma.lookupValue.count({
      where: {
        lookupTypeId: incomeCategoryType.id,
        shopId: shop.id,
      },
    });

    if (existingCount > 0) {
      console.log(`  - Already has ${existingCount} income categories, skipping.`);
      continue;
    }

    // Create income categories for this shop
    await prisma.lookupValue.createMany({
      data: incomeCategories.map((cat, i) => ({
        lookupTypeId: incomeCategoryType.id,
        shopId: shop.id,
        userId: shop.userId,
        ...cat,
        order: i + 1,
      })),
    });

    console.log(`  - Created ${incomeCategories.length} income categories.`);
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
