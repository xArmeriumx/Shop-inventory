import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/**
 * runInTransaction
 * Centralized helper for managing optional Prisma transactions.
 * If tx is provided, it uses it. Otherwise, it starts a new transaction.
 */
export async function runInTransaction<T>(
  tx: Prisma.TransactionClient | undefined,
  op: (prisma: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (tx) return op(tx);
  return db.$transaction(op);
}
