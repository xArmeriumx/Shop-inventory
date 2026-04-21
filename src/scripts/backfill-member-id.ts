import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
    console.log('🚀 Starting ERP Identity Backfill (Phase 3)...');

    const shops = await db.shop.findMany({
        select: { id: true, name: true }
    });

    for (const shop of shops) {
        const shopId = shop.id;
        console.log(`\n--- Processing Shop: ${shop.name} (${shopId}) ---`);

        // 1. Map existing Users to ShopMembers
        const members = await db.shopMember.findMany({
            where: { shopId },
            select: { id: true, userId: true }
        });

        const userToMember: Record<string, string> = {};
        members.forEach(m => {
            userToMember[m.userId] = m.id;
        });

        console.log(`- Found ${members.length} shop members`);

        // 2. Identify Models that need backfilling
        const modelsToBackfill = [
            { name: 'product', hasUserId: true },
            { name: 'sale', hasUserId: true },
            { name: 'purchase', hasUserId: true },
            { name: 'stockLog', hasUserId: true },
            { name: 'shipment', hasUserId: false }, // Use sale relation
            { name: 'return', hasUserId: true },
            { name: 'quotation', hasUserId: true },
            { name: 'orderRequest', hasUserId: false }, // Use requesterId
            { name: 'expense', hasUserId: true },
            { name: 'income', hasUserId: true },
        ];

        for (const modelDef of modelsToBackfill) {
            console.log(`\n📦 Processing model: ${modelDef.name}`);

            const model = (db as any)[modelDef.name];
            if (!model) {
                console.warn(`⚠️ Model ${modelDef.name} not found in Prisma client`);
                continue;
            }

            // Find records with null memberId
            const records = await model.findMany({
                where: { shopId, memberId: null },
            }).catch(() => {
                console.warn(`- ⏭️ Model ${modelDef.name} does not yet have memberId field. Skipping.`);
                return [];
            });

            console.log(`- Found ${records.length} records to update`);

            let updatedCount = 0;
            for (const record of records) {
                let targetMemberId: string | null = null;

                if (modelDef.hasUserId && record.userId && userToMember[record.userId]) {
                    targetMemberId = userToMember[record.userId];
                } else if (modelDef.name === 'orderRequest' && record.requesterId && userToMember[record.requesterId]) {
                    targetMemberId = userToMember[record.requesterId];
                } else if (modelDef.name === 'shipment' && record.saleId) {
                    // Inherit from sale
                    const sale = await db.sale.findUnique({
                        where: { id: record.saleId },
                        select: { memberId: true } as any
                    });
                    if (sale?.memberId) targetMemberId = (sale as any).memberId;
                }

                if (targetMemberId) {
                    await model.update({
                        where: { id: record.id },
                        data: { memberId: targetMemberId } as any
                    });
                    updatedCount++;
                }
            }
            console.log(`- ✅ Updated ${updatedCount} records`);
        }

        // Special Handling: Invoice (derive from Sale)
        console.log(`\n📦 Processing model: invoice`);
        const invoices = await (db as any).invoice.findMany({
            where: { shopId, memberId: null, saleId: { not: null } },
            select: { id: true, saleId: true },
        });

        console.log(`- Found ${invoices.length} invoices to update`);
        let invCount = 0;
        for (const inv of invoices) {
            const sale = await db.sale.findUnique({
                where: { id: inv.saleId },
                select: { memberId: true } as any
            });
            if (sale?.memberId) {
                await (db as any).invoice.update({
                    where: { id: inv.id },
                    data: { memberId: (sale as any).memberId } as any
                });
                invCount++;
            }
        }
        console.log(`- ✅ Updated ${invCount} invoices`);
    }

    console.log('\n✨ Backfill completed successfully.');
}

main()
    .catch(e => {
        console.error('❌ Backfill failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
