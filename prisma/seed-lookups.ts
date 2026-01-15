import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding LookupTypes...');

  // Create LookupTypes
  const lookupTypes = [
    {
      code: 'PRODUCT_CATEGORY' as const,
      name: 'หมวดหมู่สินค้า',
      description: 'หมวดหมู่สำหรับจัดกลุ่มสินค้า',
      isSystem: false,
    },
    {
      code: 'EXPENSE_CATEGORY' as const,
      name: 'หมวดหมู่ค่าใช้จ่าย',
      description: 'หมวดหมู่สำหรับจัดกลุ่มค่าใช้จ่าย',
      isSystem: false,
    },
    {
      code: 'PAYMENT_METHOD' as const,
      name: 'วิธีชำระเงิน',
      description: 'วิธีการชำระเงินที่รองรับ',
      isSystem: true,
    },
    {
      code: 'UNIT' as const,
      name: 'หน่วยสินค้า',
      description: 'หน่วยนับสินค้า',
      isSystem: false,
    },
  ];

  for (const type of lookupTypes) {
    await prisma.lookupType.upsert({
      where: { code: type.code },
      update: { name: type.name, description: type.description },
      create: type,
    });
  }

  console.log('LookupTypes seeded!');
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
