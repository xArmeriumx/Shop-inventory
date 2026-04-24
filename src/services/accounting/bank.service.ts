import { Prisma, BankLineMatchStatus } from '@prisma/client';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { AccountingService } from './accounting.service';
import { ACCOUNTING_CONFIG } from '@/constants/erp/accounting-logic.constants';

export class BankService {
    /**
     * Generate a unique hash for a bank line to prevent duplicate imports.
     */
    private static generateDedupeHash(data: {
        date: Date;
        amount: number;
        description: string;
        referenceNo?: string;
        bankAccountId: string;
    }): string {
        const input = `${data.bankAccountId}_${data.date.toISOString()}_${data.amount}_${data.description}_${data.referenceNo || ''}`;
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    /**
     * Create a new Bank Account and link it to the CoA.
     */
    static async createBankAccount(data: {
        shopId: string;
        userId: string;
        name: string;
        bankName: string;
        accountNo: string;
        glAccountId: string;
        currency?: string;
    }) {
        return await db.bankAccount.create({
            data: {
                ...data,
                isActive: true
            }
        });
    }

    /**
     * Import a bank statement and its lines with deduplication.
     */
    static async importStatement(data: {
        shopId: string;
        memberId: string;
        bankAccountId: string;
        statementDate: Date;
        openingBalance: number;
        closingBalance: number;
        lines: Array<{
            bookingDate: Date;
            valueDate?: Date;
            description: string;
            referenceNo?: string;
            debitAmount: number;
            creditAmount: number;
        }>;
    }) {
        return await db.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Create the Statement header
            const statement = await tx.bankStatement.create({
                data: {
                    shopId: data.shopId,
                    memberId: data.memberId,
                    bankAccountId: data.bankAccountId,
                    statementDate: data.statementDate,
                    openingBalance: data.openingBalance,
                    closingBalance: data.closingBalance,
                    importSource: 'MANUAL',
                    status: 'IMPORTED'
                }
            });

            const importedLines = [];
            for (const line of data.lines) {
                const netAmount = line.creditAmount - line.debitAmount;
                const dedupeHash = this.generateDedupeHash({
                    bankAccountId: data.bankAccountId,
                    date: line.bookingDate,
                    amount: netAmount,
                    description: line.description,
                    referenceNo: line.referenceNo
                });

                // Check for duplicates
                const existing = await tx.bankLine.findFirst({
                    where: { dedupeHash, shopId: data.shopId }
                });

                if (existing) continue;

                const createdLine = await tx.bankLine.create({
                    data: {
                        shopId: data.shopId,
                        statementId: statement.id,
                        bookingDate: line.bookingDate,
                        valueDate: line.valueDate,
                        description: line.description,
                        referenceNo: line.referenceNo,
                        debitAmount: line.debitAmount,
                        creditAmount: line.creditAmount,
                        netAmount: netAmount,
                        dedupeHash,
                        matchStatus: 'UNMATCHED'
                    }
                });
                importedLines.push(createdLine);
            }

            return { statement, linesImported: importedLines.length };
        });
    }

    /**
     * Find potential matching JournalLines for a specific BankLine.
     */
    static async getMatchCandidates(bankLineId: string) {
        const bankLine = await db.bankLine.findUnique({
            where: { id: bankLineId },
            include: { statement: { include: { bankAccount: true } } }
        });

        if (!bankLine) throw new Error('Bank line not found');

        const { glAccountId } = bankLine.statement.bankAccount;
        const amount = Math.abs(Number(bankLine.netAmount));
        const isDebit = Number(bankLine.netAmount) < 0; // Bank Debit = Ledger Credit (usually)

        return await db.journalLine.findMany({
            where: {
                accountId: glAccountId,
                // Amount match
                debitAmount: isDebit ? 0 : amount,
                creditAmount: isDebit ? amount : 0,
                // Status match
                reconcileStatus: 'UNRECONCILED',
                // Date buffer (±7 days)
                journalEntry: {
                    shopId: bankLine.shopId,
                    journalDate: {
                        gte: new Date(bankLine.bookingDate.getTime() - ACCOUNTING_CONFIG.RECONCILE_BUFFER_DAYS * 24 * 60 * 60 * 1000),
                        lte: new Date(bankLine.bookingDate.getTime() + ACCOUNTING_CONFIG.RECONCILE_BUFFER_DAYS * 24 * 60 * 60 * 1000)
                    },
                    status: 'POSTED'
                }
            },
            include: {
                journalEntry: true
            }
        });
    }

    /**
     * Securely match a BankLine with one or more JournalLines.
     */
    static async matchLine(bankLineId: string, journalLineIds: string[], memberId: string) {
        return await db.$transaction(async (tx: Prisma.TransactionClient) => {
            const bankLine = await tx.bankLine.findUnique({ where: { id: bankLineId } });
            if (!bankLine) throw new Error('Bank line not found');

            // 0. Check Period Lock
            await AccountingService.checkPeriodLock(bankLine.shopId, bankLine.bookingDate);

            // 1. Update JournalLines
            await tx.journalLine.updateMany({
                where: { id: { in: journalLineIds } },
                data: {
                    reconcileStatus: 'RECONCILED',
                    reconciledAt: new Date(),
                    bankLineId: bankLineId
                }
            });

            // 2. Update BankLine
            return await tx.bankLine.update({
                where: { id: bankLineId },
                data: {
                    matchStatus: 'MATCHED',
                    matchedAt: new Date(),
                    matchedByMemberId: memberId
                }
            });
        });
    }
}
