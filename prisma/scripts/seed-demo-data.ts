import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const accounts = [
    { code: '1000-00', name: 'สินทรัพย์', category: 'ASSET', normalBalance: 'DEBIT', isPostable: false },
    { code: '1101-00', name: 'เงินสด', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1102-00', name: 'เงินฝากธนาคาร', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1201-00', name: 'ลูกหนี้การค้า', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1301-00', name: 'สินค้าคงเหลือ', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '2000-00', name: 'หนี้สิน', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: false },
    { code: '2101-00', name: 'เจ้าหนี้การค้า', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },
    { code: '3000-00', name: 'ส่วนของเจ้าของ', category: 'EQUITY', normalBalance: 'CREDIT', isPostable: false },
    { code: '3101-00', name: 'กำไรสะสม', category: 'EQUITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '3000-00' },
    { code: '4000-00', name: 'รายได้', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: false },
    { code: '4101-00', name: 'รายได้จากการขาย', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: true, parentCode: '4000-00' },
    { code: '5000-00', name: 'ค่าใช้จ่าย', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: false },
    { code: '5101-00', name: 'ต้นทุนขาย', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
];

async function main() {
    console.log('--- Starting Demo Data Seeding ---');

    const DEMO_SHOP_ID = 'demo-shop-id';
    const DEMO_USER_ID = 'demo-user-id';

    // 1. User First
    const passwordHash = await bcrypt.hash('password123', 12);
    const user = await prisma.user.upsert({
        where: { email: 'demo@namfon.com' },
        update: { password: passwordHash },
        create: {
            id: DEMO_USER_ID,
            email: 'demo@namfon.com',
            name: 'Demo Admin',
            password: passwordHash
        }
    });

    // 2. Create Demo Shop linked to User
    const shop = await prisma.shop.upsert({
        where: { id: DEMO_SHOP_ID },
        update: {},
        create: {
            id: DEMO_SHOP_ID,
            name: 'Namfon ERP Demo Shop',
            address: '123 ERP Street, Bangkok',
            phone: '02-123-4567',
            userId: user.id
        }
    });

    // 3. Ensure Admin Role exists
    const role = await prisma.role.upsert({
        where: { id: 'admin-role-id' },
        update: {},
        create: {
            id: 'admin-role-id',
            shopId: shop.id,
            name: 'ADMIN SYSTEM',
            description: 'Full Access Admin'
        }
    });

    // 4. Create Shop Member (Owner)
    const member = await prisma.shopMember.upsert({
        where: { id: 'demo-member-id' },
        update: { roleId: role.id },
        create: {
            id: 'demo-member-id',
            shopId: shop.id,
            userId: user.id,
            roleId: role.id,
            isOwner: true
        }
    });

    // 5. CLEANUP EXISTING DATA FOR THIS SHOP (To ensure fresh run)
    console.log('Cleaning up existing demo data...');
    await prisma.journalLine.deleteMany({ where: { journalEntry: { shopId: shop.id } } });
    await prisma.journalEntry.deleteMany({ where: { shopId: shop.id } });
    await prisma.invoice.deleteMany({ where: { shopId: shop.id } });
    await prisma.sale.deleteMany({ where: { shopId: shop.id } });
    await prisma.purchase.deleteMany({ where: { shopId: shop.id } });
    await prisma.customer.deleteMany({ where: { shopId: shop.id } });
    await prisma.supplier.deleteMany({ where: { shopId: shop.id } });

    // 6. Seed CoA
    const createdMap = new Map<string, string>();
    for (const acc of accounts) {
        const parentId = acc.parentCode ? createdMap.get(acc.parentCode) : null;
        const created = await prisma.account.upsert({
            where: { shopId_code: { shopId: shop.id, code: acc.code } },
            update: { isPostable: acc.isPostable },
            create: {
                shopId: shop.id,
                code: acc.code,
                name: acc.name,
                category: acc.category as any,
                normalBalance: acc.normalBalance as any,
                isPostable: acc.isPostable,
                parentId: parentId
            }
        });
        createdMap.set(acc.code, created.id);
    }

    // 7. Partners
    const customerA = await prisma.customer.create({
        data: { name: 'Somsak Logistics (Demo AR)', shopId: shop.id, userId: user.id, creditTerm: 30 }
    });
    const customerB = await prisma.customer.create({
        data: { name: 'Manee Trading (Partial Demo)', shopId: shop.id, userId: user.id, creditTerm: 30 }
    });
    const supplierX = await prisma.supplier.create({
        data: { name: 'Tech Parts Supplier (Demo AP)', shopId: shop.id, userId: user.id, creditTerm: 30 }
    });

    // 8. AR Transactions
    const now = new Date();
    const date95 = new Date(now.getTime() - (95 * 24 * 60 * 60 * 1000));

    // Case 1
    const saleA = await prisma.sale.create({
        data: {
            shopId: shop.id,
            userId: user.id,
            totalAmount: 100000,
            status: 'CONFIRMED' as any,
            customerName: customerA.name,
            customerId: customerA.id,
            invoiceNumber: 'INV-DEMO-95D',
            paymentMethod: 'CREDIT',
            totalCost: 60000,
            profit: 40000
        }
    });

    const invA = await prisma.invoice.create({
        data: {
            shopId: shop.id,
            customerId: customerA.id,
            saleId: saleA.id,
            invoiceNo: 'INV-DEMO-95D',
            date: date95,
            dueDate: new Date(date95.getTime() + (30 * 24 * 60 * 60 * 1000)),
            status: 'POSTED' as any,
            subtotalAmount: 100000,
            totalAmount: 100000,
            customerNameSnapshot: customerA.name,
            billingAddressSnapshot: 'Demo Address A',
            paymentStatus: 'UNPAID',
            residualAmount: 100000
        } as any
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-AR-001',
            journalDate: date95,
            description: `ขายสินค้าเชื่อ - ${customerA.name}`,
            status: 'POSTED' as any,
            sourceType: 'SALE_INVOICE',
            sourceId: invA.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1201-00')!, debitAmount: 100000, creditAmount: 0, description: 'ลูกหนี้การค้า' },
                    { accountId: createdMap.get('4101-00')!, debitAmount: 0, creditAmount: 100000, description: 'รายได้จากการขาย' }
                ]
            }
        }
    });

    // Case 2
    const date45 = new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000));
    const saleB = await prisma.sale.create({
        data: {
            shopId: shop.id,
            userId: user.id,
            totalAmount: 50000,
            status: 'CONFIRMED' as any,
            customerName: customerB.name,
            customerId: customerB.id,
            invoiceNumber: 'INV-DEMO-45D',
            paymentMethod: 'CREDIT',
            totalCost: 30000,
            profit: 20000
        }
    });

    const invB = await prisma.invoice.create({
        data: {
            shopId: shop.id,
            customerId: customerB.id,
            saleId: saleB.id,
            invoiceNo: 'INV-DEMO-45D',
            date: date45,
            dueDate: new Date(date45.getTime() + (30 * 24 * 60 * 60 * 1000)),
            status: 'POSTED' as any,
            subtotalAmount: 50000,
            totalAmount: 50000,
            customerNameSnapshot: customerB.name,
            billingAddressSnapshot: 'Demo Address B',
            paymentStatus: 'PARTIAL',
            paidAmount: 20000,
            residualAmount: 30000
        } as any
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-AR-002',
            journalDate: date45,
            description: `ขายสินค้าเชื่อ - ${customerB.name}`,
            status: 'POSTED' as any,
            sourceType: 'SALE_INVOICE',
            sourceId: invB.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1201-00')!, debitAmount: 50000, creditAmount: 0, description: 'ลูกหนี้การค้า' },
                    { accountId: createdMap.get('4101-00')!, debitAmount: 0, creditAmount: 50000, description: 'รายได้จากการขาย' }
                ]
            }
        }
    });

    const date30 = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-PY-001',
            journalDate: date30,
            description: `รับชำระเงิน - ${customerB.name}`,
            status: 'POSTED' as any,
            sourceType: 'PAYMENT_RECEIPT',
            sourceId: invB.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1102-00')!, debitAmount: 20000, creditAmount: 0, description: 'เงินฝากธนาคาร' },
                    { accountId: createdMap.get('1201-00')!, debitAmount: 0, creditAmount: 20000, description: 'ล้างลูกหนี้การค้า' }
                ]
            }
        }
    });

    // 9. AP Scenario
    const date65 = new Date(now.getTime() - (65 * 24 * 60 * 60 * 1000));
    const purX = await prisma.purchase.create({
        data: {
            shopId: shop.id,
            supplierId: supplierX.id,
            purchaseNumber: 'PUR-DEMO-65D',
            date: date65,
            status: 'RECEIVED' as any,
            totalCost: 150000,
            userId: user.id,
            memberId: member.id,
            residualAmount: 150000,
            paymentStatus: 'UNPAID'
        }
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-AP-001',
            journalDate: date65,
            description: `ซื้อสินค้าเชื่อ - ${supplierX.name}`,
            status: 'POSTED' as any,
            sourceType: 'PURCHASE_TAX',
            sourceId: purX.id,
            lines: {
                create: [
                    { accountId: createdMap.get('5101-00')!, debitAmount: 150000, creditAmount: 0, description: 'ต้นทุนสินค้า' },
                    { accountId: createdMap.get('2101-00')!, debitAmount: 0, creditAmount: 150000, description: 'เจ้าหนี้การค้า' }
                ]
            }
        }
    });

    console.log('--- Demo Data Seeding Completed ---');
    console.log('Login: demo@namfon.com / password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
