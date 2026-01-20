import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Syncing Low Stock Status...');

  try {
    // ใช้ Raw SQL สั่ง update ทีเดียวทั้งตาราง (เร็วและชัวร์ที่สุด)
    const count = await prisma.$executeRaw`
      UPDATE "Product"
      SET "isLowStock" = ("stock" <= "minStock")
      WHERE "deletedAt" IS NULL
    `;

    console.log(`✅ Completed! Updated/Checked ${count} products.`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
