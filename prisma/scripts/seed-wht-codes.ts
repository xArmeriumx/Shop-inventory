import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const shop = await prisma.shop.findFirst();
    if (!shop) {
        console.error('No shop found. Please run migrations/seed first.');
        return;
    }

    const shopId = shop.id;

    const whtCodes = [
        {
            code: 'WH_1',
            name: 'ค่าขนส่ง (1%)',
            rate: 1,
            formType: 'PND53',
            payeeType: 'CORPORATE',
            incomeCategory: 'ค่าขนส่ง',
        },
        {
            code: 'WH_2',
            name: 'ค่าโฆษณา (2%)',
            rate: 2,
            formType: 'PND53',
            payeeType: 'CORPORATE',
            incomeCategory: 'ค่าโฆษณา',
        },
        {
            code: 'WH_3',
            name: 'ค่าบริการ/จ้างทำของ (3%)',
            rate: 3,
            formType: 'PND53',
            payeeType: 'CORPORATE',
            incomeCategory: 'ค่าบริการ',
        },
        {
            code: 'WH_5',
            name: 'ค่าเช่า (5%)',
            rate: 5,
            formType: 'PND53',
            payeeType: 'CORPORATE',
            incomeCategory: 'ค่าเช่า',
        },
        // Same for PND3 (Individuals)
        {
            code: 'WH_3_IND',
            name: 'ค่าบริการ/จ้างทำของ (3%) - บุคคล',
            rate: 3,
            formType: 'PND3',
            payeeType: 'INDIVIDUAL',
            incomeCategory: 'ค่าบริการ',
        },
        {
            code: 'WH_5_IND',
            name: 'ค่าเช่า (5%) - บุคคล',
            rate: 5,
            formType: 'PND3',
            payeeType: 'INDIVIDUAL',
            incomeCategory: 'ค่าเช่า',
        },
    ];

    console.log(`Seeding WHT Codes for shop: ${shopId}...`);

    for (const wht of whtCodes) {
        await (prisma as any).whtCode.upsert({
            where: {
                shopId_code: {
                    shopId,
                    code: wht.code,
                },
            },
            update: {
                name: wht.name,
                rate: wht.rate,
                formType: wht.formType,
                payeeType: wht.payeeType,
                incomeCategory: wht.incomeCategory,
            },
            create: {
                shopId,
                ...wht,
            },
        });
    }

    console.log('Seeding WHT Codes complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
