
import { db } from './src/lib/db';

async function main() {
  const email = 'test1@test.com'; // Use one of the users from the migration log
  console.log(`Checking membership for email: ${email}`);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('User found:', user.id);

  const membership = await db.shopMember.findFirst({
    where: { userId: user.id },
    include: {
      role: {
        select: {
          id: true,
          permissions: true,
        },
      },
      shop: {
        select: { id: true, name: true },
      },
    },
  });

  if (membership) {
    console.log('✅ Membership found:', {
      shopId: membership.shop.id,
      shopName: membership.shop.name,
      roleId: membership.role.id,
      isOwner: membership.isOwner,
    });
  } else {
    console.log('❌ No membership found for user:', user.id);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
