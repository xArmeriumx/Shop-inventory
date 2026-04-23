import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // 1. Get the demo shop
    const shop = await prisma.shop.findFirst({
        where: { name: { contains: 'Namfon' } }
    });
    if (!shop) throw new Error('Shop not found');

    const user = await prisma.user.findFirst({ where: { email: 'demo@namfon.com' } });
    if (!user) throw new Error('User not found');

    const member = await prisma.shopMember.findFirst({
        where: { shopId: shop.id, userId: user.id }
    });

    // 2. Find Cash/Bank accounts in CoA
    const bankGL = await prisma.account.findFirst({
        where: { shopId: shop.id, code: '1101-01' } // Assuming this is K-Bank in our seed
    });

    if (!bankGL) {
        console.log('Bank GL Account not found, skipping bank account creation');
        return;
    }

    // 3. Create a Bank Account if not exists
    const bankAccount = await prisma.bankAccount.upsert({
        where: { shopId_accountNo: { shopId: shop.id, accountNo: '123-4-56789-0' } },
        update: {},
        create: {
            shopId: shop.id,
            userId: user.id,
            name: 'K-Bank Savings',
            bankName: 'KASIKORNBANK',
            accountNo: '123-4-56789-0',
            glAccountId: bankGL.id,
            currency: 'THB'
        }
    });

    console.log('Bank Account verified:', bankAccount.name);

    // 4. Update existing JournalLines to be UNRECONCILED explicitly if needed
    // (They defaults to UNRECONCILED in schema but good to verify)
    const updated = await prisma.journalLine.updateMany({
        where: { accountId: bankGL.id },
        data: { reconcileStatus: 'UNRECONCILED' }
    });
    console.log(`Updated ${updated.count} ledger lines to UNRECONCILED`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
