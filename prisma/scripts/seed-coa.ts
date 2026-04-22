import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const accounts = [
    // 1000 - ASSETS (สินทรัพย์)
    { code: '1000-00', name: 'สินทรัพย์', category: 'ASSET', normalBalance: 'DEBIT', isPostable: false },
    { code: '1101-00', name: 'เงินสด', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1102-00', name: 'เงินฝากธนาคาร', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1201-00', name: 'ลูกหนี้การค้า', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1202-00', name: 'ภาษีซื้อ (Input VAT)', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1203-00', name: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1301-00', name: 'สินค้าคงเหลือ', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },

    // 2000 - LIABILITIES (หนี้สิน)
    { code: '2000-00', name: 'หนี้สิน', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: false },
    { code: '2101-00', name: 'เจ้าหนี้การค้า', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },
    { code: '2201-00', name: 'ภาษีขาย (Output VAT)', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },
    { code: '2202-00', name: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },

    // 3000 - EQUITY (ส่วนของเจ้าของ)
    { code: '3000-00', name: 'ส่วนของเจ้าของ', category: 'EQUITY', normalBalance: 'CREDIT', isPostable: false },
    { code: '3101-00', name: 'กำไรสะสม', category: 'EQUITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '3000-00' },

    // 4000 - REVENUE (รายได้)
    { code: '4000-00', name: 'รายได้', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: false },
    { code: '4101-00', name: 'รายได้จากการขาย', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: true, parentCode: '4000-00' },
    { code: '4102-00', name: 'รายได้บริการ', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: true, parentCode: '4000-00' },

    // 5000 - EXPENSES (ค่าใช้จ่าย)
    { code: '5000-00', name: 'ค่าใช้จ่าย', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: false },
    { code: '5101-00', name: 'ต้นทุนขาย', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
    { code: '5201-00', name: 'ค่าสาธารณูปโภค', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
    { code: '5202-00', name: 'ค่าเช่า', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
    { code: '5203-00', name: 'เงินเดือน', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
];

async function main() {
    const shops = await prisma.shop.findMany();
    console.log(`Found ${shops.length} shops. Initializing CoA...`);

    for (const shop of shops) {
        console.log(`Seeding CoA for shop: ${shop.name} (${shop.id})`);

        // Create accounts one by one to handle hierarchy
        const createdMap = new Map<string, string>(); // code -> id

        for (const acc of accounts) {
            const parentId = acc.parentCode ? createdMap.get(acc.parentCode) : null;

            const created = await prisma.account.upsert({
                where: {
                    shopId_code: {
                        shopId: shop.id,
                        code: acc.code
                    }
                },
                update: {
                    name: acc.name,
                    category: acc.category as any,
                    normalBalance: acc.normalBalance as any,
                    isPostable: acc.isPostable,
                    parentId: parentId
                },
                create: {
                    shopId: shop.id,
                    code: acc.code,
                    name: acc.name,
                    category: acc.category as any,
                    normalBalance: acc.normalBalance as any,
                    isPostable: acc.isPostable,
                    parentId: parentId
                },
            });

            createdMap.set(acc.code, created.id);
        }
    }

    console.log('CoA Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
