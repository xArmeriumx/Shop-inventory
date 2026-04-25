import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { Permission, Prisma } from '@prisma/client';

/**
 * AccountingService — จัดการระบบการบัญชีรวม (General Ledger)
 * 
 * หน้าที่ (Phase A1.1):
 * 1. จัดการผังบัญชี (Chart of Accounts)
 * 2. ควบคุมกฎความสมดุล (Debit/Credit Balance)
 * 3. บริหารจัดการ Journal Entry
 */
export const AccountingService = {
    /**
     * Helper for consistent balance calculation
     */
    calculateBalance(debit: number, credit: number, normalBalance: 'DEBIT' | 'CREDIT') {
        const dr = Number(debit);
        const cr = Number(credit);
        return normalBalance === 'DEBIT' ? dr - cr : cr - dr;
    },

    /**
     * ดึงผังบัญชีของร้าน
     */
    async getAccounts(ctx: RequestContext) {
        return await (db as any).account.findMany({
            where: { shopId: ctx.shopId, isActive: true },
            orderBy: [{ category: 'asc' }, { code: 'asc' }],
            include: {
                parent: true,
                children: true
            }
        });
    },

    /**
     * ดึงข้อมูลบัญชีโดยใช้รหัส (Exact Match)
     */
    async getAccountByCode(ctx: RequestContext, code: string) {
        return await (db as any).account.findUnique({
            where: { shopId_code: { shopId: ctx.shopId, code } }
        });
    },

    /**
     * สร้างบัญชีใหม่ในผังบัญชี
     */
    async createAccount(ctx: RequestContext, data: {
        code: string;
        name: string;
        category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
        normalBalance: 'DEBIT' | 'CREDIT';
        parentId?: string | null;
        isPostable?: boolean;
        isActive?: boolean;
    }) {
        Security.requirePermission(ctx, Permission.FINANCE_CONFIG);

        // Check for duplicate code
        const existing = await this.getAccountByCode(ctx, data.code);
        if (existing) throw new ServiceError(`รหัสบัญชี ${data.code} มีอยู่ในระบบแล้ว`);

        return await (db as any).account.create({
            data: {
                ...data,
                shopId: ctx.shopId
            }
        });
    },

    /**
     * แก้ไขข้อมูลผังบัญชี
     */
    async updateAccount(ctx: RequestContext, id: string, data: Partial<{
        name: string;
        category: any;
        normalBalance: any;
        parentId: string | null;
        isPostable: boolean;
        isActive: boolean;
    }>) {
        Security.requirePermission(ctx, Permission.FINANCE_CONFIG);

        return await (db as any).account.update({
            where: { id, shopId: ctx.shopId },
            data
        });
    },

    /**
     * ดึงข้อมูลบัญชีรายตัว
     */
    async getAccountById(id: string, ctx: RequestContext) {
        const account = await (db as any).account.findFirst({
            where: { id, shopId: ctx.shopId },
            include: {
                parent: true,
                journalLines: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { journalEntry: true }
                }
            }
        });

        if (!account) throw new ServiceError('ไม่พบข้อมูลผังบัญชี');
        return account;
    },

    /**
     * ค้นหาบัญชีโดยใช้โค้ด (Internal helper for Posting Engine)
     */
    async findAccountByCode(ctx: RequestContext, code: string, tx: any = db) {
        return await (tx as any).account.findFirst({
            where: { shopId: ctx.shopId, code, isActive: true }
        });
    },

    /**
     * ดึงงบทดลอง (Trial Balance) — สรุปยอดคงเหลือรายบัญชี
     */
    async getTrialBalance(ctx: RequestContext, params: { date?: Date } = {}) {
        const date = params.date || new Date();

        // 1. Get all postable accounts
        const accounts = await (db as any).account.findMany({
            where: { shopId: ctx.shopId, isActive: true, isPostable: true },
            include: {
                journalLines: {
                    where: {
                        journalEntry: {
                            status: 'POSTED',
                            journalDate: { lte: date }
                        }
                    }
                }
            }
        });

        // 2. Map and calculate net balance
        return accounts.map((acc: any) => {
            const totalDebit = acc.journalLines
                .reduce((sum: number, l: any) => sum + Number(l.debitAmount), 0);

            const totalCredit = acc.journalLines
                .reduce((sum: number, l: any) => sum + Number(l.creditAmount), 0);

            const balance = this.calculateBalance(totalDebit, totalCredit, acc.normalBalance);

            return {
                id: acc.id,
                code: acc.code,
                name: acc.name,
                category: acc.category,
                balance,
                totalDebit,
                totalCredit
            };
        });
    },

    /**
     * ตรวจสอบว่าวันที่ระบุ อยู่ในงวดบัญชีที่ปิดไปแล้วหรือไม่ (Period Lock)
     * Requirement: ป้องกันการลงรายการย้อนหลังในงวดที่ปิดไปแล้ว
     */
    async checkPeriodLock(shopId: string, date: Date, tx: any = db) {
        const period = await (tx as any).accountingPeriod.findFirst({
            where: {
                shopId,
                status: 'CLOSED',
                startDate: { lte: date },
                endDate: { gte: date }
            }
        });

        if (period) {
            throw new ServiceError(
                `ไม่สามารถบันทึกรายการได้ เนื่องจากงวดบัญชี ${period.periodName} ถูกปิดไปแล้ว (Closed Period Lock)`,
                { period: ['LOCKED'] }
            );
        }
    },

    /**
     * ดึงรายการงวดบัญชีทั้งหมด
     */
    async getAccountingPeriods(ctx: RequestContext) {
        try {
            // Use findMany with direct relations to avoid nested select issues on nulls
            const periods = await (db as any).accountingPeriod.findMany({
                where: { shopId: ctx.shopId },
                orderBy: { startDate: 'desc' },
                include: {
                    closedBy: {
                        include: { user: { select: { name: true } } }
                    },
                    reopenedBy: {
                        include: { user: { select: { name: true } } }
                    }
                }
            });
            return periods;
        } catch (error) {
            console.error('[AccountingService] getAccountingPeriods failure:', error);
            // Fallback to basic query if relation includes fail
            return await (db as any).accountingPeriod.findMany({
                where: { shopId: ctx.shopId },
                orderBy: { startDate: 'desc' }
            });
        }
    },

    /**
     * ปิดงวดบัญชี (Close Month)
     */
    async closePeriod(ctx: RequestContext, periodId: string) {
        Security.requirePermission(ctx, Permission.FINANCE_CONFIG);

        return await (db as any).accountingPeriod.update({
            where: { id: periodId, shopId: ctx.shopId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedByMemberId: ctx.memberId,
                // Append history Log
                history: {
                    event: 'CLOSE',
                    at: new Date().toISOString(),
                    by: ctx.memberId
                }
            }
        });
    },

    /**
     * เปิดงวดบัญชีที่ปิดไปแล้วอีกครั้ง (Re-open)
     */
    async reopenPeriod(ctx: RequestContext, periodId: string, reason: string) {
        Security.requirePermission(ctx, Permission.FINANCE_CONFIG); // Requires Finance Manager level

        if (!reason) throw new ServiceError('กรุณาระบุเหตุผลในการเปิดงวดบัญชีใหม่');

        return await (db as any).accountingPeriod.update({
            where: { id: periodId, shopId: ctx.shopId },
            data: {
                status: 'OPEN',
                reopenedAt: new Date(),
                reopenedByMemberId: ctx.memberId,
                reopenReason: reason,
                // Append history log
                history: {
                    event: 'REOPEN',
                    at: new Date().toISOString(),
                    by: ctx.memberId,
                    reason
                }
            }
        });
    },

    /**
     * สร้างงวดบัญชีเริ่มต้น (สำหรับปีปัจจุบัน)
     */
    async initializePeriods(ctx: RequestContext) {
        const year = new Date().getFullYear();
        const periods = [];

        for (let month = 0; month < 12; month++) {
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
            const periodName = startDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' });

            periods.push({
                shopId: ctx.shopId,
                periodName,
                startDate,
                endDate,
                status: 'OPEN' as any
            });
        }

        for (const p of periods) {
            await (db as any).accountingPeriod.upsert({
                where: {
                    shopId_startDate_endDate: {
                        shopId: p.shopId,
                        startDate: p.startDate,
                        endDate: p.endDate
                    }
                },
                update: {},
                create: p
            });
        }

        return periods;
    }
};
