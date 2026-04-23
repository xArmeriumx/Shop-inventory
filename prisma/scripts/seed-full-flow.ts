import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const accounts = [
    // ASSETS
    { code: '1000-00', name: 'สินทรัพย์', category: 'ASSET', normalBalance: 'DEBIT', isPostable: false },
    { code: '1101-00', name: 'เงินสด', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1102-00', name: 'เงินฝากธนาคาร', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1201-00', name: 'ลูกหนี้การค้า', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1202-00', name: 'ภาษีซื้อ (Input VAT)', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1203-00', name: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },
    { code: '1301-00', name: 'สินค้าคงเหลือ', category: 'ASSET', normalBalance: 'DEBIT', isPostable: true, parentCode: '1000-00' },

    // LIABILITIES
    { code: '2000-00', name: 'หนี้สิน', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: false },
    { code: '2101-00', name: 'เจ้าหนี้การค้า', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },
    { code: '2201-00', name: 'ภาษีขาย (Output VAT)', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },
    { code: '2202-00', name: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', category: 'LIABILITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '2000-00' },

    // EQUITY
    { code: '3000-00', name: 'ส่วนของเจ้าของ', category: 'EQUITY', normalBalance: 'CREDIT', isPostable: false },
    { code: '3101-00', name: 'กำไรสะสม', category: 'EQUITY', normalBalance: 'CREDIT', isPostable: true, parentCode: '3000-00' },

    // REVENUE
    { code: '4000-00', name: 'รายได้', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: false },
    { code: '4101-00', name: 'รายได้จากการขาย', category: 'REVENUE', normalBalance: 'CREDIT', isPostable: true, parentCode: '4000-00' },

    // EXPENSES
    { code: '5000-00', name: 'ค่าใช้จ่าย', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: false },
    { code: '5101-00', name: 'ต้นทุนขาย', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
    { code: '5201-00', name: 'ค่าสาธารณูปโภค', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
    { code: '5202-00', name: 'ค่าเช่า', category: 'EXPENSE', normalBalance: 'DEBIT', isPostable: true, parentCode: '5000-00' },
];

async function main() {
    console.log('--- Starting FULL-FLOW Demo Data Seeding ---');

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

    const shop = await prisma.shop.upsert({
        where: { id: DEMO_SHOP_ID },
        update: { taxId: '0123456789012' },
        create: {
            id: DEMO_SHOP_ID,
            name: 'Namfon ERP Full-Flow Demo',
            address: '456 Business Tower, Sukhumvit, Bangkok',
            phone: '02-999-8888',
            userId: user.id,
            taxId: '0123456789012'
        }
    });

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

    // 2. CLEANUP
    console.log('Purging existing shop data for clean flow...');
    await prisma.stockLog.deleteMany({ where: { shopId: shop.id } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { shopId: shop.id } } });
    await prisma.journalEntry.deleteMany({ where: { shopId: shop.id } });
    await prisma.purchaseItem.deleteMany({ where: { purchase: { shopId: shop.id } } });
    await prisma.purchase.deleteMany({ where: { shopId: shop.id } });
    await prisma.invoice.deleteMany({ where: { shopId: shop.id } });
    await prisma.saleItem.deleteMany({ where: { sale: { shopId: shop.id } } });
    await prisma.sale.deleteMany({ where: { shopId: shop.id } });
    await prisma.expense.deleteMany({ where: { shopId: shop.id } });
    await prisma.product.deleteMany({ where: { shopId: shop.id } });
    await prisma.customer.deleteMany({ where: { shopId: shop.id } });
    await prisma.supplier.deleteMany({ where: { shopId: shop.id } });

    // 3. CoA
    console.log('Initializing CoA...');
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

    // 4. Products
    console.log('Seeding Products...');
    const prodPC = await prisma.product.create({
        data: {
            shopId: shop.id,
            name: 'Gaming PC Ultra RTX 4090',
            sku: 'PC-001',
            category: 'COMPUTER',
            costPrice: 85000,
            salePrice: 120000,
            stock: 10,
            userId: user.id
        }
    });

    const prodMonitor = await prisma.product.create({
        data: {
            shopId: shop.id,
            name: 'Samsung 4K Gaming Monitor',
            sku: 'MON-001',
            category: 'MONITOR',
            costPrice: 12000,
            salePrice: 18500,
            stock: 25,
            userId: user.id
        }
    });

    await prisma.stockLog.createMany({
        data: [
            { shopId: shop.id, userId: user.id, productId: prodPC.id, type: 'ADJUSTMENT' as any, quantity: 10, balance: 10, note: 'Initial Stock' },
            { shopId: shop.id, userId: user.id, productId: prodMonitor.id, type: 'ADJUSTMENT' as any, quantity: 25, balance: 25, note: 'Initial Stock' }
        ]
    });

    // 5. Partners
    const customer = await prisma.customer.create({
        data: { name: 'V.I.P Corporate Client Co., Ltd.', shopId: shop.id, userId: user.id, creditTerm: 30 }
    });
    const supplier = await prisma.supplier.create({
        data: { name: 'Global Tech Components Solution', shopId: shop.id, userId: user.id, creditTerm: 30 }
    });

    // 6. SALES
    console.log('Sales Flow...');
    const now = new Date();
    const sale1 = await prisma.sale.create({
        data: {
            shopId: shop.id,
            userId: user.id,
            customerId: customer.id,
            customerName: customer.name,
            status: 'CONFIRMED' as any,
            totalAmount: 120000,
            totalCost: 85000,
            profit: 35000,
            invoiceNumber: 'INV-FULL-001',
            paymentMethod: 'TRANSFER',
            paymentStatus: 'PAID',
            items: {
                create: [{ productId: prodPC.id, quantity: 1, salePrice: 120000, costPrice: 85000, subtotal: 120000, profit: 35000 }]
            }
        }
    });

    const inv1 = await prisma.invoice.create({
        data: {
            shopId: shop.id,
            customerId: customer.id,
            saleId: sale1.id,
            invoiceNo: 'INV-FULL-001',
            date: now,
            dueDate: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)),
            status: 'POSTED' as any,
            totalAmount: 120000,
            paidAmount: 120000,
            residualAmount: 0,
            paymentStatus: 'PAID',
            customerNameSnapshot: customer.name,
            billingAddressSnapshot: 'BKK, Thailand',
            isTaxInvoice: true,
            taxRateSnapshot: 7,
            taxCodeSnapshot: 'VAT7_OUT'
        } as any
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-SALE-001',
            journalDate: now,
            description: `ขายสินค้า - ${customer.name}`,
            status: 'POSTED' as any,
            sourceType: 'SALE_INVOICE',
            sourceId: inv1.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1102-00')!, debitAmount: 120000, creditAmount: 0, description: 'รับเงินโอน' },
                    { accountId: createdMap.get('4101-00')!, debitAmount: 0, creditAmount: 112149.53, description: 'รายได้จากการขาย' },
                    { accountId: createdMap.get('2201-00')!, debitAmount: 0, creditAmount: 7850.47, description: 'ภาษีขาย (7%)' }
                ]
            }
        }
    });

    const date65 = new Date(now.getTime() - (65 * 24 * 60 * 60 * 1000));
    const sale2 = await prisma.sale.create({
        data: {
            shopId: shop.id,
            userId: user.id,
            customerId: customer.id,
            customerName: customer.name,
            status: 'CONFIRMED' as any,
            totalAmount: 37000,
            totalCost: 24000,
            profit: 13000,
            invoiceNumber: 'INV-AGING-65D',
            paymentMethod: 'CREDIT',
            paymentStatus: 'PARTIAL',
            items: {
                create: [{ productId: prodMonitor.id, quantity: 2, salePrice: 18500, costPrice: 12000, subtotal: 37000, profit: 13000 }]
            }
        }
    });

    const inv2 = await prisma.invoice.create({
        data: {
            shopId: shop.id,
            customerId: customer.id,
            saleId: sale2.id,
            invoiceNo: 'INV-AGING-65D',
            date: date65,
            dueDate: new Date(date65.getTime() + (30 * 24 * 60 * 60 * 1000)),
            status: 'POSTED' as any,
            totalAmount: 37000,
            paidAmount: 5000,
            residualAmount: 32000,
            paymentStatus: 'PARTIAL',
            customerNameSnapshot: customer.name,
            billingAddressSnapshot: 'BKK, Thailand'
        } as any
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-SALE-002',
            journalDate: date65,
            description: `ขายสินค้าเชื่อ - ${customer.name}`,
            status: 'POSTED' as any,
            sourceType: 'SALE_INVOICE',
            sourceId: inv2.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1201-00')!, debitAmount: 37000, creditAmount: 0, description: 'ลูกหนี้การค้า' },
                    { accountId: createdMap.get('4101-00')!, debitAmount: 0, creditAmount: 37000, description: 'รายได้จากการขาย' }
                ]
            }
        }
    });

    const datePaid = new Date(date65.getTime() + (5 * 24 * 60 * 60 * 1000));
    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-PAY-001',
            journalDate: datePaid,
            description: `รับชำระเงินมัดจำ - ${customer.name}`,
            status: 'POSTED' as any,
            sourceType: 'PAYMENT_RECEIPT',
            sourceId: inv2.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1101-00')!, debitAmount: 5000, creditAmount: 0, description: 'เงินสด' },
                    { accountId: createdMap.get('1201-00')!, debitAmount: 0, creditAmount: 5000, description: 'ล้างลูกหนี้' }
                ]
            }
        }
    });

    // 7. PURCHASE
    console.log('Purchase Flow...');
    const datePur = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
    const purchase = await prisma.purchase.create({
        data: {
            shopId: shop.id,
            userId: user.id,
            supplierId: supplier.id,
            purchaseNumber: 'PO-DEMO-001',
            date: datePur,
            status: 'RECEIVED' as any,
            totalCost: 120000,
            paymentStatus: 'UNPAID',
            residualAmount: 120000,
            items: {
                create: [{ productId: prodMonitor.id, quantity: 10, costPrice: 12000, subtotal: 120000 }]
            }
        }
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-PUR-001',
            journalDate: datePur,
            description: `ซื้อสินค้าเชื่อ - ${supplier.name}`,
            status: 'POSTED' as any,
            sourceType: 'PURCHASE_TAX',
            sourceId: purchase.id,
            lines: {
                create: [
                    { accountId: createdMap.get('1301-00')!, debitAmount: 112149.53, creditAmount: 0, description: 'สินค้าคงเหลือ' },
                    { accountId: createdMap.get('1202-00')!, debitAmount: 7850.47, creditAmount: 0, description: 'ภาษีซื้อ (7%)' },
                    { accountId: createdMap.get('2101-00')!, debitAmount: 0, creditAmount: 120000, description: 'เจ้าหนี้การค้า' }
                ]
            }
        }
    });

    // 8. EXPENSE
    console.log('Expense Flow...');
    const dateExp = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    const expense = await prisma.expense.create({
        data: {
            shopId: shop.id,
            userId: user.id,
            memberId: member.id,
            amount: 10000,
            description: 'Office Rent - April 2026',
            date: dateExp,
            category: 'Rent',
            paymentStatus: 'PAID',
            paidAmount: 9500
        }
    });

    await prisma.journalEntry.create({
        data: {
            shopId: shop.id,
            memberId: member.id,
            entryNo: 'JE-EXP-001',
            journalDate: dateExp,
            description: `จ่ายค่าเช่าออฟฟิศ (หัก WHT 5%)`,
            status: 'POSTED' as any,
            sourceType: 'EXPENSE_BOOK',
            sourceId: expense.id,
            lines: {
                create: [
                    { accountId: createdMap.get('5202-00')!, debitAmount: 10000, creditAmount: 0, description: 'ค่าเช่า' },
                    { accountId: createdMap.get('1102-00')!, debitAmount: 0, creditAmount: 9500, description: 'จ่ายเน็ต' },
                    { accountId: createdMap.get('2202-00')!, debitAmount: 0, creditAmount: 500, description: 'ภาษีหัก ณ ที่จ่าย 5% ค้างจ่าย' }
                ]
            }
        }
    });

    console.log('--- FULL-FLOW Demo Data Seeding Completed ---');
    console.log('Access Details:');
    console.log('Login: demo@namfon.com');
    console.log('Password: password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
