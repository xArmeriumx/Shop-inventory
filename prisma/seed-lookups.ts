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

  // Get payment method type
  const paymentMethodType = await prisma.lookupType.findUnique({
    where: { code: 'PAYMENT_METHOD' },
  });

  if (paymentMethodType) {
    // Create system payment methods (global - no userId)
    const paymentMethods = [
      { code: 'CASH', name: 'เงินสด', color: '#22c55e', order: 1 },
      { code: 'TRANSFER', name: 'เงินโอน/QR', color: '#3b82f6', order: 2 },
    ];

    for (const method of paymentMethods) {
      await prisma.lookupValue.upsert({
        where: {
          lookupTypeId_userId_code: {
            lookupTypeId: paymentMethodType.id,
            userId: null as any, // Global
            code: method.code,
          },
        },
        update: { name: method.name, color: method.color },
        create: {
          lookupTypeId: paymentMethodType.id,
          userId: null,
          code: method.code,
          name: method.name,
          color: method.color,
          order: method.order,
          isSystem: true,
        },
      });
    }

    console.log('Payment methods seeded!');
  }

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
