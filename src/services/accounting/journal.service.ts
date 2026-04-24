import { db } from '@/lib/db';
import { RequestContext, ServiceError, DocumentType } from '@/types/domain';
import { SequenceService } from '@/services/core/system/sequence.service';
import { Prisma } from '@prisma/client';
import { money } from '@/lib/money';
import { AccountingService } from './accounting.service';

/**
 * JournalService — ระบบบริหารจัดการสมุดรายวัน (Ledger Engine)
 * 
 * หน้าที่ (Phase A1.2):
 * 1. บันทึกรายการบัญชี (Debit/Credit) แบบ Double-Entry
 * 2. ตรวจสอบความสมดุล (Balance Validation)
 * 3. ควบคุมสถานะ DRAFT -> POSTED -> VOIDED
 * 4. รักษาความ Immutability ของรายการที่ POSTED แล้ว
 */
export const JournalService = {
    /**
     * สร้างรายการสมุดรายวัน (Draft หรือ Post ทันที)
     */
    async createEntry(ctx: RequestContext, input: {
        journalDate: Date;
        description?: string;
        lines: Array<{
            accountId: string;
            description?: string;
            debitAmount: number;
            creditAmount: number;
            partnerId?: string;
            partnerType?: string;
        }>;
        status?: 'DRAFT' | 'POSTED';
        sourceType?: string;
        sourceId?: string;
        sourceNo?: string;
        postingPurpose?: string;
    }, tx: Prisma.TransactionClient = db as any) {

        // 0. Period Lock Check (Phase A1.6)
        // Ensure the journal date is not in a closed accounting period
        await AccountingService.checkPeriodLock(ctx.shopId, input.journalDate, tx);

        // 1. Validation: Debit/Credit Balance (Rule 3)
        let totalDebit = 0;
        let totalCredit = 0;

        if (input.lines.length < 2) {
            throw new ServiceError('รายการบัญชีต้องมีอย่างน้อย 2 รายการ (Double-Entry)');
        }

        for (const line of input.lines) {
            // Rule 3: ห้ามติดลบ
            if (line.debitAmount < 0 || line.creditAmount < 0) {
                throw new ServiceError('จำนวนเงินห้ามติดลบ');
            }

            // Rule 3: 1 line ต้องมีแค่อย่างใดอย่างหนึ่ง
            if (line.debitAmount > 0 && line.creditAmount > 0) {
                throw new ServiceError('แต่ละบรรทัดต้องมีเพียง Debit หรือ Credit อย่างใดอย่างหนึ่งเท่านั้น');
            }

            if (line.debitAmount === 0 && line.creditAmount === 0) {
                throw new ServiceError('ต้องระบุจำนวนเงิน Debit หรือ Credit ในทุกบรรทัด');
            }

            totalDebit = money.add(totalDebit, line.debitAmount);
            totalCredit = money.add(totalCredit, line.creditAmount);
        }

        // Rule 3: sum(debit) = sum(credit)
        if (!money.isEqual(totalDebit, totalCredit)) {
            throw new ServiceError(`รายการไม่สมดุล (Difference: ${money.subtract(totalDebit, totalCredit)})`);
        }

        // 2. Generate Entry Number (Rule 1 & 4)
        const entryNo = await SequenceService.generate(ctx, DocumentType.JOURNAL_VOUCHER, tx);

        // 3. Create Entry
        const entry = await (tx as any).journalEntry.create({
            data: {
                shopId: ctx.shopId,
                memberId: ctx.memberId || ctx.userId,
                entryNo,
                journalDate: input.journalDate,
                description: input.description,
                status: input.status || 'DRAFT',
                postedAt: input.status === 'POSTED' ? new Date() : null, // Rule 5
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                sourceNo: input.sourceNo,
                postingPurpose: input.postingPurpose || 'GENERAL',
                lines: {
                    create: input.lines.map(line => ({
                        accountId: line.accountId,
                        description: line.description,
                        debitAmount: line.debitAmount,
                        creditAmount: line.creditAmount,
                        partnerId: line.partnerId,
                        partnerType: line.partnerType
                    }))
                }
            },
            include: {
                lines: {
                    include: { account: true }
                }
            }
        });

        return entry;
    },

    /**
     * ยืนยันการลงรายการ (Post Entry)
     * Rule 2: เมื่อ POSTED แล้วจะ Immutable
     */
    async postEntry(id: string, ctx: RequestContext) {
        return await db.$transaction(async (tx) => {
            const entry = await (tx as any).journalEntry.findFirst({
                where: { id, shopId: ctx.shopId }
            });

            if (!entry) throw new ServiceError('ไม่พบรายการสมุดรายวัน');
            if (entry.status !== 'DRAFT') throw new ServiceError('รายการนี้ถูก Post หรือ Void ไปแล้ว');

            return await (tx as any).journalEntry.update({
                where: { id },
                data: {
                    status: 'POSTED',
                    postedAt: new Date() // Rule 5
                }
            });
        });
    },

    /**
     * ยกเลิกรายการ (Void Entry)
     * Rule 2: ห้ามลบ ใช้สถานะ VOIDED
     */
    async voidEntry(id: string, ctx: RequestContext) {
        return await db.$transaction(async (tx) => {
            const entry = await (tx as any).journalEntry.findFirst({
                where: { id, shopId: ctx.shopId }
            });

            if (!entry) throw new ServiceError('ไม่พบรายการสมุดรายวัน');
            if (entry.status === 'VOIDED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

            // Note: In Phase A1.2, we just mark as VOIDED. 
            // In full ERP, we might need to create a reversal entry.
            return await (tx as any).journalEntry.update({
                where: { id },
                data: {
                    status: 'VOIDED',
                    updatedAt: new Date()
                }
            });
        });
    },

    /**
     * ดึงรายการสมุดรายวัน
     */
    async getEntries(ctx: RequestContext, params: {
        status?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }) {
        const where: any = {
            shopId: ctx.shopId,
        };

        if (params.status) where.status = params.status;
        if (params.startDate || params.endDate) {
            where.journalDate = {};
            if (params.startDate) where.journalDate.gte = params.startDate;
            if (params.endDate) where.journalDate.lte = params.endDate;
        }

        return await (db as any).journalEntry.findMany({
            where,
            orderBy: { journalDate: 'desc' },
            take: params.limit || 50,
            skip: params.offset || 0,
            include: {
                lines: {
                    include: { account: true }
                },
                member: {
                    select: { user: { select: { name: true } } }
                }
            }
        });
    },

    /**
     * ดึงรายการสมุดรายวันจากเอกสารต้นทาง
     */
    async getEntryBySource(ctx: RequestContext, sourceType: string, sourceId: string) {
        return await (db as any).journalEntry.findFirst({
            where: { shopId: ctx.shopId, sourceType, sourceId },
            include: {
                lines: {
                    include: { account: true }
                }
            }
        });
    },

    /**
     * สร้างรายการล้างบัญชี (Reversing Entry)
     * นำรายการเดิมมาทำการ Flip Debit/Credit เพื่อยกเลิกผลกระทบทางบัญชีแบบ Audit-friendly
     */
    async reverseEntry(ctx: RequestContext, originalEntryId: string, tx: Prisma.TransactionClient = db as any) {
        const original = await (tx as any).journalEntry.findFirst({
            where: { id: originalEntryId, shopId: ctx.shopId },
            include: { lines: true }
        });

        if (!original) throw new ServiceError('ไม่พบรายการบัญชีต้นฉบับ');
        if (original.status === 'VOIDED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

        // สร้างรายการบัญชีใหม่ที่ตรงข้ามกับของเดิม (Debit -> Credit)
        const reversedLines = original.lines.map((line: any) => ({
            accountId: line.accountId,
            description: `[REVERSAL] ${line.description || ''}`,
            debitAmount: Number(line.creditAmount), // Flip!
            creditAmount: Number(line.debitAmount), // Flip!
            partnerId: line.partnerId,
            partnerType: line.partnerType
        }));

        const reversal = await this.createEntry(ctx, {
            journalDate: new Date(),
            description: `รายการกลับบัญชีเพื่อยกเลิกใบสำคัญเลขที่ ${original.entryNo}`,
            sourceType: original.sourceType,
            sourceId: original.sourceId,
            sourceNo: original.sourceNo,
            postingPurpose: 'VOID_REVERSAL',
            status: 'POSTED',
            lines: reversedLines
        }, tx);

        // Mark original as VOIDED (Optional, but good for visibility)
        await (tx as any).journalEntry.update({
            where: { id: original.id },
            data: { status: 'VOIDED' }
        });

        return reversal;
    }
};
