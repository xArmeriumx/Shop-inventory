import { db } from './src/lib/db';

async function verify() {
    try {
        const quotation = await (db.quotation as any).findFirst({
            include: { sales: true }
        });
        console.log('✅ Relation "sales" is accessible in Quotation');
    } catch (error) {
        console.error('❌ Relation "sales" is NOT accessible in Quotation');
        console.error(error);
    }
}

verify();
