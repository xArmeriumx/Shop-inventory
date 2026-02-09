/**
 * Fix isLowStock flag for all products where it's out of sync.
 * Usage: npx tsx scripts/fix-lowstock-flag.ts
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true, minStock: true, isLowStock: true },
  });

  let fixed = 0;
  for (const p of products) {
    const shouldBe = p.stock <= p.minStock;
    if (p.isLowStock !== shouldBe) {
      await db.product.update({ where: { id: p.id }, data: { isLowStock: shouldBe } });
      console.log(`✅ ${p.name}: isLowStock ${p.isLowStock} → ${shouldBe} (stock=${p.stock}, min=${p.minStock})`);
      fixed++;
    }
  }

  console.log(fixed === 0 ? '\n✅ ไม่มีอะไรต้องแก้' : `\n✅ แก้แล้ว ${fixed} รายการ`);
  await db.$disconnect();
}

main().catch(console.error);
