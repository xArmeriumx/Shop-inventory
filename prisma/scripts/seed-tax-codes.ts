/**
 * seed-tax-codes.ts — Default Thai VAT Codes สำหรับ Namfon ERP
 *
 * รัน: npx ts-node prisma/scripts/seed-tax-codes.ts
 *
 * Tax codes ที่ seed:
 * 1. VAT7_OUT  — VAT 7% ขาย (ภาษีขาย)
 * 2. VAT7_IN   — VAT 7% ซื้อ (ภาษีซื้อ)
 * 3. VAT0_OUT  — VAT 0% ขาย (ส่งออก/บริการต่างประเทศ)
 * 4. EXEMPT_OUT — ยกเว้น VAT ขาย (ตามมาตรา 81)
 * 5. NOVAT     — ไม่มี VAT (นอกขอบ VAT)
 *
 * NOTE: VAT 7% มีผลถึง 30 ก.ย. 2569 ตามประกาศกรมสรรพากร
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// อัตรา VAT ชั่วคราว 7% (ต่อถึง 30 ก.ย. 2569)
const VAT_EFFECTIVE_FROM = new Date('2024-10-01');
const VAT_EFFECTIVE_TO = new Date('2026-09-30');

const DEFAULT_TAX_CODES = [
    {
        code: 'VAT7_OUT',
        name: 'VAT 7% (ขาย)',
        description: 'ภาษีมูลค่าเพิ่ม 7% สำหรับการขายสินค้า/บริการในประเทศ',
        direction: 'OUTPUT' as const,
        kind: 'VAT' as const,
        rate: 7.0,
        calculationMode: 'EXCLUSIVE' as const,
        effectiveFrom: VAT_EFFECTIVE_FROM,
        effectiveTo: VAT_EFFECTIVE_TO,
        reportBucket: 'SALES_VAT',
        isActive: true,
    },
    {
        code: 'VAT7_IN',
        name: 'VAT 7% (ซื้อ)',
        description: 'ภาษีมูลค่าเพิ่ม 7% สำหรับการซื้อสินค้า/บริการ (ภาษีซื้อ)',
        direction: 'INPUT' as const,
        kind: 'VAT' as const,
        rate: 7.0,
        calculationMode: 'EXCLUSIVE' as const,
        effectiveFrom: VAT_EFFECTIVE_FROM,
        effectiveTo: VAT_EFFECTIVE_TO,
        reportBucket: 'PURCHASE_VAT',
        isActive: true,
    },
    {
        code: 'VAT0_OUT',
        name: 'VAT 0% (ส่งออก)',
        description: 'อัตราภาษีมูลค่าเพิ่ม 0% สำหรับการส่งออกและบริการต่างประเทศ',
        direction: 'OUTPUT' as const,
        kind: 'ZERO_RATED' as const,
        rate: 0.0,
        calculationMode: 'EXCLUSIVE' as const,
        effectiveFrom: new Date('2000-01-01'),
        effectiveTo: null,
        reportBucket: 'SALES_VAT',
        isActive: true,
    },
    {
        code: 'EXEMPT_OUT',
        name: 'ยกเว้น VAT (ขาย)',
        description: 'สินค้า/บริการที่ได้รับยกเว้นภาษีมูลค่าเพิ่มตามมาตรา 81',
        direction: 'OUTPUT' as const,
        kind: 'EXEMPT' as const,
        rate: 0.0,
        calculationMode: 'EXCLUSIVE' as const,
        effectiveFrom: new Date('2000-01-01'),
        effectiveTo: null,
        reportBucket: 'EXEMPT',
        isActive: true,
    },
    {
        code: 'NOVAT',
        name: 'ไม่มี VAT',
        description: 'รายการที่ไม่อยู่ในขอบข่ายภาษีมูลค่าเพิ่ม',
        direction: 'OUTPUT' as const,
        kind: 'NO_VAT' as const,
        rate: 0.0,
        calculationMode: 'EXCLUSIVE' as const,
        effectiveFrom: new Date('2000-01-01'),
        effectiveTo: null,
        reportBucket: null,
        isActive: true,
    },
];

async function main() {
    console.log('🧾 Seeding Thai VAT Tax Codes...\n');

    // หา shops ทั้งหมด
    const shops = await prisma.shop.findMany({ select: { id: true, name: true } });

    if (shops.length === 0) {
        console.log('⚠️  ไม่พบ Shop ใดในระบบ — ข้ามการ seed');
        return;
    }

    for (const shop of shops) {
        console.log(`🏪 Shop: ${shop.name} (${shop.id})`);

        for (const taxCode of DEFAULT_TAX_CODES) {
            const result = await prisma.taxCode.upsert({
                where: { shopId_code: { shopId: shop.id, code: taxCode.code } },
                create: { shopId: shop.id, ...taxCode },
                update: {
                    name: taxCode.name,
                    description: taxCode.description,
                    isActive: taxCode.isActive,
                    effectiveTo: taxCode.effectiveTo,
                },
            });
            console.log(
                `  ✅ ${result.code.padEnd(12)} | ${result.name} | ${result.rate}%`
            );
        }

        console.log('');
    }

    console.log('✅ Tax Code seeding completed!\n');
    console.log('📋 Summary:');
    console.log('  - VAT7_OUT  : ภาษีขาย 7% (ถึง 30 ก.ย. 2569)');
    console.log('  - VAT7_IN   : ภาษีซื้อ 7% (ถึง 30 ก.ย. 2569)');
    console.log('  - VAT0_OUT  : ส่งออก 0%');
    console.log('  - EXEMPT_OUT: ยกเว้น VAT (มาตรา 81)');
    console.log('  - NOVAT     : ไม่มี VAT');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
