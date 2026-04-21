/**
 * Migration Script: Migrate Legacy Addresses to Phase 3 PartnerAddress Structure (FIXED TAKE 3)
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ARGS = process.argv.slice(2);
const IS_DRY_RUN = ARGS.includes('--dry-run');
const LIMIT = parseInt(ARGS.find(a => a.startsWith('--limit='))?.split('=')[1] || '10000');

async function migrate() {
    console.log(`🚀 Starting Migration: Legacy Addresses -> PartnerAddress`);
    console.log(`MODE: ${IS_DRY_RUN ? '🔍 DRY RUN (Simulation)' : '⚠️ LIVE MIGRATION'}`);
    console.log(`LIMIT: ${LIMIT}\n`);

    const report = {
        customers: { scanned: 0, migrated: 0, skipped: 0, failed: 0 },
        suppliers: { scanned: 0, migrated: 0, skipped: 0, failed: 0 }
    };

    // --- 1. Migrate Customers ---
    const customers = await prisma.customer.findMany({
        where: { deletedAt: null },
        take: LIMIT,
        include: { partnerAddresses: true }
    });

    for (const cust of customers) {
        report.customers.scanned++;

        if ((cust as any).partnerAddresses?.length > 0) {
            report.customers.skipped++;
            continue;
        }

        if (!cust.address && !cust.phone) {
            report.customers.skipped++;
            continue;
        }

        if (IS_DRY_RUN) {
            report.customers.migrated++;
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await (tx as any).partnerAddress.create({
                    data: {
                        customerId: cust.id,
                        shopId: cust.shopId,
                        label: 'ที่อยู่หลัก (Migrated)',
                        address: cust.address || '-',
                        isDefaultBilling: true,
                        isDefaultShipping: true,
                        contacts: {
                            create: {
                                shopId: cust.shopId, // Mandatory field
                                name: cust.name,
                                phone: cust.phone || '',
                                isPrimary: true,
                                notes: `[LEGACY_MIGRATION_V1] Migrated at ${new Date().toISOString()}`
                            }
                        }
                    }
                });
            });
            report.customers.migrated++;
        } catch (err) {
            console.error(`❌ Failed to migrate customer ${cust.id}:`, err);
            report.customers.failed++;
        }
    }

    // --- 2. Migrate Suppliers ---
    const suppliers = await prisma.supplier.findMany({
        where: { deletedAt: null },
        take: LIMIT,
        include: { partnerAddresses: true }
    });

    for (const sup of suppliers) {
        report.suppliers.scanned++;

        if ((sup as any).partnerAddresses?.length > 0) {
            report.suppliers.skipped++;
            continue;
        }

        if (!sup.address && !sup.phone) {
            report.suppliers.skipped++;
            continue;
        }

        if (IS_DRY_RUN) {
            report.suppliers.migrated++;
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await (tx as any).partnerAddress.create({
                    data: {
                        supplierId: sup.id,
                        shopId: sup.shopId,
                        label: 'ที่อยู่หลัก (Migrated)',
                        address: sup.address || '-',
                        isDefaultBilling: true,
                        isDefaultShipping: true,
                        contacts: {
                            create: {
                                shopId: sup.shopId, // Mandatory field
                                name: sup.contactName || sup.name,
                                phone: sup.phone || '',
                                isPrimary: true,
                                notes: `[LEGACY_MIGRATION_V1] Migrated at ${new Date().toISOString()}`
                            }
                        }
                    }
                });
            });
            report.suppliers.migrated++;
        } catch (err) {
            console.error(`❌ Failed to migrate supplier ${sup.id}:`, err);
            report.suppliers.failed++;
        }
    }

    console.log(`\n📊 Migration Report:`);
    console.table(report);
}

migrate()
    .catch(err => {
        console.error('💥 Migration Script Crashed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
